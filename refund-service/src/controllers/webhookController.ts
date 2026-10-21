import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { getDb } from '../config/db';
import { sendSuccess, sendError, ErrorCodes, logger, config, getInternalServiceKey } from '@bharatclap/shared';

const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:5005';
const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const internalKey = getInternalServiceKey();

export const handleRazorpayRefundWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || config.razorpay.webhookSecret;
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!webhookSecret) {
      logger.error('RAZORPAY_WEBHOOK_SECRET is not configured on refund service');
      sendError(res, 500, 'Webhook processing misconfigured', ErrorCodes.INTERNAL_ERROR);
      return;
    }

    if (!signature) {
      logger.warn('Refund webhook received without signature header', { action: 'WEBHOOK_SIGNATURE_MISSING' });
      sendError(res, 400, 'Missing webhook signature', ErrorCodes.PAYMENT_SIGNATURE_INVALID);
      return;
    }

    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      logger.error('Raw body unavailable for refund webhook verification');
      sendError(res, 400, 'Raw body required for webhook verification', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      logger.warn('Invalid Razorpay refund webhook signature', { action: 'WEBHOOK_SIGNATURE_MISMATCH' });
      sendError(res, 400, 'Invalid signature', ErrorCodes.PAYMENT_SIGNATURE_INVALID);
      return;
    }

    const { event, payload } = req.body;
    logger.info('Razorpay webhook event received', {
      service: 'refund-service',
      action: 'RAZORPAY_WEBHOOK',
      metadata: { event }
    });

    const pool = getDb();

    if (event === 'refund.processed' || event === 'refund.speed_changed') {
      const refundEntity = payload?.refund?.entity;
      const gatewayRefundId = refundEntity?.id;
      const paymentId = refundEntity?.payment_id;

      if (gatewayRefundId) {
        // Atomic: update refund + create outbox event in one transaction
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const updateRes = await client.query(
            `UPDATE payment.refunds
             SET status = 'COMPLETED',
                 processed_at = NOW(),
                 gateway_response = $1,
                 updated_at = NOW()
             WHERE gateway_refund_id = $2
                OR gateway_response->>'razorpayPaymentId' = $3
             RETURNING *`,
            [JSON.stringify(payload), gatewayRefundId, paymentId]
          );

          if (updateRes.rows[0]) {
            const refund = updateRes.rows[0];
            const refundEventId = `refund_event_${refund.id}_${gatewayRefundId}`;

            // Durable outbox — survives downstream failures, retry-safe (Defect J fix)
            await client.query(
              `INSERT INTO payment.refund_event_outbox (
                 refund_event_id, refund_id, booking_id, payment_id, provider_id,
                 gateway_refund_id, refund_amount, refund_type, event_type, status
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
               ON CONFLICT (refund_event_id) DO NOTHING`,
              [
                refundEventId,
                refund.id,
                refund.booking_id,
                refund.payment_id || null,
                refund.provider_id || null,
                gatewayRefundId,
                Number(refund.refund_amount),
                refund.refund_type || 'full',
                event
              ]
            );
          }

          await client.query('COMMIT');
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        } finally {
          client.release();
        }
      }
    } else if (event === 'refund.failed') {
      const refundEntity = payload?.refund?.entity;
      const gatewayRefundId = refundEntity?.id;

      if (gatewayRefundId) {
        await pool.query(
          `UPDATE payment.refunds
           SET status = 'FAILED',
               gateway_response = $1,
               updated_at = NOW()
           WHERE gateway_refund_id = $2`,
          [JSON.stringify(payload), gatewayRefundId]
        );
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
    const refundEventId = `refund_event_${refund.id}_${Date.now()}`;
    const syncPayload = {
      refund_event_id: refundEventId,
      refundEventId: refundEventId,
      booking_id: refund.bookingId || refund.booking_id,
      bookingId: refund.bookingId || refund.booking_id,
      refund_id: refund.id,
      refundId: refund.id,
      payment_id: refund.paymentId || refund.payment_id,
      paymentId: refund.paymentId || refund.payment_id,
      provider_id: refund.providerId || refund.provider_id,
      providerId: refund.providerId || refund.provider_id,
      refund_amount: refund.refundAmount || refund.refund_amount,
      refundAmount: refund.refundAmount || refund.refund_amount,
      refund_type: refund.refundType || refund.refund_type || 'full',
      refundType: refund.refundType || refund.refund_type || 'full',
      status: 'refunded'
    };

    // 1. Sync Booking Status
    await axios.post(
      `${bookingServiceUrl}/api/bookings/internal/refund-sync`,
      syncPayload,
      { headers, timeout: 5000 }
    ).catch(err => logger.warn('Booking refund sync call failed', { metadata: { err: err?.message } }));

    // 2. Sync Payment Record Status
    await axios.post(
      `${paymentServiceUrl}/api/payments/internal/refund-sync`,
      syncPayload,
      { headers, timeout: 5000 }
    ).catch(err => logger.warn('Payment refund sync call failed', { metadata: { err: err?.message } }));

    // 3. Sync Provider Settlement / Clawback if settlement was already paid
    if (refund.providerId || refund.provider_id) {
      await axios.post(
        `${providerServiceUrl}/api/payouts/internal/refund-sync`,
        syncPayload,
        { headers, timeout: 5000 }
      ).catch(err => logger.warn('Provider settlement refund sync call failed', { metadata: { err: err?.message } }));
    }

    logger.info('Post-refund DB state synchronization complete', {
      service: 'refund-service',
      action: 'POST_REFUND_SYNC_COMPLETE',
      bookingId: String(refund.bookingId),
      metadata: { refundId: refund.id }
    });
  } catch (err: any) {
    logger.error('Post-refund DB synchronization error', err, {
      service: 'refund-service',
      action: 'POST_REFUND_SYNC_ERROR',
      bookingId: String(refund.bookingId)
    });
  }
}
