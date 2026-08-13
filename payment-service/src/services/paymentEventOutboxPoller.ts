import os from 'os';
import { PaymentEventOutbox } from '../models/PaymentEventOutbox';
import { eventBus } from '@bharatclap/shared';

const MAX_ATTEMPTS = 10;
const LEASE_DURATION_MS = 30000;
const WORKER_ID = `${os.hostname()}:${process.pid}`;
let isProcessing = false;

export const processPaymentEventOutbox = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();
    const leaseExpiry = new Date(now.getTime() + LEASE_DURATION_MS);

    const pending = await PaymentEventOutbox.find({
      $or: [
        { status: 'PENDING', attempts: { $lt: MAX_ATTEMPTS } },
        { status: 'PROCESSING', lease_expires_at: { $lt: now }, attempts: { $lt: MAX_ATTEMPTS } },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(50);

    if (pending.length === 0) {
      isProcessing = false;
      return;
    }

    for (const entry of pending) {
      const claimed = await PaymentEventOutbox.findOneAndUpdate(
        {
          _id: entry._id,
          status: entry.status,
        },
        {
          $set: {
            status: 'PROCESSING',
            lease_owner: WORKER_ID,
            lease_expires_at: leaseExpiry,
            last_attempted_at: now,
          },
          $inc: { attempts: 1 },
        },
        { new: true }
      );

      if (!claimed) continue;

      try {
        const payloadObj = JSON.parse(claimed.payload);
        const publishedId = await eventBus.emit(claimed.event_type, payloadObj, {
          source: 'payment-service',
          traceId: claimed.event_id,
        });

        if (publishedId) {
          claimed.status = 'PUBLISHED';
          console.log(`[PAYMENT-EVENT-OUTBOX] ✅ Published ${claimed.event_type} (${claimed.event_id}) -> stream id ${publishedId}`);
        } else {
          claimed.status = claimed.attempts >= MAX_ATTEMPTS ? 'DLQ' : 'PENDING';
          claimed.error_message = 'eventBus.emit returned null';
        }
      } catch (err: any) {
        claimed.status = claimed.attempts >= MAX_ATTEMPTS ? 'DLQ' : 'PENDING';
        claimed.error_message = err.message;
        console.error(`[PAYMENT-EVENT-OUTBOX ERROR] Failed processing outbox entry ${claimed.event_id}:`, err.message);
      }

      await claimed.save();
    }
  } catch (err: any) {
    console.error('[PAYMENT-EVENT-OUTBOX POLLER ERROR]', err.message);
  } finally {
    isProcessing = false;
  }
};

export const triggerPaymentEventOutboxFlush = () => {
  setImmediate(() => {
    processPaymentEventOutbox().catch(err => console.error('[PAYMENT-EVENT-OUTBOX FLUSH ERROR]', err.message));
  });
};

export const startPaymentEventOutboxPoller = () => {
  setTimeout(processPaymentEventOutbox, 1000);
  const interval = setInterval(processPaymentEventOutbox, 1000);
  return interval;
};
