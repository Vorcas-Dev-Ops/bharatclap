import Razorpay from 'razorpay';
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

    // Call Razorpay Refund API
    // Amount in paise (1 INR = 100 Paise)
    const amountInPaise = Money.toPaise(Money.from(refund.refundAmount));

    const razorpayResponse: any = await (razorpay.payments.refund(paymentId, {
      amount: amountInPaise,
      notes: {
        bookingId: refund.bookingId.toString(),
        idempotencyKey: refund.idempotencyKey,
        reason: refund.reason || 'Customer refund'
      }
    }) as any);

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
