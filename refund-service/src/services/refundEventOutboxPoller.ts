import axios from 'axios';
import { getDb } from '../config/db';
import { logger, getInternalServiceKey } from '@bharatclap/shared';

const MAX_ATTEMPTS = 10;
let isProcessing = false;

const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:5005';
const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';

/**
 * Refund Event Outbox Poller (Defect J fix)
 *
 * Polls payment.refund_event_outbox for pending/partial events and
 * dispatches to downstream services. Each service sync is tracked
 * independently; partial delivery retries only the failed targets.
 *
 * Idempotency: each downstream endpoint must be safe to call > 1 time
 * for the same refund_event_id.
 */
export const processRefundEventOutbox = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pool = getDb();
    const internalKey = getInternalServiceKey();
    const headers = { 'x-internal-service-key': internalKey };

    const pending = await pool.query(
      `UPDATE payment.refund_event_outbox
       SET status = 'PROCESSING', attempts = attempts + 1, updated_at = NOW()
       WHERE id IN (
         SELECT id FROM payment.refund_event_outbox
         WHERE status IN ('PENDING', 'PARTIAL')
           AND attempts < $1
         ORDER BY created_at
         LIMIT 10
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [MAX_ATTEMPTS]
    );

    for (const entry of pending.rows) {
      const eventPayload = {
        refund_event_id: entry.refund_event_id,
        refund_id: String(entry.refund_id),
        booking_id: entry.booking_id ? String(entry.booking_id) : null,
        payment_id: entry.payment_id ? String(entry.payment_id) : null,
        provider_id: entry.provider_id ? String(entry.provider_id) : null,
        gateway_refund_id: entry.gateway_refund_id,
        refund_amount: Number(entry.refund_amount),
        refund_type: entry.refund_type,
        event_type: entry.event_type,
        occurred_at: entry.created_at
      };

      let bookingSynced = entry.booking_synced;
      let paymentSynced = entry.payment_synced;
      let providerSynced = entry.provider_synced;
      const errors: string[] = [];

      // 1. Booking sync
      if (!bookingSynced && entry.booking_id) {
        try {
          await axios.post(
            `${bookingServiceUrl}/api/bookings/internal/refund-sync`,
            eventPayload,
            { headers, timeout: 5000 }
          );
          bookingSynced = true;
        } catch (err: any) {
          errors.push(`booking: ${err.message}`);
        }
      }

      // 2. Payment sync
      if (!paymentSynced && entry.payment_id) {
        try {
          await axios.post(
            `${paymentServiceUrl}/api/payments/internal/refund-sync`,
            eventPayload,
            { headers, timeout: 5000 }
          );
          paymentSynced = true;
        } catch (err: any) {
          errors.push(`payment: ${err.message}`);
        }
      }

      // 3. Provider/settlement sync (Defect K: settlement race handling)
      if (!providerSynced && entry.provider_id) {
        try {
          await axios.post(
            `${providerServiceUrl}/api/payouts/internal/refund-sync`,
            eventPayload,
            { headers, timeout: 5000 }
          );
          providerSynced = true;
        } catch (err: any) {
          errors.push(`provider: ${err.message}`);
        }
      }

      // Determine final status
      const allSynced = bookingSynced && paymentSynced && providerSynced;
      const anySynced = bookingSynced || paymentSynced || providerSynced;
      let newStatus: string;

      if (allSynced) {
        newStatus = 'COMPLETED';
      } else if (entry.attempts >= MAX_ATTEMPTS) {
        newStatus = 'DLQ';
        logger.error('Refund event DLQ', {
          service: 'refund-service',
          action: 'REFUND_EVENT_DLQ',
          metadata: { refund_event_id: entry.refund_event_id, errors }
        });
      } else if (anySynced) {
        newStatus = 'PARTIAL';
      } else {
        newStatus = 'PENDING';
      }

      await pool.query(
        `UPDATE payment.refund_event_outbox
         SET booking_synced = $1, payment_synced = $2, provider_synced = $3,
             status = $4, last_error = $5, updated_at = NOW()
         WHERE id = $6`,
        [bookingSynced, paymentSynced, providerSynced, newStatus, errors.join('; ') || null, entry.id]
      );

      if (allSynced) {
        logger.info('Refund event fully synced', {
          service: 'refund-service',
          action: 'REFUND_EVENT_SYNCED',
          metadata: { refund_event_id: entry.refund_event_id }
        });
      }
    }
  } catch (err: any) {
    logger.error('Refund event outbox poller error', err, {
      service: 'refund-service',
      action: 'REFUND_OUTBOX_POLLER_ERROR'
    });
  } finally {
    isProcessing = false;
  }
};

export const startRefundEventOutboxPoller = () => {
  setTimeout(processRefundEventOutbox, 5000);
  const interval = setInterval(processRefundEventOutbox, 15000);
  return interval;
};
