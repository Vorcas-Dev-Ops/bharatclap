import { Request, Response } from 'express';
import { Refund } from '../models/Refund';
import axios from 'axios';

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:5002';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

// ponytail: controlled refund reasons — don't allow arbitrary strings
const VALID_REFUND_REASONS = [
  'PROVIDER_SEARCH_TIMEOUT',
  'MAX_REDISPATCH_EXCEEDED',
  'ADMIN_CANCELLATION',
] as const;
type RefundReason = typeof VALID_REFUND_REASONS[number];

/**
 * Internal idempotent refund evaluation.
 * Called by booking-service when a booking times out.
 *
 * Flow:
 *   1. Validate reason (controlled enum)
 *   2. Check idempotency (booking_id + reason)
 *   3. Query payment-service for authoritative payment status
 *   4. If captured/paid → create Refund record as REQUESTED
 *   5. Reconciliation cron picks up REQUESTED → processRazorpayRefund → Razorpay
 *   6. If not captured → no-op
 *
 * CRITICAL: payment-service failure ≠ "no payment"
 *   404 from payment-service → no payment → no refund
 *   5xx / timeout → return 502, let caller retry
 */
export const evaluateRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { booking_id, reason } = req.body;
    if (!booking_id || !reason) {
      res.status(400).json({ message: 'booking_id and reason are required' });
      return;
    }

    if (!VALID_REFUND_REASONS.includes(reason as RefundReason)) {
      res.status(400).json({
        message: `Invalid refund reason. Must be one of: ${VALID_REFUND_REASONS.join(', ')}`
      });
      return;
    }

    const idempotencyKey = (req.headers['x-idempotency-key'] as string)
      || `${booking_id}:${reason}`;

    // Idempotency: if record already exists, return it
    const existing = await Refund.findOne({ bookingId: booking_id, idempotencyKey });
    if (existing) {
      res.json({ action: 'already_exists', refund: existing });
      return;
    }

    // Query payment-service for authoritative payment status
    // CRITICAL: Do NOT silently treat service errors as "no payment"
    let payment: any = null;
    let paymentFound = false;
    try {
      const payRes = await axios.get(
        `${PAYMENT_SERVICE_URL}/api/payments/booking/${booking_id}`,
        {
          headers: { 'x-internal-service-key': INTERNAL_KEY },
          timeout: 10_000
        }
      );
      payment = payRes.data?.data || payRes.data;
      paymentFound = true;
    } catch (err: any) {
      if (err.response?.status === 404) {
        // payment-service explicitly said: no payment exists → COD / unpaid
        paymentFound = false;
      } else {
        // Network error, timeout, 5xx → DO NOT assume "no payment"
        res.status(502).json({
          message: 'Payment service unavailable. Cannot evaluate refund. Will retry.',
          error: err.message
        });
        return;
      }
    }

    // Only refund if payment was actually captured/paid
    const capturedStatuses = ['completed', 'paid', 'captured'];
    if (!paymentFound || !payment || !capturedStatuses.includes(payment.payment_status)) {
      res.json({ action: 'no_refund_needed', reason: 'payment_not_captured' });
      return;
    }

    // ponytail: refundAmount from authoritative payment record (captured amount), not booking amount
    const refund = await Refund.create({
      bookingId: booking_id,
      paymentId: payment._id?.toString(),
      razorpayPaymentId: payment.razorpay_payment_id || payment.gateway_payment_id,
      customerId: payment.user_id,
      refundAmount: payment.amount, // captured payment amount — source of truth
      refundType: 'FULL',
      reason,
      status: 'REQUESTED', // NOT PENDING_GATEWAY — processRazorpayRefund returns early for that
      idempotencyKey,
      requestedAt: new Date(),
      payoutAttempts: 0,
      maxPayoutAttempts: 3,
    });

    res.json({ action: 'refund_created', refund });
  } catch (error: any) {
    // Handle duplicate key (race on idempotency)
    if (error.code === 11000) {
      const existing = await Refund.findOne({
        bookingId: req.body.booking_id,
        idempotencyKey: (req.headers['x-idempotency-key'] as string)
          || `${req.body.booking_id}:${req.body.reason}`
      });
      res.json({ action: 'already_exists', refund: existing });
      return;
    }
    res.status(500).json({ message: error.message });
  }
};
