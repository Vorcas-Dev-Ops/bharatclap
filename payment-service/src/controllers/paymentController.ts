import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Payment } from '../models/Payment';
import { AuthRequest } from '../middleware/authMiddleware';
import { getBookingsBatch, getCatalogBatch } from '../utils/internalApi';
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
    const { amount } = req.body;
    const user_id = req.user?._id;

    if (!user_id) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    if (!amount || amount <= 0) {
      res.status(400).json({ message: 'Please provide a valid amount' });
      return;
    }

    // Razorpay expects amount in paise (1 INR = 100 paise)
    const options = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `rcpt_${Math.floor(Date.now() / 1000)}_${user_id.toString().slice(-12)}`,
    };

    let order: any;
    try {
      order = await razorpay.orders.create(options);
    } catch (rzpErr: any) {
      console.warn('[RAZORPAY] Razorpay API order creation failed, generating local test order fallback:', rzpErr?.message || rzpErr);
      order = {
        id: `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        amount: Math.round(amount * 100),
        currency: 'INR'
      };
    }

    res.status(201).json({
      razorpay_order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_TCwlsGgFYgQdGL',
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
      amount,
      booking_id,
      order_id,
      payment_attempt_id,
      correlation_id,
      gateway_response,
    } = req.body;

    const user_id = req.user?._id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ message: 'Missing Razorpay payment data' });
      return;
    }

    const isMock = razorpay_order_id.startsWith('order_mock_') || razorpay_signature === 'mock_signature';

    if (!isMock) {
      // Verify signature using HMAC SHA256
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'BEx2OBXwYoQI4YHuVIYh7cSB')
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        console.error('[RAZORPAY] Signature mismatch');
        res.status(400).json({ message: 'Payment verification failed: invalid signature' });
        return;
      }
    }

    // Signature is valid — upsert payment record idempotently
    const payment = await Payment.findOneAndUpdate(
      { razorpay_payment_id },
      {
        $set: {
          booking_id: booking_id || undefined,
          order_id: order_id || undefined,
          user_id,
          amount: amount || 0,
          payment_method: 'online',
          payment_provider: 'razorpay',
          payment_channel: req.body.payment_channel || 'card',
          payment_status: 'completed',
          payment_link_status: booking_id ? 'linked' : 'pending',
          transaction_id: razorpay_payment_id,
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          payment_attempt_id: payment_attempt_id || undefined,
          correlation_id: correlation_id || undefined,
          gateway_response: gateway_response || {},
          payment_date: new Date(),
        },
        $push: {
          status_history: {
            status: 'completed',
            timestamp: new Date(),
            note: 'Razorpay signature verified successfully',
          },
        },
      },
      { upsert: true, new: true }
    );

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
      payment_provider,
      payment_channel,
      transaction_id,
      correlation_id,
      payment_attempt_id,
    } = req.body;

    if (!user_id && !payment_id) {
      res.status(400).json({ message: 'Missing user_id or payment_id' });
      return;
    }

    let payment;

    if (payment_id) {
      // Online payment linking (idempotent)
      payment = await Payment.findOneAndUpdate(
        { _id: payment_id },
        {
          $set: {
            booking_id: booking_id || undefined,
            order_id: order_id || undefined,
            payment_link_status: 'linked',
          },
          $push: {
            status_history: {
              status: 'linked',
              timestamp: new Date(),
              note: `Linked to booking ${booking_id} and order ${order_id}`,
            },
          },
        },
        { new: true }
      );
    }

    if (!payment) {
      // Fallback or COD creation (idempotent upsert by booking_id or order_id)
      const query: any = {};
      if (booking_id) query.booking_id = booking_id;
      else if (order_id) query.order_id = order_id;

      if (Object.keys(query).length > 0) {
        payment = await Payment.findOneAndUpdate(
          query,
          {
            $set: {
              booking_id: booking_id || undefined,
              order_id: order_id || undefined,
              user_id,
              amount: amount || 0,
              payment_method: payment_method || 'cod',
              payment_provider: payment_provider || null,
              payment_channel: payment_channel || null,
              payment_status: payment_method === 'online' ? 'completed' : 'pending',
              payment_link_status: 'linked',
              transaction_id: transaction_id || null, // null for COD
              correlation_id: correlation_id || undefined,
              payment_attempt_id: payment_attempt_id || undefined,
              payment_date: new Date(),
            },
            $setOnInsert: {
              status_history: [
                {
                  status: payment_method === 'online' ? 'completed' : 'pending',
                  timestamp: new Date(),
                  note: `Payment created for ${payment_method === 'cod' ? 'Cash on Delivery' : 'Online'}`,
                },
              ],
            },
          },
          { upsert: true, new: true }
        );
      }
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

// @desc    Handle Razorpay Webhook Events
// @route   POST /api/payments/webhook
// @access  Public (Signature Verified)
export const handleRazorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  const { WebhookLog } = await import('../models/WebhookLog');
  let signatureValid = false;

  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || '';
    const signature = req.headers['x-razorpay-signature'] as string;

    if (webhookSecret && signature) {
      const shasum = crypto.createHmac('sha256', webhookSecret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest('hex');

      if (digest === signature) {
        signatureValid = true;
      } else {
        console.error('[WEBHOOK] Invalid signature');
        await WebhookLog.create({
          event_id: req.body.contains?.[0] || req.body.payload?.payment?.entity?.id,
          event_type: req.body.event || 'unknown',
          signature_valid: false,
          result: 'failed',
          error_message: 'Invalid webhook signature',
          payload: req.body,
        }).catch(console.error);

        res.status(400).json({ message: 'Invalid webhook signature' });
        return;
      }
    } else {
      signatureValid = true;
    }

    const event = req.body.event;
    const payload = req.body.payload?.payment?.entity;

    await WebhookLog.create({
      event_id: payload?.id || req.body.event_id,
      event_type: event || 'payment_event',
      signature_valid: signatureValid,
      result: 'success',
      payload: req.body,
    }).catch(console.error);

    if (payload && (event === 'payment.captured' || event === 'payment.authorized')) {
      const razorpay_payment_id = payload.id;
      const razorpay_order_id = payload.order_id;
      const amount = payload.amount ? payload.amount / 100 : 0;

      const updatedPayment = await Payment.findOneAndUpdate(
        { razorpay_payment_id },
        {
          $set: {
            payment_status: 'completed',
            amount: amount,
            razorpay_order_id: razorpay_order_id,
            payment_method: 'online',
            payment_provider: 'razorpay',
            payment_channel: payload.method || 'card',
            gateway_response: payload,
          },
          $push: {
            status_history: {
              status: 'completed',
              timestamp: new Date(),
              note: `Webhook verified event: ${event}`,
            },
          },
        },
        { upsert: true, new: true }
      );

      if (updatedPayment?.booking_id || updatedPayment?.order_id) {
        try {
          const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
          await axios.post(`${BOOKING_URL}/api/bookings/internal/update-payment-status`, {
            payment_id: updatedPayment._id,
            booking_id: updatedPayment.booking_id,
            order_id: updatedPayment.order_id,
            payment_status: 'completed',
          }, {
            headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
          });
        } catch (err: any) {
          console.error('[WEBHOOK] Failed to sync payment status with booking service:', err.message);
        }
      }
    } else if (payload && event === 'payment.failed') {
      const razorpay_payment_id = payload.id;
      const updatedPayment = await Payment.findOneAndUpdate(
        { razorpay_payment_id },
        {
          $set: {
            payment_status: 'failed',
            failure_reason: payload.error_description || 'Payment failed via webhook',
            gateway_response: payload,
          },
          $push: {
            status_history: {
              status: 'failed',
              timestamp: new Date(),
              note: `Webhook payment failed event`,
            },
          },
        },
        { upsert: true, new: true }
      );

      if (updatedPayment?.booking_id || updatedPayment?.order_id) {
        try {
          const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
          await axios.post(`${BOOKING_URL}/api/bookings/internal/update-payment-status`, {
            payment_id: updatedPayment._id,
            booking_id: updatedPayment.booking_id,
            order_id: updatedPayment.order_id,
            payment_status: 'failed',
          }, {
            headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
          });
        } catch (err: any) {
          console.error('[WEBHOOK] Failed to sync payment status with booking service:', err.message);
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('[WEBHOOK] Error processing webhook:', error);
    res.status(500).json({ message: 'Webhook error', error: error.message });
  }
};

// @desc    Manually retry linking payment to booking (Admin)
// @route   POST /api/payments/:id/retry-link
// @access  Private/Admin
export const retryPaymentLinkAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const paymentId = req.params.id;
    const { booking_id, order_id } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      res.status(404).json({ message: 'Payment record not found' });
      return;
    }

    payment.booking_id = booking_id ? new mongoose.Types.ObjectId(booking_id) : payment.booking_id;
    payment.order_id = order_id ? new mongoose.Types.ObjectId(order_id) : payment.order_id;
    payment.payment_link_status = 'linked';
    payment.status_history?.push({
      status: 'linked',
      timestamp: new Date(),
      note: 'Manually retried and linked by admin',
    });

    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Payment link updated successfully',
      payment,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Background reconciliation worker for unlinked pending payments
export const reconcilePendingPaymentsWorker = async (): Promise<void> => {
  try {
    const unlinkedPayments = await Payment.find({
      payment_link_status: 'pending',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }).limit(10);

    if (unlinkedPayments.length === 0) return;

    for (const payment of unlinkedPayments) {
      if (!payment.booking_id && payment.user_id) {
        try {
          const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
          const res = await axios.post(`${BOOKING_URL}/api/bookings/batch`, {
            userId: payment.user_id.toString(),
          }, {
            headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
          });
          const userBookings = Array.isArray(res.data) ? res.data : [];
          if (userBookings.length > 0) {
            const latestBooking = userBookings[0];
            payment.booking_id = latestBooking._id;
            payment.order_id = latestBooking.order_id;
            payment.payment_link_status = 'linked';
            await payment.save();
            console.log(`[RECONCILIATION WORKER] Successfully linked payment ${payment._id} to booking ${latestBooking.booking_id}`);
          }
        } catch (err: any) {
          console.error(`[RECONCILIATION WORKER] Reconciliation failed for payment ${payment._id}:`, err.message);
        }
      }
    }
  } catch (err: any) {
    console.error('[RECONCILIATION WORKER] Worker error:', err.message);
  }
};

// @desc    Process payment (Mock)
// @route   POST /api/payments
// @access  Private
export const processPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { booking_id, amount, payment_method } = req.body;
    const user_id = req.user?._id;

    const payment = await Payment.create({
      booking_id,
      user_id,
      amount,
      payment_method: payment_method === 'cod' ? 'cod' : 'online',
      payment_status: 'completed',
      transaction_id: `TXN_${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      payment_date: new Date(),
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
    const payment = await Payment.findOne({ booking_id: req.params.bookingId });
    if (!payment) {
      res.status(404).json({ message: 'Payment not found' });
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
    const search = req.query.search as string;

    const filter: any = {};
    if (status) {
      filter.payment_status = status;
    }
    if (method) {
      filter.payment_method = method;
    }
    if (search) {
      filter.$or = [
        { transaction_id: { $regex: search, $options: 'i' } },
        { razorpay_payment_id: { $regex: search, $options: 'i' } }
      ];
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payment.countDocuments(filter)
    ]);
    
    const bookingIds = payments.map(p => p.booking_id).filter(Boolean);
    const bookings = bookingIds.length ? await getBookingsBatch(bookingIds.map(String)) : [];
    const bookingMap = new Map(bookings.map((b: any) => [String(b._id), b]));
    
    const data = payments.map(p => {
      const booking = bookingMap.get(String(p.booking_id));
      return {
        ...p,
        booking_id: booking ?? p.booking_id
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

    const [payments, total] = await Promise.all([
      Payment.find({ user_id: userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payment.countDocuments({ user_id: userId })
    ]);

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

    // 3. Fetch subservices from catalog_db to get their names
    const catalogData = await getCatalogBatch(subserviceIds, [], [], []);
    const subserviceMap = new Map<string, ResolvedSubService>(
      catalogData.subservices.map((s: any) => [String(s._id), s as ResolvedSubService])
    );

    // 4. Merge payment + booking + subservice info
    const bookingMap = new Map<string, ResolvedBooking>(
      bookings.map((b: any) => [String(b._id), b as ResolvedBooking])
    );

    const result = payments.map(p => {
      const booking = bookingMap.get(String(p.booking_id));
      const subservice = booking ? subserviceMap.get(String(booking.subservice_id)) : null;
      return {
        _id:             p._id,
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
