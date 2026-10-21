import Razorpay from 'razorpay';
import axios from 'axios';
import { RefundRepository, RefundEntity } from '../repositories/refundRepository';
import { config, logger, BusinessError, ErrorCodes, Money } from '@bharatclap/shared';

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || config.razorpay.keyId || 'rzp_test_mock';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || config.razorpay.keySecret || 'mock_secret';

const razorpay = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret
});

export const processRazorpayRefund = async (refundId: string): Promise<RefundEntity> => {
  const refund = await RefundRepository.findById(refundId);
  if (!refund) {
    throw new BusinessError('Refund record not found', ErrorCodes.REFUND_NOT_ELIGIBLE);
  }

  if (refund.status === 'COMPLETED' || refund.status === 'PENDING_GATEWAY') {
    return refund;
  }

  const paymentId = refund.metadata?.razorpayPaymentId || refund.metadata?.paymentId || refund.gateway_refund_id;
  if (!paymentId) {
    throw new BusinessError('No Razorpay payment ID associated with refund', ErrorCodes.PAYMENT_NOT_FOUND);
  }

  try {
    await RefundRepository.updateStatus(refund.id, 'PROCESSING');

    // Amount in paise (1 INR = 100 Paise)
    const amountInPaise = Money.toPaise(Money.from(refund.refundAmount));
    // UUID (36 chars) fits within Razorpay 40-char receipt limit with zero truncation/collision risk
    const refundReceipt = String(refund.id);
    const authHeader = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
    const TIMEOUT_MS = 15_000;

    // ponytail: paginated refund search — Razorpay paginates this endpoint
    // ceiling: linear scan over all refunds for the payment; fine for typical <100 refunds per payment
    const findExistingRefund = async (paymentId: string, receipt: string, idempotencyKey?: string) => {
      let skip = 0;
      const pageSize = 25;
      let hasMore = true;
      while (hasMore) {
        const res = await axios.get(
          `https://api.razorpay.com/v1/payments/${paymentId}/refunds?count=${pageSize}&skip=${skip}`,
          { headers: { Authorization: `Basic ${authHeader}` }, timeout: TIMEOUT_MS }
        );
        const items = res.data?.items || [];
        const match = items.find((r: any) =>
          r.receipt === receipt ||
          (idempotencyKey && r.notes?.idempotencyKey === idempotencyKey)
        );
        if (match) return match;
        hasMore = items.length === pageSize;
        skip += items.length;
      }
      return null;
    };

    let razorpayResponse: any = null;

    // Check if refund already exists on Razorpay for this payment
    try {
      razorpayResponse = await findExistingRefund(paymentId, refundReceipt, refund.idempotencyKey);
    } catch {
      // Continue to create if check fails or returns 404
    }

    if (!razorpayResponse) {
      try {
        const createRes = await axios.post(
          `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
          {
            amount: amountInPaise,
            receipt: refundReceipt,
            notes: {
              bookingId: refund.bookingId.toString(),
              idempotencyKey: refund.idempotencyKey,
              reason: refund.reason || 'Customer refund'
            }
          },
          {
            headers: {
              Authorization: `Basic ${authHeader}`,
              'Content-Type': 'application/json',
              'X-Refund-Idempotency': refundReceipt
            },
            timeout: TIMEOUT_MS
          }
        );
        razorpayResponse = createRes.data;
      } catch (postErr: any) {
        // If Razorpay reports duplicate receipt or conflict, recover the existing refund object
        if (postErr.response?.data?.error?.description?.includes('Duplicate receipt') || postErr.response?.status === 409) {
          razorpayResponse = await findExistingRefund(paymentId, refundReceipt);
          if (!razorpayResponse) {
            throw postErr;
          }
        } else {
          throw postErr;
        }
      }
    }

    const updated = await RefundRepository.updateStatus(refund.id, 'PENDING_GATEWAY', {
      gatewayRefundId: razorpayResponse.id,
      metadata: { ...(refund.metadata || {}), razorpayResponse },
      processedAt: new Date()
    });

    logger.info('Razorpay refund initiated successfully', {
      service: 'refund-service',
      action: 'RAZORPAY_REFUND_INITIATED',
      bookingId: refund.bookingId.toString(),
      metadata: {
        refundId: refund.id,
        gatewayRefundId: razorpayResponse.id,
        amount: refund.refundAmount
      }
    });

    return updated || refund;
  } catch (err: any) {
    await RefundRepository.updateStatus(refund.id, 'FAILED', {
      metadata: { ...(refund.metadata || {}), failureReason: err?.message || 'Razorpay Refund API error' }
    });

    logger.error('Razorpay refund initiation failed', err, {
      service: 'refund-service',
      action: 'RAZORPAY_REFUND_FAILED',
      bookingId: refund.bookingId.toString(),
      metadata: { refundId: refund.id }
    });

    throw new BusinessError(`Razorpay Refund failed: ${err?.message || 'Gateway error'}`, ErrorCodes.INTERNAL_ERROR);
  }
};
