import axios from 'axios';
import { getInternalServiceKey } from '@bharatclap/shared';
import { OutboxRepository } from '../repositories/outboxRepository';
import { getDb } from '../config/db';

let isProcessing = false;

export const processLeadRefundOutbox = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pending = await OutboxRepository.fetchPendingLeadRefunds(20);
    if (pending.length === 0) {
      isProcessing = false;
      return;
    }

    const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
    const internalKey = getInternalServiceKey();
    const db = getDb();

    for (const entry of pending) {
      try {
        const response = await axios.post(
          `${providerServiceUrl}/api/providers/internal/lead-refund`,
          {
            booking_id: String(entry.booking_id),
            provider_id: String(entry.provider_id),
            booking_stage: 'cancelled',
            cancelled_by: 'customer',
          },
          {
            headers: {
              'x-internal-service-key': internalKey,
              'x-idempotency-key': `refund_${entry.booking_id}`,
              'x-correlation-id': String(entry.booking_id),
            },
            timeout: 5000,
          }
        );

        if (response.data?.success) {
          await OutboxRepository.markLeadRefundPublished(entry.id);
          console.log(`[OUTBOX] Successfully processed lead refund outbox entry for booking ${entry.booking_id}`);
        } else {
          await db.query(
            `UPDATE booking.lead_refund_outbox SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
            [entry.id]
          );
        }
      } catch (err: any) {
        await db.query(
          `UPDATE booking.lead_refund_outbox SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
          [entry.id]
        );
        console.error(`[OUTBOX ERROR] Failed processing outbox entry ${entry.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[OUTBOX POLLER ERROR]', err.message);
  } finally {
    isProcessing = false;
  }
};

export const startLeadRefundOutboxPoller = () => {
  setTimeout(processLeadRefundOutbox, 10000);
  const interval = setInterval(processLeadRefundOutbox, 30000);
  return interval;
};
