import { JobRequest } from '../models/JobRequest';
import { Provider } from '../models/Provider';
import { getBookingsBatch } from '../utils/internalApi';

let isReconciling = false;

/**
 * Periodically reconciles distributed state discrepancies:
 * 1. Stale pending JobRequests past expires_at -> transition to expired.
 * 2. Unassigned pending JobRequests on bookings already accepted -> transition to cancelled.
 * 3. Emits telemetry for operational triage.
 */
export const runDispatchReconciliation = async () => {
  if (isReconciling) return;
  isReconciling = true;

  try {
    const now = new Date();

    // 1. Repair expired pending JobRequests
    const staleRequests = await JobRequest.find({
      status: 'pending',
      expires_at: { $lt: now }
    }).limit(100);

    if (staleRequests.length > 0) {
      console.log(`[RECONCILIATION] Found ${staleRequests.length} stale pending JobRequests past expiry. Transitioning to expired.`);
      await JobRequest.updateMany(
        { _id: { $in: staleRequests.map(r => r._id) }, status: 'pending' },
        { $set: { status: 'expired', expired_at: now, expired_reason: 'timeout_reconciliation' } }
      );
    }

    // 2. Repair orphaned JobRequests for bookings already resolved/accepted
    const activeRequests = await JobRequest.find({ status: 'pending' }).limit(50).lean();
    if (activeRequests.length > 0) {
      const bookingIds = [...new Set(activeRequests.map(r => String(r.booking_id)))];
      const bookings = await getBookingsBatch(bookingIds).catch(() => []);

      const resolvedBookingsSet = new Set(
        bookings
          .filter((b: any) => b.status === 'accepted' || b.status === 'in_progress' || b.status === 'completed' || b.status === 'cancelled' || b.status === 'unassigned_timeout')
          .map((b: any) => String(b._id || b.booking_id))
      );

      const requestsToCancel = activeRequests.filter(r => resolvedBookingsSet.has(String(r.booking_id)));
      if (requestsToCancel.length > 0) {
        console.log(`[RECONCILIATION] Found ${requestsToCancel.length} orphaned pending JobRequests for resolved bookings. Transitioning to cancelled.`);
        await JobRequest.updateMany(
          { _id: { $in: requestsToCancel.map(r => r._id) }, status: 'pending' },
          { $set: { status: 'cancelled', expired_at: now, expired_reason: 'booking_already_resolved' } }
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
