import { OutboxRepository } from '../repositories/outboxRepository';
import { eventBus } from '@bharatclap/shared';

let isProcessing = false;

export const processEventOutbox = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pending = await OutboxRepository.fetchPendingEvents(50);
    if (pending.length === 0) {
      isProcessing = false;
      return;
    }

    for (const entry of pending) {
      try {
        const payloadObj = typeof entry.payload === 'string' ? JSON.parse(entry.payload) : entry.payload;
        const publishedId = await eventBus.emit(entry.event_type, payloadObj, {
          source: 'booking-service',
          traceId: entry.event_id,
        });

        if (publishedId) {
          await OutboxRepository.markEventPublished(entry.id);
          console.log(`[EVENT-OUTBOX] ✅ Published ${entry.event_type} (${entry.event_id}) -> stream id ${publishedId}`);
        } else {
          await OutboxRepository.markEventFailed(entry.id, 'eventBus.emit returned null');
        }
      } catch (err: any) {
        await OutboxRepository.markEventFailed(entry.id, err.message);
        console.error(`[EVENT-OUTBOX ERROR] Failed processing outbox entry ${entry.event_id}:`, err.message);
      }
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
