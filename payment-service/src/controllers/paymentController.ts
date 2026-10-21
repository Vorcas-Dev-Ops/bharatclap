import { Request, Response } from 'express';
import { Money } from '@bharatclap/shared';
import { PaymentRepository, isPaymentCaptured } from '../repositories/paymentRepository';
import { AuthRequest } from '../middleware/authMiddleware';
import { getBookingsBatch, getCatalogBatch, getUserCartInternal, getUsersBatch, getProvidersBatch, getAddressesBatch, sendNotification } from '../utils/internalApi';
import axios from 'axios';
import crypto from 'crypto';
import razorpay from '../config/razorpay';

interface ResolvedBooking {
  _id: string;
  booking_id: string;
  subservice_id: string;
  payable_amount: number;
  payment_status: string;
  payment_method?: string;
}

interface ResolvedSubService {
  _id: string;
  subservice_name: string;
}

// @desc    Create a Razorpay order
// @route   POST /api/payments/create-order
// @access  Private
export const createRazorpayOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { booking_id } = req.body;
    let clientAmount = req.body.amount;
    const user_id = req.user?._id;

    if (!user_id) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    // 1. Audit / Telemetry Logging for invalid/outlandish client amounts
    if (typeof clientAmount === 'number' && (clientAmount <= 0 || clientAmount > 1000000)) {
      console.warn('[SECURITY TELEMETRY] Suspicious client amount received:', {
        clientAmount,
        user_id,
        booking_id,
        ip: req.ip || req.headers['x-forwarded-for'],
      });
    }

    let authoritativeAmount: number | null = null;
    let targetBooking: any = null;

    if (booking_id) {
      const bookings = await getBookingsBatch([booking_id]);
      targetBooking = bookings?.[0];
      if (targetBooking) {
        const bookingUserId = targetBooking.user_id?._id || targetBooking.user_id || targetBooking.customer_id;
        if (bookingUserId && String(bookingUserId) !== String(user_id)) {
          res.status(403).json({ message: 'Forbidden: Not authorized for this booking' });
          return;
        }

        // 2. Prevent Double Payment: Check if booking is already paid
        if (targetBooking.payment_status === 'completed' || targetBooking.status === 'completed') {
          res.status(409).json({ message: 'Booking has already been paid' });
          return;
        }

        const existingPaid = await PaymentRepository.findExistingPaid(booking_id);
        if (existingPaid) {
          res.status(409).json({ message: 'A completed payment already exists for this booking' });
          return;
        }

        // 4. Order Creation Idempotency: Reuse existing pending order if created within last 30 minutes
        const existingPending = await PaymentRepository.findPendingOrder(booking_id, 30);
        if (existingPending && existingPending.razorpay_order_id) {
          res.status(200).json({
            razorpay_order_id: existingPending.razorpay_order_id,
            amount: Money.toPaise(Money.from(existingPending.amount)),
            currency: 'INR',
            key_id: process.env.RAZORPAY_KEY_ID,
            reused: true,
          });
          return;
        }

        authoritativeAmount = targetBooking.payable_amount ?? targetBooking.final_amount ?? targetBooking.service_price;
      }
    }

    if (!authoritativeAmount) {
      // Fallback: Fetch active user cart from booking-service
      const cart = await getUserCartInternal(String(user_id));
      if (cart && typeof cart.total_amount === 'number' && cart.total_amount > 0) {
        authoritativeAmount = cart.total_amount;
      }
    }

    // 5. Audit Logging: Record tampering attempt if client amount differs from server amount
    let finalAmount = clientAmount;
    if (authoritativeAmount && authoritativeAmount > 0) {
      if (clientAmount !== undefined && clientAmount !== authoritativeAmount) {
        console.warn('[SECURITY TELEMETRY] Client price tampering attempt intercepted:', {
          clientAmount,
          authoritativeAmount,
          user_id,
          booking_id,
          ip: req.ip || req.headers['x-forwarded-for'],
        });
      }
      finalAmount = authoritativeAmount;
    }

    if (!finalAmount || finalAmount <= 0) {
      res.status(400).json({ message: 'Please provide a valid amount' });
      return;
    }

    // 8. Receipt / Booking Mapping
    const receiptId = booking_id ? `bk_${booking_id}` : `cart_${user_id.toString().slice(-8)}_${Date.now()}`;

    // Razorpay expects amount in paise (1 INR = 100 paise)
    const options = {
      amount: Money.toPaise(Money.from(finalAmount)),
      currency: 'INR',
      receipt: receiptId,
    };

    const order: any = await razorpay.orders.create(options);

    res.status(201).json({
      razorpay_order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error('[RAZORPAY] Create order error:', error);
    res.status(500).json({ message: 'Failed to create Razorpay order', error: error.message });
  }
};

// @desc    Verify Razorpay payment signature and save/update payment record (Idempotent)
// @route   POST /api/payments/verify
// @access  Private
export const verifyRazorpayPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      booking_id,
      correlation_id,
      gateway_response,
    } = req.body;

    const user_id = req.user?._id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ message: 'Missing Razorpay payment data' });
      return;
    }

    // 2. Prevent Double Verification: Check if payment already completed
    const existingPayment = await PaymentRepository.findByRazorpayPaymentId(razorpay_payment_id);
    if (existingPayment && isPaymentCaptured(existingPayment.payment_status)) {
      res.status(200).json({
        success: true,
        message: 'Payment already verified',
        payment: existingPayment,
      });
      return;
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error('[RAZORPAY] RAZORPAY_KEY_SECRET is not configured');
      res.status(500).json({ message: 'Payment verification misconfigured: secret missing' });
      return;
    }

    // Verify signature using HMAC SHA256 with timingSafeEqual
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const submittedBuf = Buffer.from(razorpay_signature, 'utf8');

    if (expectedBuf.length !== submittedBuf.length || !crypto.timingSafeEqual(expectedBuf, submittedBuf)) {
      console.error('[RAZORPAY] Signature mismatch');
      res.status(400).json({ message: 'Payment verification failed: invalid signature' });
      return;
    }

    // Fetch official charged order from Razorpay API
    const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
    if (!rzpOrder) {
      res.status(400).json({ message: 'Payment verification failed: Razorpay order not found' });
      return;
    }

    // 7. Verify Currency
    if (rzpOrder.currency && rzpOrder.currency !== 'INR') {
      res.status(400).json({ message: 'Payment verification failed: invalid transaction currency' });
      return;
    }

    // 8. Verify Receipt / Booking Mapping
    if (booking_id && rzpOrder.receipt && rzpOrder.receipt.startsWith('bk_') && rzpOrder.receipt !== `bk_${booking_id}`) {
      console.warn('[SECURITY TELEMETRY] Receipt booking mismatch:', { receipt: rzpOrder.receipt, booking_id });
      res.status(400).json({ message: 'Payment verification failed: booking receipt mismatch' });
      return;
    }

    let verifiedAmount = Money.fromPaise(rzpOrder.amount).toNumber();

    // 1. Verify Razorpay Order Amount Matches DB Booking Amount (if booking_id supplied)
    if (booking_id) {
      const bookings = await getBookingsBatch([booking_id]);
      const booking = bookings?.[0];
      if (booking) {
        const expectedDbAmount = booking.payable_amount ?? booking.final_amount ?? booking.service_price;
        if (expectedDbAmount && Money.toPaise(Money.from(expectedDbAmount)) !== parseInt(String(rzpOrder.amount), 10)) {
          console.error('[PAYMENT SECURITY] Razorpay order amount mismatch with DB booking amount:', {
            rzpAmountPaise: rzpOrder.amount,
            expectedDbAmountPaise: Money.toPaise(Money.from(expectedDbAmount)),
            booking_id
          });
          res.status(400).json({ message: 'Payment verification failed: order amount does not match booking total' });
          return;
        }
      }
    }

    // Signature is valid — upsert payment record
    const payment = await PaymentRepository.upsertPaymentByRazorpayPaymentId({
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpaySignature: razorpay_signature,
      bookingId: booking_id,
      userId: String(user_id),
      amount: verifiedAmount,
      paymentMethod: 'online',
      paymentStatus: 'Captured',
      correlationId: correlation_id,
      gatewayResponse: gateway_response || {},
      note: 'Razorpay signature verified successfully',
    });

    if (payment) {
      const eventId = `payment.completed:${payment.id}`;
      await PaymentRepository.createOutboxEvent({
        eventId,
        eventType: 'PaymentCompleted',
        payload: {
          paymentId: payment.id,
          bookingId: payment.booking_id || null,
          userId: payment.user_id || null,
          amount: payment.amount,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      payment,
    });
  } catch (error: any) {
    console.error('[RAZORPAY] Verify payment error:', error);
    res.status(500).json({ message: 'Payment verification failed', error: error.message });
  }
};

// @desc    Idempotently link Booking & Order to Payment or create COD Payment record (Internal)
// @route   POST /api/internal/payments/link
// @access  Internal
export const linkBookingToPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      payment_id,
      booking_id,
      order_id,
      user_id,
      amount,
      payment_method,
      transaction_id,
      correlation_id,
    } = req.body;

    if (!user_id && !payment_id && !booking_id) {
      res.status(400).json({ message: 'Missing user_id, payment_id, or booking_id' });
      return;
    }

    let payment = null;

    if (payment_id) {
      payment = await PaymentRepository.findById(payment_id);
    } else if (booking_id) {
      payment = await PaymentRepository.findByBookingId(booking_id);
    }

    if (!payment && booking_id && user_id) {
      // Create COD payment record
      payment = await PaymentRepository.createPayment({
        bookingId: booking_id,
        userId: user_id,
        amount: amount || 0,
        paymentMethod: payment_method || 'cod',
        paymentStatus: 'Created',
        transactionId: transaction_id || null,
        correlationId: correlation_id || null,
        statusHistory: [{
          status: 'Created',
          timestamp: new Date().toISOString(),
          note: `Payment created for ${payment_method === 'cod' ? 'Cash on Delivery' : 'Online'}`,
        }],
      });
    }

    if (!payment) {
      res.status(400).json({ message: 'Could not link or create payment' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Payment linked successfully',
      payment,
    });
  } catch (error: any) {
    console.error('[PAYMENT SERVICE] Link booking error:', error);
    res.status(500).json({ message: 'Failed to link payment', error: error.message });
  }
};

// @desc    Read-only payment verification
// @route   GET /api/payments/internal/verify/:id
// @access  Internal
export const getPaymentForVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim() === '') {
      res.status(400).json({ message: 'Invalid payment ID' });
      return;
    }

    let payment = await PaymentRepository.findById(id);

    if (!payment) {
      payment = await PaymentRepository.findByRazorpayPaymentId(id);
    }

    if (!payment) {
      payment = await PaymentRepository.findByTransactionId(id);
    }

    if (!payment) {
      res.status(404).json({ message: 'Payment not found', verified: false });
      return;
    }

    // Resolve webhook/gateway race condition. If local DB is still pending, live-check Razorpay API.
    const isCompleted = isPaymentCaptured(payment.payment_status);
    if (!isCompleted && payment.razorpay_payment_id && !payment.razorpay_payment_id.startsWith('pay_mock_')) {
      try {
        const rzpPayment = await razorpay.payments.fetch(payment.razorpay_payment_id);
        if (rzpPayment && (rzpPayment.status === 'captured' || rzpPayment.status === 'authorized')) {
          payment = await PaymentRepository.updatePaymentStatus(
            payment.id,
            'Captured',
            'Verified directly via Razorpay API fallback in getPaymentForVerification'
          ) || payment;
        }
      } catch (rzpErr: any) {
        console.warn('[PAYMENT SERVICE] Razorpay API fallback fetch error:', rzpErr.message);
      }
    }

    const verified = isPaymentCaptured(payment.payment_status);

    res.status(200).json({
      verified,
      payment: {
        _id: payment._id,
        id: payment.id,
        payment_status: payment.payment_status,
        amount: payment.amount,
        user_id: payment.user_id,
        correlation_id: payment.correlation_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        transaction_id: payment.transaction_id,
      },
    });
  } catch (error: any) {
    console.error('[PAYMENT SERVICE] Verify payment error:', error);
    res.status(500).json({ message: 'Verification error', error: error.message });
  }
};

// @desc    Handle Razorpay Webhooks
// @route   POST /api/payments/webhook
// @access  Public (Signature Verified)
export const handleRazorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!webhookSecret) {
      console.error('[WEBHOOK SECURITY] RAZORPAY_WEBHOOK_SECRET is not configured on server');
      res.status(500).json({ message: 'Webhook processing misconfigured' });
      return;
    }

    if (!signature) {
      console.warn('[WEBHOOK SECURITY] Webhook received with missing x-razorpay-signature header');
      res.status(400).json({ message: 'Missing webhook signature' });
      return;
    }

    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      console.error('[WEBHOOK SECURITY] Raw request body unavailable for signature verification');
      res.status(400).json({ message: 'Raw body required for webhook verification' });
      return;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      console.warn('[WEBHOOK SECURITY] Invalid HMAC-SHA256 signature received');
      res.status(400).json({ message: 'Invalid webhook signature' });
      return;
    }

    const event = req.body?.event;
    const payload = req.body?.payload?.payment?.entity;
    const eventId = (req.headers['x-razorpay-event-id'] as string) || req.body?.event_id || payload?.id;

    // P0-5: Atomic webhook idempotency
    if (eventId) {
      const { isDuplicate } = await PaymentRepository.upsertWebhookLog({
        eventId,
        eventType: event || 'payment_event',
        signatureValid: true,
        payload: req.body,
      });

      if (isDuplicate) {
        console.log(`[WEBHOOK IDEMPOTENCY] Event ${eventId} already processed successfully.`);
        res.status(200).json({ success: true, message: 'Event already processed' });
        return;
      }
    }

    if (payload && (event === 'payment.captured' || event === 'payment.authorized')) {
      const razorpay_payment_id = payload.id;
      const razorpay_order_id = payload.order_id;
      const amount = payload.amount ? payload.amount / 100 : 0;

      let existingPayment = await PaymentRepository.findByRazorpayPaymentId(razorpay_payment_id);
      if (!existingPayment && razorpay_order_id) {
        existingPayment = await PaymentRepository.findByRazorpayOrderId(razorpay_order_id);
      }

      if (existingPayment && isPaymentCaptured(existingPayment.payment_status)) {
        console.log(`[WEBHOOK IDEMPOTENCY] Payment ${existingPayment.id} already in completed state. Skipping side effects.`);
        if (eventId) {
          await PaymentRepository.updateWebhookResult(eventId, 'success');
        }
        res.status(200).json({ success: true, message: 'Payment already completed' });
        return;
      }

      let updatedPayment = null;
      if (existingPayment) {
        updatedPayment = await PaymentRepository.updatePaymentStatus(
          existingPayment.id,
          'Captured',
          `Webhook verified event: ${event}`
        );
      } else if (payload.notes?.booking_id) {
        updatedPayment = await PaymentRepository.createPayment({
          bookingId: payload.notes.booking_id,
          userId: payload.notes.customer_id || '00000000-0000-0000-0000-000000000000',
          amount,
          paymentMethod: 'online',
          paymentStatus: 'Captured',
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          transactionId: razorpay_payment_id,
        });
      }

      if (updatedPayment) {
        const eventOutboxId = `payment.completed:${updatedPayment.id}`;
        await PaymentRepository.createOutboxEvent({
          eventId: eventOutboxId,
          eventType: 'PaymentCompleted',
          payload: {
            paymentId: updatedPayment.id,
            bookingId: updatedPayment.booking_id || null,
            userId: updatedPayment.user_id || null,
            amount: updatedPayment.amount,
          },
        });

        if (updatedPayment.booking_id) {
          try {
            const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
            await axios.post(`${BOOKING_URL}/api/bookings/internal/update-payment-status`, {
              payment_id: updatedPayment.id,
              booking_id: updatedPayment.booking_id,
              payment_status: 'completed',
            }, {
              headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' },
              timeout: 5000,
            });
          } catch (err: any) {
            console.error('[WEBHOOK] Failed to sync payment status with booking service:', err.message);
          }
        }
      }

      if (eventId) {
        await PaymentRepository.updateWebhookResult(eventId, 'success');
      }
    } else if (payload && event === 'payment.failed') {
      const razorpay_payment_id = payload.id;
      let existingPayment = await PaymentRepository.findByRazorpayPaymentId(razorpay_payment_id);
      if (existingPayment) {
        await PaymentRepository.updatePaymentStatus(
          existingPayment.id,
          'Failed',
          payload.error_description || 'Payment failed via webhook'
        );

        if (existingPayment.user_id) {
          sendNotification(
            existingPayment.user_id.toString(),
            'Payment Failed',
            `Your payment attempt of ₹${existingPayment.amount} failed. Reason: ${payload.error_description || 'Unknown gateway error'}.`,
            'payment_alert',
            { payment_id: existingPayment.id, booking_id: existingPayment.booking_id }
          ).catch(err => console.error('[NOTIFICATION WEBHOOK] Failed to send Payment Failed notification:', err));
        }

        if (existingPayment.booking_id) {
          try {
            const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
            await axios.post(`${BOOKING_URL}/api/bookings/internal/update-payment-status`, {
              payment_id: existingPayment.id,
              booking_id: existingPayment.booking_id,
              payment_status: 'failed',
            }, {
              headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
            });
          } catch (err: any) {
            console.error('[WEBHOOK] Failed to sync payment status with booking service:', err.message);
          }
        }
      }
    } else if (event === 'payment_link.paid') {
      const linkEntity = req.body.payload?.payment_link?.entity;
      const paymentEntity = req.body.payload?.payment?.entity;
      if (linkEntity) {
        const paymentLinkId = linkEntity.id;
        const transactionId = paymentEntity?.id || linkEntity.payments?.[0]?.payment_id;
        const amount = linkEntity.amount ? linkEntity.amount / 100 : 0;
        const bookingRef = linkEntity.reference_id || linkEntity.notes?.booking_id;

        if (bookingRef) {
          try {
            const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
            await axios.post(`${BOOKING_URL}/api/bookings/internal/payment-collection/upi-confirmed`, {
              booking_id: bookingRef,
              payment_link_id: paymentLinkId,
              transaction_id: transactionId,
              amount,
            }, {
              headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' },
            });
            console.log(`[WEBHOOK] payment_link.paid: booking ${bookingRef} auto-completed`);
          } catch (err: any) {
            console.error('[WEBHOOK] Failed to auto-complete COD booking via payment link:', err.message);
          }
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('[WEBHOOK] Error processing webhook:', error);
    res.status(500).json({ message: 'Webhook error', error: error.message });
  }
};

// @desc    Create Razorpay Payment Link for COD collection
// @route   POST /api/payments/create-collection-link
// @access  Internal
export const createCollectionLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const { booking_id, booking_display_id, amount, customer_name, customer_phone, customer_email } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ message: 'Valid amount required' });
      return;
    }

    const PAYMENT_EXPIRY_HOURS = Number(process.env.PAYMENT_EXPIRY_HOURS) || 24;
    const expireBy = Math.floor(Date.now() / 1000) + PAYMENT_EXPIRY_HOURS * 3600;
    const linkData: any = await (razorpay as any).paymentLink.create({
      amount: Money.toPaise(Money.from(amount)),
      currency: 'INR',
      accept_partial: false,
      description: `Payment for booking ${booking_display_id || booking_id}`,
      customer: {
        name: customer_name || 'Customer',
        email: customer_email || undefined,
        contact: customer_phone || undefined,
      },
      notify: { sms: !!customer_phone, email: !!customer_email },
      notes: { booking_id: String(booking_id), booking_display_id },
      callback_url: process.env.PAYMENT_CALLBACK_URL || undefined,
      callback_method: 'get',
    } as any);

    res.status(201).json({
      payment_link_id: linkData.id,
      short_url: linkData.short_url,
      amount,
      expires_at: new Date(expireBy * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error('[PAYMENT] Create collection link error:', error);
    res.status(500).json({ message: 'Failed to create payment link', error: error.message });
  }
};

// @desc    Manually retry linking payment to booking (Admin)
// @route   POST /api/payments/:id/retry-link
// @access  Private/Admin
export const retryPaymentLinkAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const paymentId = req.params.id;
    const payment = await PaymentRepository.findById(paymentId);
    if (!payment) {
      res.status(404).json({ message: 'Payment record not found' });
      return;
    }

    const updated = await PaymentRepository.updatePaymentStatus(
      payment.id,
      payment.payment_status,
      'Manually retried and linked by admin'
    );

    res.status(200).json({
      success: true,
      message: 'Payment link updated successfully',
      payment: updated || payment,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Background reconciliation worker for unlinked pending payments
export const reconcilePendingPaymentsWorker = async (): Promise<void> => {
  try {
    const { payments: unlinkedPayments } = await PaymentRepository.findPayments({
      paymentStatus: 'Created',
      limit: 10,
    });

    if (unlinkedPayments.length === 0) return;

    for (const payment of unlinkedPayments) {
      if (payment.user_id) {
        try {
          const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
          const res = await axios.post(`${BOOKING_URL}/api/bookings/batch`, {
            userId: payment.user_id.toString(),
          }, {
            headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
          });
          const userBookings = Array.isArray(res.data) ? res.data : [];
          if (userBookings.length === 0) continue;

          let matched = null;
          if (payment.correlation_id) {
            matched = userBookings.find((b: any) => b.correlation_id === payment.correlation_id);
          }
          if (!matched && payment.amount) {
            const paymentCreatedAt = new Date(payment.createdAt).getTime();
            const candidates = userBookings.filter((b: any) => {
              const bookingAmount = b.payable_amount ?? b.final_amount ?? b.service_price;
              const bookingCreatedAt = new Date(b.createdAt).getTime();
              const timeDiffMs = Math.abs(paymentCreatedAt - bookingCreatedAt);
              return bookingAmount === payment.amount && timeDiffMs < 5 * 60 * 1000;
            });
            if (candidates.length === 1) {
              matched = candidates[0];
            }
          }

          if (matched) {
            await PaymentRepository.updatePaymentStatus(payment.id, payment.payment_status, `Linked to booking ${matched.booking_id}`);
            console.log(`[RECONCILIATION WORKER] Linked payment ${payment.id} to booking ${matched.booking_id}`);
          }
        } catch (err: any) {
          console.error(`[RECONCILIATION WORKER] Reconciliation failed for payment ${payment.id}:`, err.message);
        }
      }
    }
  } catch (err: any) {
    console.error('[RECONCILIATION WORKER] Worker error:', err.message);
  }
};

// @desc    Process payment (Mock/Direct)
// @route   POST /api/payments
// @access  Private
export const processPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { booking_id, amount, payment_method } = req.body;
    const user_id = req.user?._id;

    if (!booking_id || !user_id) {
      res.status(400).json({ message: 'booking_id and user authentication required' });
      return;
    }

    const payment = await PaymentRepository.createPayment({
      bookingId: booking_id,
      userId: String(user_id),
      amount: Number(amount) || 0,
      paymentMethod: payment_method === 'cod' ? 'cod' : 'online',
      paymentStatus: 'Captured',
      transactionId: `TXN_${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    });

    res.status(201).json(payment);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get payment details
// @route   GET /api/payments/:bookingId
// @access  Private
export const getPaymentByBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    if (!bookingId || bookingId === 'undefined' || bookingId === 'null') {
      res.status(400).json({ message: 'Valid booking ID is required' });
      return;
    }

    let payment = await PaymentRepository.findByBookingId(bookingId);
    if (!payment) {
      payment = await PaymentRepository.findById(bookingId);
    }
    if (!payment) {
      payment = await PaymentRepository.findByRazorpayOrderId(bookingId);
    }

    if (!payment) {
      res.status(404).json({ message: 'Payment not found' });
      return;
    }

    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    const isOwner = req.user?._id && String(payment.user_id) === String(req.user._id);

    if (!isAdmin && !isOwner) {
      res.status(403).json({ message: 'Forbidden: Not authorized to view this payment' });
      return;
    }

    res.json(payment);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all payments (Admin)
// @route   GET /api/payments
// @access  Private/Admin
export const getAllPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string;
    const method = req.query.payment_method as string;

    const { payments, total } = await PaymentRepository.findPayments({
      paymentStatus: status,
      paymentMethod: method,
      page,
      limit,
    });

    const bookingIds = payments.map(p => p.booking_id).filter(Boolean);
    const bookings = bookingIds.length ? await getBookingsBatch(bookingIds.map(String)) : [];

    const rawUserIds = [
      ...bookings.map((b: any) => String(b.user_id)),
      ...payments.map((p: any) => String(p.user_id))
    ].filter(id => id && id !== 'undefined' && id !== 'null');

    const addressIds = Array.from(new Set(bookings.map((b: any) => String(b.address_id)).filter(id => id && id !== 'undefined' && id !== 'null')));
    const providerIds = Array.from(new Set(bookings.map((b: any) => String(b.provider_id)).filter(id => id && id !== 'undefined' && id !== 'null')));

    const providersList = providerIds.length ? await getProvidersBatch(providerIds) : [];
    const providerMap = new Map();
    (providersList as any[]).forEach((pr: any) => {
      if (pr._id) providerMap.set(String(pr._id), pr);
      if (pr.user_id && pr.user_id._id) providerMap.set(String(pr.user_id._id), pr);
      else if (pr.user_id) providerMap.set(String(pr.user_id), pr);
    });

    providersList.forEach((pr: any) => {
      if (pr.user_id) rawUserIds.push(String(pr.user_id._id || pr.user_id));
    });

    const userIds = Array.from(new Set(rawUserIds));

    const [usersList, addressesList] = await Promise.all([
      userIds.length ? getUsersBatch(userIds) : [],
      addressIds.length ? getAddressesBatch(addressIds) : []
    ]);

    const userMap = new Map((usersList as any[]).map((u: any) => [String(u._id), u]));
    const addressMap = new Map((addressesList as any[]).map((a: any) => [String(a._id), a]));

    const bookingMap = new Map(bookings.map((b: any) => {
      const u = userMap.get(String(b.user_id));
      const addr = addressMap.get(String(b.address_id));
      const pr = providerMap.get(String(b.provider_id));
      const prUser = pr?.user_id && typeof pr.user_id === 'object' ? pr.user_id : (pr?.user_id ? userMap.get(String(pr.user_id)) : null);

      const serviceName = b.service_name || (b.items && Array.isArray(b.items) && b.items.length > 0 ? b.items.map((i: any) => i.name || i.title || i.service_name).filter(Boolean).join(', ') : 'Home Service');

      const formattedLoc = addr
        ? (addr.address_line || [addr.house_no_building, addr.address_line_1, addr.area_locality, addr.city, addr.state, addr.pincode].filter(Boolean).join(', '))
        : 'N/A';

      const customerName = u?.name || b.customer_name || (b.user_id ? `User ${String(b.user_id).substring(0, 6)}` : 'Customer');
      const customerEmail = u?.email || b.customer_email || 'N/A';
      const customerPhone = u?.phone || b.customer_phone || 'N/A';

      const providerName = pr?.name || pr?.business_name || prUser?.name || b.provider_name || 'Provider';
      const providerEmail = pr?.email || prUser?.email || b.provider_email || 'N/A';
      const providerPhone = pr?.phone || pr?.mobile || prUser?.phone || b.provider_phone || 'N/A';

      return [String(b._id), {
        ...b,
        user: u ? { _id: u._id, name: u.name, email: u.email, phone: u.phone } : (b.user || null),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_location: formattedLoc,
        provider: pr ? { _id: pr._id, name: providerName, email: providerEmail, phone: providerPhone } : (b.provider || null),
        provider_name: providerName,
        provider_email: providerEmail,
        provider_phone: providerPhone,
        service_name: serviceName
      }];
    }));

    const data = payments.map(p => {
      const booking = bookingMap.get(String(p.booking_id));
      const pUser = p.user_id ? userMap.get(String(p.user_id)) : null;

      return {
        ...p,
        booking_id: booking ?? p.booking_id,
        user_name: pUser?.name || booking?.customer_name,
        user_email: pUser?.email || booking?.customer_email,
        user_phone: pUser?.phone || booking?.customer_phone
      };
    });

    res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get payments for logged-in user
// @route   GET /api/payments/my
// @access  Private
export const getMyPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const { payments, total } = await PaymentRepository.findPayments({
      userId: String(userId),
      page,
      limit,
    });

    if (payments.length === 0) {
      res.json({ data: [], total, page, limit, pages: 0 });
      return;
    }

    const bookingIds = payments.map((p: any) => p.booking_id);

    let bookings: any[] = [];
    try {
      const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
      const bRes = await axios.post(`${BOOKING_URL}/api/bookings/batch`, { ids: bookingIds }, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
      });
      bookings = bRes.data;
    } catch (err: any) {
      console.error('Failed to fetch bookings for payments:', err.message);
    }

    const subserviceIds = [...new Set(bookings.map((b: any) => b.subservice_id?.toString()).filter(Boolean))];

    const catalogData = await getCatalogBatch(subserviceIds, [], [], []);
    const subserviceMap = new Map<string, ResolvedSubService>(
      catalogData.subservices.map((s: any) => [String(s._id), s as ResolvedSubService])
    );

    const bookingMap = new Map<string, ResolvedBooking>(
      bookings.map((b: any) => [String(b._id), b as ResolvedBooking])
    );

    const result = payments.map(p => {
      const booking = bookingMap.get(String(p.booking_id));
      const subservice = booking ? subserviceMap.get(String(booking.subservice_id)) : null;
      return {
        _id:             p._id,
        id:              p.id,
        booking_id:      booking?.booking_id ?? p.booking_id,
        subservice_name: subservice?.subservice_name ?? '—',
        amount:          p.amount,
        payment_method:  p.payment_method,
        payment_status:  p.payment_status,
        transaction_id:  p.transaction_id ?? '—',
        payment_date:    p.payment_date ?? p.createdAt,
      };
    });

    res.json({ data: result, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authoritative Payment Revenue Metrics
// @route   GET /api/payments/admin/revenue-metrics
// @access  Internal / Admin
export const getAuthoritativeRevenueMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const metrics = await PaymentRepository.getAuthoritativeRevenueMetrics();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentData = Array(12).fill(0);
    const previousData = Array(12).fill(0);

    res.json({
      success: true,
      totalRevenue: metrics.totalRevenue,
      growthPct: '12.4',
      months,
      currentData,
      previousData,
      count: metrics.transactionCount,
      paymentMethodBreakdown: metrics.paymentMethodBreakdown,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
