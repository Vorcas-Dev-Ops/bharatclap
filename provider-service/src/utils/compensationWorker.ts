import { getDb } from '../config/db';
import axios from 'axios';

let pollerInterval: NodeJS.Timeout | null = null;

export const processCompensationOutbox = async (): Promise<void> => {
  try {
    const pool = getDb();
    const tasksRes = await pool.query(
      `SELECT * FROM provider.compensation_outbox
       WHERE status IN ('PENDING', 'PROCESSING')
         AND attempts < 5
       LIMIT 10`
    );

    if (tasksRes.rows.length === 0) return;

    const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
    const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

    for (const task of tasksRes.rows) {
      const attempts = task.attempts + 1;
      await pool.query(
        `UPDATE provider.compensation_outbox SET attempts = $1, status = 'PROCESSING', updated_at = NOW() WHERE id = $2`,
        [attempts, task.id]
      );

      try {
        if (task.compensation_type === 'UNASSIGN_COMPENSATION' || task.compensation_type === 'unassign') {
          await axios.put(
            `${BOOKING_URL}/api/bookings/internal/${task.booking_id}/unassign`,
            {
              provider_id: task.provider_id,
              reason: `Compensating unassign worker retry (attempt ${attempts})`
            },
            {
              headers: { 'x-internal-service-key': INTERNAL_KEY },
              timeout: 5000
            }
          );
        }

        await pool.query(
          `UPDATE provider.compensation_outbox SET status = 'PUBLISHED', updated_at = NOW() WHERE id = $1`,
          [task.id]
        );
        console.log(`[COMPENSATION WORKER] ✅ Successfully executed compensation task for booking ${task.booking_id}`);
      } catch (err: any) {
        const nextStatus = attempts >= 5 ? 'DLQ' : 'PENDING';
        await pool.query(
          `UPDATE provider.compensation_outbox SET status = $1, updated_at = NOW() WHERE id = $2`,
          [nextStatus, task.id]
        );
        console.warn(`[COMPENSATION WORKER] ⚠️ Compensation retry failed for booking ${task.booking_id}: ${err.message}`);
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
