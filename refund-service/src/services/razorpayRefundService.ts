import Razorpay from 'razorpay';
import { Refund, IRefund } from '../models/Refund';
import { config, logger, BusinessError, ErrorCodes } from '@bharatclap/shared';

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || config.razorpay.keyId || 'rzp_test_mock';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || config.razorpay.keySecret || 'mock_secret';

const razorpay = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret
});

export const processRazorpayRefund = async (refundId: string): Promise<IRefund> => {
  const refund = await Refund.findById(refundId);
  if (!refund) {
    throw new BusinessError('Refund record not found', ErrorCodes.REFUND_NOT_ELIGIBLE);
  }

  if (refund.status === 'COMPLETED' || refund.status === 'PENDING_GATEWAY') {
    return refund;
  }

  const paymentId = refund.razorpayPaymentId || refund.paymentId;
  if (!paymentId) {
    throw new BusinessError('No Razorpay payment ID associated with refund', ErrorCodes.PAYMENT_NOT_FOUND);
  }

  try {
    refund.status = 'PROCESSING';
    refund.payoutAttempts += 1;
    await refund.save();

    // Call Razorpay Refund API
    // Amount in paise (1 INR = 100 Paise)
    const amountInPaise = Math.round(refund.refundAmount * 100);
    const speed = (refund.refundSpeed === 'normal' ? 'normal' : 'optimum') as 'optimum' | 'normal';

    const razorpayResponse: any = await (razorpay.payments.refund(paymentId, {
      amount: amountInPaise,
      speed,
      notes: {
        bookingId: refund.bookingId.toString(),
        idempotencyKey: refund.idempotencyKey,
        reason: refund.reason
      }
    }) as any);

    refund.gatewayRefundId = razorpayResponse.id;
    refund.status = 'PENDING_GATEWAY';
    refund.processedAt = new Date();
    refund.metadata = { ...(refund.metadata || {}), razorpayResponse };
    await refund.save();

    logger.info('Razorpay refund initiated successfully', {
      service: 'refund-service',
      action: 'RAZORPAY_REFUND_INITIATED',
      bookingId: refund.bookingId.toString(),
      metadata: {
        refundId: refund._id,
        gatewayRefundId: razorpayResponse.id,
        amount: refund.refundAmount
      }
    });

    return refund;
  } catch (err: any) {
    refund.status = 'FAILED';
    refund.failedAt = new Date();
    refund.failureReason = err?.message || 'Razorpay Refund API error';
    await refund.save();

    logger.error('Razorpay refund initiation failed', err, {
      service: 'refund-service',
      action: 'RAZORPAY_REFUND_FAILED',
      bookingId: refund.bookingId.toString(),
      metadata: { refundId: refund._id }
    });

    throw new BusinessError(`Razorpay Refund failed: ${err?.message || 'Gateway error'}`, ErrorCodes.INTERNAL_ERROR);
  }
};
