import { CompensationOutbox } from '../models/CompensationOutbox';
import axios from 'axios';

let pollerInterval: NodeJS.Timeout | null = null;

export const processCompensationOutbox = async (): Promise<void> => {
  try {
    const pendingTasks = await CompensationOutbox.find({
      status: { $in: ['PENDING', 'PROCESSING'] },
      attempts: { $lt: 5 },
    }).limit(10);

    if (pendingTasks.length === 0) return;

    const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
    const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

    for (const task of pendingTasks) {
      task.attempts += 1;
      task.status = 'PROCESSING';
      await task.save();

      try {
        if (task.action === 'UNASSIGN_COMPENSATION') {
          await axios.put(
            `${BOOKING_URL}/api/bookings/internal/${task.bookingId}/unassign`,
            {
              provider_id: task.providerId,
              reason: `Compensating unassign worker retry (attempt ${task.attempts})`
            },
            {
              headers: { 'x-internal-service-key': INTERNAL_KEY },
              timeout: 5000
            }
          );
        }

        task.status = 'COMPLETED';
        await task.save();
        console.log(`[COMPENSATION WORKER] ✅ Successfully executed compensation task for booking ${task.bookingId}`);
      } catch (err: any) {
        task.lastError = err.message;
        task.status = task.attempts >= task.maxAttempts ? 'FAILED' : 'PENDING';
        await task.save();
        console.warn(`[COMPENSATION WORKER] ⚠️ Compensation retry failed for booking ${task.bookingId}: ${err.message}`);
      }
    }
  } catch (error: any) {
    console.error('[COMPENSATION WORKER ERROR]', error.message);
  }
};

export const startCompensationWorker = () => {
  if (pollerInterval) return;
  console.log('[COMPENSATION WORKER] 🚀 Initialized 15-second Compensation Poller');
  pollerInterval = setInterval(processCompensationOutbox, 15000);
};

export const stopCompensationWorker = () => {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
  }
};
