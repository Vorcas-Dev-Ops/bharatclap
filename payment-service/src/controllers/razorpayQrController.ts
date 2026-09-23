import { Request, Response } from 'express';
import crypto from 'crypto';
import { Money } from '@bharatclap/shared';
import razorpay from '../config/razorpay';
import { RazorpayQrRepository } from '../repositories/razorpayQrRepository';
import { PaymentRepository } from '../repositories/paymentRepository';
import { AuthRequest } from '../middleware/authMiddleware';
import { getBookingsBatch, sendNotification } from '../utils/internalApi';
import axios from 'axios';

// 1. Create Server-Authoritative Dynamic Amount-Specific Razorpay UPI QR
export const createRazorpayBookingQr = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { booking_id } = req.body;
    const user_id = req.user?._id;

    if (!user_id) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    if (!booking_id) {
      res.status(400).json({ message: 'Booking ID is required' });
      return;
    }

    // Fetch authoritative booking from booking-service
    const bookings = await getBookingsBatch([booking_id]);
    const targetBooking = bookings?.[0];

    if (!targetBooking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    // Verify customer owns booking
    const bookingUserId = targetBooking.user_id?._id || targetBooking.user_id || targetBooking.customer_id;
    if (bookingUserId && String(bookingUserId) !== String(user_id)) {
      res.status(403).json({ message: 'Forbidden: Not authorized for this booking' });
      return;
    }

    // Verify booking is unpaid
    if (targetBooking.payment_status === 'completed' || targetBooking.payment_status === 'paid' || targetBooking.status === 'completed') {
      res.status(409).json({ message: 'Booking has already been paid' });
      return;
    }

    // Read authoritative payable amount and convert to integer paise
    const rawPayableAmount = targetBooking.payable_amount ?? targetBooking.final_amount ?? targetBooking.service_price;
    if (!rawPayableAmount || rawPayableAmount <= 0) {
      res.status(400).json({ message: 'Invalid authoritative booking payable amount' });
      return;
    }

    const payableMoney = Money.from(rawPayableAmount);
    const amountPaise = Money.toPaise(payableMoney);

    // Check existing active PENDING QR for this booking
    const existingActiveQr = await RazorpayQrRepository.findActiveByBookingId(booking_id);

    if (existingActiveQr) {
      if (new Date() > new Date(existingActiveQr.expires_at)) {
        await RazorpayQrRepository.updateQr(existingActiveQr.id, {
          status: 'EXPIRED',
          auditEntry: {
            status: 'EXPIRED',
            timestamp: new Date().toISOString(),
            note: 'Application TTL expiry reached',
          },
        });
      } else if (existingActiveQr.amount_paise === amountPaise) {
        res.status(200).json({
          payment_id: existingActiveQr._id,
          razorpay_qr_id: existingActiveQr.razorpay_qr_id,
          booking_id: existingActiveQr.booking_id,
          amount_paise: existingActiveQr.amount_paise,
          display_amount_rupees: (existingActiveQr.amount_paise / 100).toFixed(2),
          currency: existingActiveQr.currency,
          status: existingActiveQr.status,
          qr_payload: existingActiveQr.qr_payload,
          expires_at: existingActiveQr.expires_at,
          reused: true,
        });
        return;
      } else {
        await RazorpayQrRepository.updateQr(existingActiveQr.id, {
          status: 'EXPIRED',
          auditEntry: {
            status: 'EXPIRED',
            timestamp: new Date().toISOString(),
            note: 'Invalidated due to booking payable amount modification',
          },
        });
      }
    }

    // 16-minute expiry buffer
    const expiresAt = new Date(Date.now() + 16 * 60 * 1000);
    const closeByEpochSeconds = Math.floor(expiresAt.getTime() / 1000);

    const bookingCode = targetBooking.booking_id || String(booking_id).slice(-6).toUpperCase();

    const rzpQr = await razorpay.qrCode.create({
      type: 'upi_qr',
      name: `Booking ${bookingCode}`,
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: amountPaise,
      close_by: closeByEpochSeconds,
      description: `Payment for BharatClap Booking #${bookingCode}`,
      notes: {
        booking_id: String(booking_id),
        customer_id: String(user_id),
      },
    } as any);

    const razorpayQrId: string = rzpQr.id;
    const qrPayload: string = (rzpQr as any).image_url || (rzpQr as any).image || (rzpQr as any).payload;

    const qrRecord = await RazorpayQrRepository.createQr({
      providerId: targetBooking.provider_id || String(user_id),
      bookingId: booking_id,
      razorpayQrId,
      amountPaise,
      currency: 'INR',
      status: 'PENDING',
      qrPayload,
      expiresAt,
      auditTrail: [
        {
          status: 'PENDING',
          timestamp: new Date().toISOString(),
          note: 'Server-authoritative Razorpay UPI QR generated',
        },
      ],
      notes: {
        booking_id: String(booking_id),
        customer_id: String(user_id),
      },
    });

    res.status(201).json({
      payment_id: qrRecord._id,
      razorpay_qr_id: qrRecord.razorpay_qr_id,
      booking_id: qrRecord.booking_id,
      amount_paise: qrRecord.amount_paise,
      display_amount_rupees: (qrRecord.amount_paise / 100).toFixed(2),
      currency: qrRecord.currency,
      status: qrRecord.status,
      qr_payload: qrRecord.qr_payload,
      expires_at: qrRecord.expires_at,
    });
  } catch (error: any) {
    console.error('[RAZORPAY QR] Create QR error:', error?.response?.data || error?.message || error);
    res.status(500).json({
      message: 'Failed creating Razorpay UPI QR',
      error: error?.response?.data?.error?.description || error?.message,
      razorpay_error: error?.response?.data || undefined,
    });
  }
};

// 2. Poll Razorpay QR Payment Status (UX Polling Endpoint)
export const getRazorpayQrStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;

    const qrRecord = await RazorpayQrRepository.findActiveByBookingId(bookingId);
    if (!qrRecord) {
      res.status(404).json({ message: 'No payment QR found for this booking' });
      return;
    }

    // Application-controlled TTL expiry check
    if (qrRecord.status === 'PENDING' && new Date() > new Date(qrRecord.expires_at)) {
      await RazorpayQrRepository.updateQr(qrRecord.id, {
        status: 'EXPIRED',
        auditEntry: {
          status: 'EXPIRED',
          timestamp: new Date().toISOString(),
          note: 'Application TTL expiry check',
        },
      });
      qrRecord.status = 'EXPIRED';
    }

    res.status(200).json({
      payment_id: qrRecord._id,
      booking_id: qrRecord.booking_id,
      status: qrRecord.status,
      amount_paise: qrRecord.amount_paise,
      display_amount_rupees: (qrRecord.amount_paise / 100).toFixed(2),
      razorpay_qr_id: qrRecord.razorpay_qr_id,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed fetching QR status', error: error?.message });
  }
};

// 3. Authoritative Razorpay Webhook Handler (qr_code.credited)
export const handleRazorpayQrWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    const signature = req.headers['x-razorpay-signature'] as string;
    const eventIdHeader = (req.headers['x-razorpay-event-id'] as string) || req.body?.event_id || req.body?.payload?.payment?.entity?.id;

    if (!webhookSecret) {
      console.error('[WEBHOOK SECURITY] RAZORPAY_WEBHOOK_SECRET is not configured on server');
      res.status(500).json({ message: 'Webhook misconfigured' });
      return;
    }

    if (!signature) {
      console.warn('[WEBHOOK SECURITY] Webhook received without signature header');
      res.status(400).json({ message: 'Missing webhook signature' });
      return;
    }

    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      console.error('[WEBHOOK SECURITY] Raw body unavailable for QR webhook verification');
      res.status(400).json({ message: 'Raw body required for webhook verification' });
      return;
    }

    // 1. Raw Body HMAC-SHA256 Constant-Time Signature Verification
    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature, 'utf8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      console.warn('[WEBHOOK SECURITY] Signature verification failed on Razorpay QR webhook');
      if (eventIdHeader) {
        await PaymentRepository.upsertWebhookLog({
          eventId: eventIdHeader,
          eventType: req.body?.event || 'unknown',
          signatureValid: false,
          payload: req.body,
        }).catch(() => {});
      }

      res.status(400).json({ message: 'Invalid webhook signature' });
      return;
    }

    // 2. Webhook Event ID Idempotency Check
    if (eventIdHeader) {
      const { isDuplicate } = await PaymentRepository.upsertWebhookLog({
        eventId: eventIdHeader,
        eventType: req.body?.event || 'qr_event',
        signatureValid: true,
        payload: req.body,
      });

      if (isDuplicate) {
        console.log(`[WEBHOOK IDEMPOTENCY] Event ${eventIdHeader} already processed. Returning 200 OK.`);
        res.status(200).json({ success: true, message: 'Event already processed' });
        return;
      }
    }

    const event = req.body.event;
    const qrEntity = req.body.payload?.qr_code?.entity;
    const paymentEntity = req.body.payload?.payment?.entity;

    // Process qr_code.credited or payment.captured
    if (event === 'qr_code.credited' || event === 'payment.captured' || event === 'payment_link.paid') {
      const razorpayQrId = qrEntity?.id || paymentEntity?.notes?.razorpay_qr_id;
      const razorpayPaymentId = paymentEntity?.id || `pay_${Date.now()}`;
      const creditedAmountPaise = parseInt(String(paymentEntity?.amount || qrEntity?.payment_amount || 0), 10);

      // 3. QR ID Pinning: Key lookup by razorpay_qr_id
      let qrRecord = razorpayQrId ? await RazorpayQrRepository.findByRazorpayQrId(razorpayQrId) : null;

      if (!qrRecord && paymentEntity?.notes?.booking_id) {
        qrRecord = await RazorpayQrRepository.findActiveByBookingId(paymentEntity.notes.booking_id);
      }

      if (!qrRecord) {
        console.warn('[WEBHOOK WARNING] No matching RazorpayPaymentQr record found for QR ID:', razorpayQrId);
        res.status(200).json({ message: 'Webhook received but no matching pending QR record found' });
        return;
      }

      // 4. Amount Integrity & Reconciliation Check
      if (creditedAmountPaise !== qrRecord.amount_paise) {
        console.error('[SECURITY MISMATCH] Credited amount does not match expected QR amount_paise:', {
          creditedAmountPaise,
          expectedAmountPaise: qrRecord.amount_paise,
          razorpayQrId,
        });

        await RazorpayQrRepository.updateQr(qrRecord.id, {
          status: 'MISMATCH',
          auditEntry: {
            status: 'MISMATCH',
            timestamp: new Date().toISOString(),
            note: `Amount mismatch: Credited ${creditedAmountPaise} paise vs Expected ${qrRecord.amount_paise} paise`,
          },
        });

        res.status(400).json({ message: 'Amount mismatch reconciliation failure' });
        return;
      }

      // 5. Successful Payment Verification Transition
      await RazorpayQrRepository.updateQr(qrRecord.id, {
        status: 'PAID',
        auditEntry: {
          status: 'PAID',
          timestamp: new Date().toISOString(),
          note: `Payment verified via webhook event ${event}`,
        },
      });

      // Upsert Payment entry in PostgreSQL
      const payment = await PaymentRepository.upsertPaymentByRazorpayPaymentId({
        razorpayPaymentId,
        bookingId: qrRecord.booking_id,
        userId: qrRecord.provider_id,
        amount: qrRecord.amount_paise / 100,
        paymentMethod: 'online',
        paymentStatus: 'Captured',
        note: `Payment verified via webhook ${event}`,
      });

      // 6. Reliable Outbox Synchronization to Booking Service
      try {
        const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
        await axios.post(`${BOOKING_URL}/api/bookings/internal/update-payment-status`, {
          booking_id: qrRecord.booking_id,
          payment_id: payment._id,
          payment_status: 'completed',
          payment_method: 'PROVIDER_UPI',
          razorpay_qr_id: qrRecord.razorpay_qr_id,
        });
        console.log(`[BOOKING SYNC] Successfully synced PAID status for booking ${qrRecord.booking_id}`);
      } catch (syncErr: any) {
        console.error('[BOOKING SYNC ERROR] Failed syncing booking payment status:', syncErr?.message);
      }

      if (eventIdHeader) {
        await PaymentRepository.updateWebhookResult(eventIdHeader, 'success');
      }

      // Notify customer
      sendNotification(
        qrRecord.provider_id,
        'Payment Successful',
        `Your payment of ₹${(qrRecord.amount_paise / 100).toFixed(2)} for booking has been verified.`,
        'payment_alert',
        { booking_id: qrRecord.booking_id }
      ).catch(() => {});
    }

    res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (error: any) {
    console.error('[WEBHOOK ERROR] Webhook handling error:', error);
    res.status(500).json({ message: 'Webhook processing failed', error: error?.message });
  }
};

// 4. Admin Finance QR Reconciliation Table Endpoint
export const getAdminQrReconciliation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const { qrs, total } = await RazorpayQrRepository.findAll({
      page: pageNum,
      limit: limitNum,
    });

    sendSuccess(res, 200, 'Admin Razorpay QR reconciliation retrieved', {
      records: qrs.map((r) => ({
        ...r,
        display_amount_rupees: (r.amount_paise / 100).toFixed(2),
        reconciliation_status: r.status === 'PAID' ? 'MATCHED' : r.status === 'MISMATCH' ? 'MISMATCH' : r.status,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed fetching reconciliation records', error: error?.message });
  }
};

function sendSuccess(res: Response, status: number, message: string, data: any) {
  res.status(status).json({ success: true, message, data });
}
