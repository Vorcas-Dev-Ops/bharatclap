import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { Refund } from '../models/Refund';
import { sendSuccess, sendError, ErrorCodes, logger, config } from '@bharatclap/shared';

const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:5005';
const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const internalKey = process.env.INTERNAL_SERVICE_KEY || config.internal.serviceKey;

export const handleRazorpayRefundWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || config.razorpay.webhookSecret;
    const signature = req.headers['x-razorpay-signature'] as string;

    // Verify webhook signature if secret configured
    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        logger.warn('Invalid Razorpay webhook signature', { action: 'WEBHOOK_SIGNATURE_MISMATCH' });
        sendError(res, 400, 'Invalid signature', ErrorCodes.PAYMENT_SIGNATURE_INVALID);
        return;
      }
    }

    const { event, payload } = req.body;
    logger.info('Razorpay webhook event received', {
      service: 'refund-service',
      action: 'RAZORPAY_WEBHOOK',
      metadata: { event }
    });

    if (event === 'refund.processed' || event === 'refund.speed_changed') {
      const refundEntity = payload?.refund?.entity;
      const gatewayRefundId = refundEntity?.id;
      const paymentId = refundEntity?.payment_id;

      if (gatewayRefundId) {
        const refund = await Refund.findOne({
          $or: [{ gatewayRefundId }, { razorpayPaymentId: paymentId }, { paymentId }]
        });

        if (refund) {
          refund.status = 'COMPLETED';
          refund.completedAt = new Date();
          refund.metadata = { ...(refund.metadata || {}), webhookPayload: payload };
          await refund.save();

          // Execute full DB synchronization across services
          await syncPostRefundState(refund);
        }
      }
    } else if (event === 'refund.failed') {
      const refundEntity = payload?.refund?.entity;
      const gatewayRefundId = refundEntity?.id;

      if (gatewayRefundId) {
        const refund = await Refund.findOne({ gatewayRefundId });
        if (refund) {
          refund.status = 'FAILED';
          refund.failedAt = new Date();
          refund.failureReason = refundEntity?.error_description || 'Refund failed at gateway';
          await refund.save();
        }
      }
    }

    sendSuccess(res, 200, 'Webhook processed successfully', { received: true });
  } catch (err) {
    next(err);
  }
};

// Full DB Synchronization post-refund
async function syncPostRefundState(refund: any): Promise<void> {
  const headers = { 'x-internal-service-key': internalKey };

  try {
    // 1. Sync Booking Status
    await axios.post(
      `${bookingServiceUrl}/api/bookings/internal/refund-sync`,
      {
        bookingId: refund.bookingId,
        refundId: refund._id,
        refundAmount: refund.refundAmount,
        refundType: refund.refundType,
        status: 'refunded'
      },
      { headers, timeout: 5000 }
    ).catch(err => logger.warn('Booking refund sync call failed', { metadata: { err: err?.message } }));

    // 2. Sync Payment Record Status
    await axios.post(
      `${paymentServiceUrl}/api/payments/internal/refund-sync`,
      {
        bookingId: refund.bookingId,
        refundId: refund._id,
        refundAmount: refund.refundAmount,
        status: refund.refundType === 'FULL' ? 'refunded' : 'partially_refunded'
      },
      { headers, timeout: 5000 }
    ).catch(err => logger.warn('Payment refund sync call failed', { metadata: { err: err?.message } }));

    // 3. Sync Provider Settlement / Clawback if settlement was already paid
    if (refund.providerId) {
      await axios.post(
        `${providerServiceUrl}/api/payouts/internal/refund-sync`,
        {
          providerId: refund.providerId,
          bookingId: refund.bookingId,
          refundAmount: refund.refundAmount,
          refundType: refund.refundType
        },
        { headers, timeout: 5000 }
      ).catch(err => logger.warn('Provider settlement refund sync call failed', { metadata: { err: err?.message } }));
    }

    logger.info('Post-refund DB state synchronization complete', {
      service: 'refund-service',
      action: 'POST_REFUND_SYNC_COMPLETE',
      bookingId: refund.bookingId.toString(),
      metadata: { refundId: refund._id }
    });
  } catch (err: any) {
    logger.error('Post-refund DB synchronization error', err, {
      service: 'refund-service',
      action: 'POST_REFUND_SYNC_ERROR',
      bookingId: refund.bookingId.toString()
    });
  }
}
