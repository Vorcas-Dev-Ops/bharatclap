import { getDb } from '../config/db';
import { getBookingsBatch } from '../utils/internalApi';
import { releaseHoldForBooking } from './leadHoldService';

let isReconciling = false;

/**
 * Periodically reconciles distributed state discrepancies:
 * 1. Stale pending JobRequests past expires_at -> transition to expired.
 * 2. Unassigned pending JobRequests on bookings already accepted -> transition to cancelled.
 * 3. Stale-GPS providers -> set is_online = FALSE.
 * 4. Orphaned wallet holds for expired/rejected job requests -> release.
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
       RETURNING id, provider_id, booking_id`
    );

    if (expireRes.rowCount && expireRes.rowCount > 0) {
      console.log(`[RECONCILIATION] Transitioned ${expireRes.rowCount} stale pending JobRequests to expired.`);
      // Release wallet holds for these expired requests
      for (const row of expireRes.rows) {
        await releaseHoldForBooking(String(row.provider_id), String(row.booking_id)).catch(e =>
          console.warn(`[RECONCILIATION] Hold release failed for expired JR ${row.id}: ${e.message}`)
        );
      }
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

    // 3. Mark stale-GPS providers offline — second safeguard beyond findNearby filter
    let gpsStaleMinutes = 5;
    try {
      const cfgRes = await pool.query('SELECT settings FROM provider.dispatch_settings LIMIT 1');
      const cfg = cfgRes.rows[0]?.settings || {};
      if (typeof cfg.gpsStaleMinutes === 'number') gpsStaleMinutes = cfg.gpsStaleMinutes;
    } catch (_) {}

    const staleRes = await pool.query(
      `UPDATE provider.providers
       SET is_online = FALSE,
           availability_status = 'offline',
           updated_at = NOW()
       WHERE is_online = TRUE
         AND live_location_updated_at IS NOT NULL
         AND live_location_updated_at < NOW() - (INTERVAL '1 minute' * $1)
       RETURNING id`,
      [gpsStaleMinutes]
    );

    if (staleRes.rowCount && staleRes.rowCount > 0) {
      console.log(`[RECONCILIATION] Set ${staleRes.rowCount} stale-GPS provider(s) offline (>${gpsStaleMinutes}min since last location).`);
    }

    // 4. Release orphaned wallet holds for rejected/expired job requests
    // ponytail: catches any holds that slipped through individual reject/expire handlers
    const orphanHolds = await pool.query(
      `SELECT DISTINCT wt.provider_id, wt.reference_id AS booking_id
       FROM provider.wallet_transactions wt
       WHERE wt.type = 'hold'
         AND wt.reference_type = 'booking_lead_fee'
         AND NOT EXISTS (
           SELECT 1 FROM provider.wallet_transactions wt2
           WHERE wt2.provider_id = wt.provider_id
             AND wt2.reference_id = wt.reference_id
             AND wt2.type IN ('release', 'deduction')
         )
         AND NOT EXISTS (
           SELECT 1 FROM provider.job_requests jr
           WHERE jr.booking_id::text = wt.reference_id
             AND jr.provider_id::text = wt.provider_id::text
             AND jr.status = 'pending'
         )
         AND wt.created_at < NOW() - INTERVAL '10 minutes'
       LIMIT 20`
    );

    for (const row of orphanHolds.rows) {
      await releaseHoldForBooking(String(row.provider_id), String(row.booking_id)).catch(e =>
        console.warn(`[RECONCILIATION] Orphan hold release failed: ${e.message}`)
      );
    }
    if (orphanHolds.rows.length > 0) {
      console.log(`[RECONCILIATION] Released ${orphanHolds.rows.length} orphaned wallet hold(s).`);
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
