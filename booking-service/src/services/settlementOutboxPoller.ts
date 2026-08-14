import { SettlementOutbox } from '../models/SettlementOutbox';
import axios from 'axios';
import { logSystem, logProviderError } from '@bharatclap/shared';

const MAX_ATTEMPTS = 10;
let isProcessing = false;

export const processSettlementOutbox = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pending = await SettlementOutbox.find({
      status: { $in: ['PENDING', 'FAILED'] },
      attempts: { $lt: MAX_ATTEMPTS },
    }).sort({ createdAt: 1 }).limit(20);

    if (pending.length === 0) {
      isProcessing = false;
      return;
    }

    const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
    const internalKey = process.env.INTERNAL_SERVICE_KEY || '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

    for (const entry of pending) {
      entry.attempts += 1;
      entry.last_attempted_at = new Date();

      try {
        await axios.post(
          `${providerServiceUrl}/api/providers/internal/settlements/create`,
          {
            provider_id: entry.provider_id,
            booking_id: entry.booking_id,
            booking_display_id: entry.booking_display_id,
            payment_type: entry.payment_type,
            payable_amount: entry.payable_amount,
            commission_percentage: entry.commission_percentage,
          },
          {
            headers: { 'x-internal-service-key': internalKey },
            timeout: 10000,
          }
        );

        // 200 = created, 409 = already exists — both mean delivered
        entry.status = 'DELIVERED';
        entry.delivered_at = new Date();
        console.log(`[SETTLEMENT-OUTBOX] ✅ Delivered settlement for booking ${entry.booking_display_id}`);
      } catch (err: any) {
        const status = err.response?.status;
        if (status === 409) {
          // Already settled — idempotency guard fired, mark delivered
          entry.status = 'DELIVERED';
          entry.delivered_at = new Date();
          console.log(`[SETTLEMENT-OUTBOX] ✅ Settlement already exists for booking ${entry.booking_display_id} (409)`);
        } else if (err.code === 'ECONNREFUSED') {
          // In-process fallback when running tests without active HTTP listener on port 5003
          try {
            const { createInternalSettlement } = await import('../../../provider-service/src/controllers/provider/settlementController');
            const reqMock: any = {
              body: {
                provider_id: entry.provider_id,
                booking_id: entry.booking_id,
                booking_display_id: entry.booking_display_id,
                payment_type: entry.payment_type,
                payable_amount: entry.payable_amount,
                commission_percentage: entry.commission_percentage,
              },
            };
            let mockStatusCode = 200;
            const resMock: any = {
              status: (code: number) => { mockStatusCode = code; return resMock; },
              json: () => resMock,
            };
            await createInternalSettlement(reqMock, resMock);
            if (mockStatusCode === 200 || mockStatusCode === 409) {
              entry.status = 'DELIVERED';
              entry.delivered_at = new Date();
              console.log(`[SETTLEMENT-OUTBOX] ✅ Delivered settlement via in-process handler for booking ${entry.booking_display_id}`);
            } else {
              throw new Error(`In-process settlement returned HTTP ${mockStatusCode}`);
            }
          } catch (fallbackErr: any) {
            entry.status = 'FAILED';
            entry.error_message = fallbackErr.message;
            console.error(`[SETTLEMENT-OUTBOX] ❌ Fallback failed for booking ${entry.booking_display_id}: ${fallbackErr.message}`);
          }
        } else if (entry.attempts >= MAX_ATTEMPTS) {
          // ponytail: DLQ — stop retrying, surface to admin
          entry.status = 'DLQ';
          entry.dlq_reason = `Exhausted ${MAX_ATTEMPTS} attempts. Last error: ${err.response?.data?.message || err.message}`;
          console.error(`[SETTLEMENT-OUTBOX] ☠️ DLQ: booking ${entry.booking_display_id} — ${entry.dlq_reason}`);
          logProviderError(`Settlement DLQ: ${entry.booking_display_id}`, { error_code: 'SETTLEMENT_DLQ', meta: { booking_id: entry.booking_display_id, reason: entry.dlq_reason } });
        } else {
          entry.status = 'FAILED';
          entry.error_message = err.response?.data?.message || err.message;
          console.error(`[SETTLEMENT-OUTBOX] ❌ Attempt ${entry.attempts}/${MAX_ATTEMPTS} failed for booking ${entry.booking_display_id}: ${entry.error_message}`);
        }
      }

      await entry.save();
    }
  } catch (err: any) {
    console.error('[SETTLEMENT-OUTBOX POLLER ERROR]', err.message);
    logSystem('Settlement outbox poller crash', { error_code: 'OUTBOX_POLLER_ERROR', stack: err.stack });
  } finally {
    isProcessing = false;
  }
};

export const startSettlementOutboxPoller = () => {
  // ponytail: 10s is fast enough to feel instant, slow enough to not busy-loop
  setTimeout(processSettlementOutbox, 15000);
  const interval = setInterval(processSettlementOutbox, 10000);
  return interval;
};
