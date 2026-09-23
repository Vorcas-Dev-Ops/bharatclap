import axios from 'axios';
import { logProviderError, getInternalServiceKey } from '@bharatclap/shared';
import { OutboxRepository } from '../repositories/outboxRepository';
import { getDb } from '../config/db';

const MAX_ATTEMPTS = 10;
let isProcessing = false;

export const processSettlementOutbox = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pending = await OutboxRepository.fetchPendingSettlements(20);
    if (pending.length === 0) {
      isProcessing = false;
      return;
    }

    const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
    const internalKey = getInternalServiceKey();
    const db = getDb();

    for (const entry of pending) {
      try {
        // Fetch booking display ID if needed
        const bRes = await db.query(
          `SELECT booking_id, commission_percentage, payable_amount, payment_method FROM booking.bookings WHERE id = $1`,
          [entry.booking_id]
        );
        const booking = bRes.rows[0];

        await axios.post(
          `${providerServiceUrl}/api/providers/internal/settlements/create`,
          {
            provider_id: String(entry.provider_id),
            booking_id: String(entry.booking_id),
            booking_display_id: booking?.booking_id || String(entry.booking_id),
            payment_type: booking?.payment_method === 'cod' ? 'cod' : 'online',
            payable_amount: parseFloat(entry.amount || booking?.payable_amount || 0),
            commission_percentage: parseFloat(booking?.commission_percentage || 15),
          },
          {
            headers: { 'x-internal-service-key': internalKey },
            timeout: 10000,
          }
        );

        await OutboxRepository.markSettlementPublished(entry.id);
        console.log(`[SETTLEMENT-OUTBOX] ✅ Delivered settlement for booking ${entry.booking_id}`);
      } catch (err: any) {
        const status = err.response?.status;
        if (status === 409) {
          await OutboxRepository.markSettlementPublished(entry.id);
          console.log(`[SETTLEMENT-OUTBOX] ✅ Settlement already exists for booking ${entry.booking_id} (409)`);
        } else if (entry.attempts >= MAX_ATTEMPTS) {
          await db.query(
            `UPDATE booking.settlement_outbox SET status = 'DLQ', updated_at = NOW() WHERE id = $1`,
            [entry.id]
          );
          console.error(`[SETTLEMENT-OUTBOX] ☠️ DLQ: booking ${entry.booking_id}`);
          logProviderError(`Settlement DLQ: ${entry.booking_id}`, { error_code: 'SETTLEMENT_DLQ', meta: { booking_id: entry.booking_id } });
        } else {
          await OutboxRepository.markSettlementFailed(entry.id);
          console.error(`[SETTLEMENT-OUTBOX] ❌ Attempt ${entry.attempts}/${MAX_ATTEMPTS} failed for booking ${entry.booking_id}: ${err.message}`);
        }
      }
    }
  } catch (err: any) {
    console.error('[SETTLEMENT-OUTBOX POLLER ERROR]', err.message);
  } finally {
    isProcessing = false;
  }
};

export const startSettlementOutboxPoller = () => {
  setTimeout(processSettlementOutbox, 5000);
  const interval = setInterval(processSettlementOutbox, 15000);
  return interval;
};
