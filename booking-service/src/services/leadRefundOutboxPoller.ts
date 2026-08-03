import { LeadRefundOutbox } from '../models/LeadRefundOutbox';
import axios from 'axios';

let isProcessing = false;

export const processLeadRefundOutbox = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pendingOutboxEntries = await LeadRefundOutbox.find({
      status: { $in: ['PENDING', 'FAILED'] },
      attempts: { $lt: 10 },
    }).sort({ createdAt: 1 }).limit(20);

    if (pendingOutboxEntries.length === 0) {
      isProcessing = false;
      return;
    }

    const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
    const internalKey = process.env.INTERNAL_SERVICE_KEY || '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

    for (const entry of pendingOutboxEntries) {
      entry.attempts += 1;
      entry.last_attempted_at = new Date();

      try {
        const response = await axios.post(
          `${providerServiceUrl}/api/providers/internal/lead-refund`,
          {
            booking_id: entry.booking_id,
            provider_id: entry.provider_id,
            booking_stage: entry.booking_stage,
            cancelled_by: entry.cancelled_by,
          },
          {
            headers: {
              'x-internal-service-key': internalKey,
              'x-idempotency-key': entry.idempotency_key,
              'x-correlation-id': entry.correlation_id || String(entry.booking_id),
            },
            timeout: 5000,
          }
        );

        if (response.data?.success) {
          entry.status = 'CONFIRMED';
          console.log(`[OUTBOX] Successfully processed lead refund outbox entry for booking ${entry.booking_id}`);
        } else {
          entry.status = 'FAILED';
          entry.error_message = response.data?.message || 'Refund refused or non-eligible';
        }
      } catch (err: any) {
        entry.status = 'FAILED';
        entry.error_message = err.response?.data?.message || err.message;
        console.error(`[OUTBOX ERROR] Failed processing outbox entry ${entry._id}:`, entry.error_message);
      }

      await entry.save();
    }
  } catch (err: any) {
    console.error('[OUTBOX POLLER ERROR]', err.message);
  } finally {
    isProcessing = false;
  }
};

export const startLeadRefundOutboxPoller = () => {
  // Run 10s after startup, then every 30 seconds
  setTimeout(processLeadRefundOutbox, 10000);
  const interval = setInterval(processLeadRefundOutbox, 30000);
  return interval;
};
