import { getDb } from '../config/db';
import axios from 'axios';

let pollerInterval: NodeJS.Timeout | null = null;

export const processCompensationOutbox = async (): Promise<void> => {
  try {
    const pool = getDb();
    // Atomic claiming with FOR UPDATE SKIP LOCKED prevents concurrent double-processing
    const tasksRes = await pool.query(
      `UPDATE provider.compensation_outbox
       SET status = 'PROCESSING',
           attempts = attempts + 1,
           updated_at = NOW()
       WHERE id IN (
         SELECT id FROM provider.compensation_outbox
         WHERE (status = 'PENDING' OR (status = 'PROCESSING' AND updated_at < NOW() - INTERVAL '5 minutes'))
           AND attempts < 5
         ORDER BY created_at ASC
         LIMIT 10
         FOR UPDATE SKIP LOCKED
       ) RETURNING *`
    );

    if (tasksRes.rows.length === 0) return;

    const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
    const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

    for (const task of tasksRes.rows) {
      const attempts = task.attempts;

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
