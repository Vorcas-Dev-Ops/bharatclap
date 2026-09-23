import os from 'os';
import { PaymentRepository } from '../repositories/paymentRepository';
import { eventBus } from '@bharatclap/shared';

const MAX_ATTEMPTS = 10;
let isProcessing = false;

export const processPaymentEventOutbox = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pending = await PaymentRepository.findPendingOutboxEvents(MAX_ATTEMPTS, 50);

    if (pending.length === 0) {
      isProcessing = false;
      return;
    }

    for (const entry of pending) {
      const claimed = await PaymentRepository.claimOutboxEvent(entry.id);
      if (!claimed) continue;

      try {
        const payloadObj = typeof entry.payload === 'string' ? JSON.parse(entry.payload) : entry.payload;
        const publishedId = await eventBus.emit(entry.event_type, payloadObj, {
          source: 'payment-service',
          traceId: entry.event_id,
        });

        if (publishedId) {
          await PaymentRepository.updateOutboxStatus(entry.id, 'PUBLISHED');
          console.log(`[PAYMENT-EVENT-OUTBOX] ✅ Published ${entry.event_type} (${entry.event_id}) -> stream id ${publishedId}`);
        } else {
          const nextStatus = (entry.attempts + 1) >= MAX_ATTEMPTS ? 'DLQ' : 'PENDING';
          await PaymentRepository.updateOutboxStatus(entry.id, nextStatus);
          if (nextStatus === 'DLQ') {
            await PaymentRepository.moveToDlq(entry.event_id, 'eventBus.emit returned null', payloadObj);
          }
        }
      } catch (err: any) {
        const nextStatus = (entry.attempts + 1) >= MAX_ATTEMPTS ? 'DLQ' : 'PENDING';
        await PaymentRepository.updateOutboxStatus(entry.id, nextStatus);
        if (nextStatus === 'DLQ') {
          const payloadObj = typeof entry.payload === 'string' ? JSON.parse(entry.payload) : entry.payload;
          await PaymentRepository.moveToDlq(entry.event_id, err.message, payloadObj);
        }
        console.error(`[PAYMENT-EVENT-OUTBOX ERROR] Failed processing outbox entry ${entry.event_id}:`, err.message);
      }
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
