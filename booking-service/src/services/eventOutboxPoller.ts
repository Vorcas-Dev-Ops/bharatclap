import os from 'os';
import { EventOutbox } from '../models/EventOutbox';
import { eventBus } from '@bharatclap/shared';

const MAX_ATTEMPTS = 10;
const LEASE_DURATION_MS = 30000;
const WORKER_ID = `${os.hostname()}:${process.pid}`;
let isProcessing = false;

export const processEventOutbox = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();
    const leaseExpiry = new Date(now.getTime() + LEASE_DURATION_MS);

    // Find pending events or events with expired leases
    const pending = await EventOutbox.find({
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
      // Atomic claim
      const claimed = await EventOutbox.findOneAndUpdate(
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

      if (!claimed) continue; // Claimed by another instance

      try {
        const payloadObj = JSON.parse(claimed.payload);
        const publishedId = await eventBus.emit(claimed.event_type, payloadObj, {
          source: 'booking-service',
          traceId: claimed.event_id,
        });

        if (publishedId) {
          claimed.status = 'PUBLISHED';
          console.log(`[EVENT-OUTBOX] ✅ Published ${claimed.event_type} (${claimed.event_id}) -> stream id ${publishedId}`);
        } else {
          claimed.status = claimed.attempts >= MAX_ATTEMPTS ? 'DLQ' : 'PENDING';
          claimed.error_message = 'eventBus.emit returned null';
        }
      } catch (err: any) {
        claimed.status = claimed.attempts >= MAX_ATTEMPTS ? 'DLQ' : 'PENDING';
        claimed.error_message = err.message;
        console.error(`[EVENT-OUTBOX ERROR] Failed processing outbox entry ${claimed.event_id}:`, err.message);
      }

      await claimed.save();
    }
  } catch (err: any) {
    console.error('[EVENT-OUTBOX POLLER ERROR]', err.message);
  } finally {
    isProcessing = false;
  }
};

export const triggerEventOutboxFlush = () => {
  setImmediate(() => {
    processEventOutbox().catch(err => console.error('[EVENT-OUTBOX FLUSH ERROR]', err.message));
  });
};

export const startEventOutboxPoller = () => {
  setTimeout(processEventOutbox, 1000);
  const interval = setInterval(processEventOutbox, 1000);
  return interval;
};
