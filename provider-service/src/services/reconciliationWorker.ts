import { getDb } from '../config/db';
import { getBookingsBatch } from '../utils/internalApi';

let isReconciling = false;

/**
 * Periodically reconciles distributed state discrepancies:
 * 1. Stale pending JobRequests past expires_at -> transition to expired.
 * 2. Unassigned pending JobRequests on bookings already accepted -> transition to cancelled.
 */
export const runDispatchReconciliation = async () => {
  if (isReconciling) return;
  isReconciling = true;

  try {
    const pool = getDb();

    // 1. Repair expired pending JobRequests
    const expireRes = await pool.query(
      `UPDATE provider.job_requests
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'pending' AND expires_at < NOW()
       RETURNING id`
    );

    if (expireRes.rowCount && expireRes.rowCount > 0) {
      console.log(`[RECONCILIATION] Transitioned ${expireRes.rowCount} stale pending JobRequests to expired.`);
    }

    // 2. Repair orphaned JobRequests for bookings already resolved/accepted
    const activeRes = await pool.query(
      `SELECT id, booking_id FROM provider.job_requests WHERE status = 'pending' LIMIT 50`
    );

    if (activeRes.rowCount && activeRes.rowCount > 0) {
      const activeRequests = activeRes.rows;
      const bookingIds = [...new Set(activeRequests.map(r => String(r.booking_id)))];
      const bookings = await getBookingsBatch(bookingIds).catch(() => []);

      const resolvedBookingsSet = new Set(
        bookings
          .filter((b: any) => b.status === 'accepted' || b.status === 'in_progress' || b.status === 'completed' || b.status === 'cancelled' || b.status === 'unassigned_timeout')
          .map((b: any) => String(b._id || b.booking_id))
      );

      const requestsToCancel = activeRequests.filter(r => resolvedBookingsSet.has(String(r.booking_id)));
      if (requestsToCancel.length > 0) {
        const cancelIds = requestsToCancel.map(r => r.id);
        console.log(`[RECONCILIATION] Found ${cancelIds.length} orphaned pending JobRequests. Transitioning to cancelled.`);
        await pool.query(
          `UPDATE provider.job_requests
           SET status = 'cancelled', updated_at = NOW()
           WHERE id = ANY($1)`,
          [cancelIds]
        );
      }
    }
  } catch (err: any) {
    console.error(`[RECONCILIATION ERROR] Failed dispatch reconciliation run: ${err.message}`);
  } finally {
    isReconciling = false;
  }
};

/**
 * Starts the background reconciliation poller.
 */
export const startReconciliationWorker = (intervalMs: number = 45000): NodeJS.Timeout => {
  console.log(`[WORKER] 🔄 Dispatch Reconciliation Worker started (running every ${intervalMs / 1000}s)`);
  return setInterval(runDispatchReconciliation, intervalMs);
};
