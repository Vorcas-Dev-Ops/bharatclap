import axios from 'axios';
import mongoose, { Schema } from 'mongoose';
import { ProviderSettlement } from '../models/ProviderSettlement';

// ponytail: single-doc cursor for incremental reconciliation. No new file — inline model.
const reconCursorSchema = new Schema({
  _id: { type: String, default: 'settlement_recon' },
  last_reconciled_at: { type: Date, default: new Date(0) },
}, { timestamps: true });
const ReconCursor = mongoose.models.ReconCursor || mongoose.model('ReconCursor', reconCursorSchema);

const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
const INTERNAL_KEY = () => process.env.INTERNAL_SERVICE_KEY || '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';
const RECON_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Incremental reconciliation: fetches completed bookings since last cursor,
 * checks which ones are missing ProviderSettlement records, and creates them.
 *
 * Idempotent: booking_id has a unique index on ProviderSettlement,
 * and createInternalSettlement checks for duplicates (returns 409).
 */
export const reconcileMissingSettlements = async () => {
  const cursor = await ReconCursor.findById('settlement_recon') || await ReconCursor.create({ _id: 'settlement_recon' });
  const since = cursor.last_reconciled_at?.toISOString() || '';
  const runStartedAt = new Date();

  console.log(`[SETTLEMENT-RECONCILIATION] Starting incremental reconciliation (since: ${since || 'epoch'})...`);

  try {
    // ponytail: pass ?since= for incremental; omit for full scan on first run
    const url = since
      ? `${BOOKING_SERVICE_URL}/api/bookings/internal/completed-unsettled?since=${since}`
      : `${BOOKING_SERVICE_URL}/api/bookings/internal/completed-unsettled`;

    const { data: completedBookings } = await axios.get(url, {
      headers: { 'x-internal-service-key': INTERNAL_KEY() },
      timeout: 15000,
    });

    if (!Array.isArray(completedBookings) || completedBookings.length === 0) {
      console.log('[SETTLEMENT-RECONCILIATION] No new completed bookings since last run. ✅');
      cursor.last_reconciled_at = runStartedAt;
      await cursor.save();
      return { total: 0, missing: 0, recovered: 0, failed: 0 };
    }

    // Check which bookings already have settlements
    const bookingIds = completedBookings.map((b: any) => b.booking_id);
    const existingSettlements = await ProviderSettlement.find(
      { booking_id: { $in: bookingIds } },
      { booking_id: 1 }
    ).lean();
    const settledSet = new Set(existingSettlements.map((s: any) => String(s.booking_id)));

    const missing = completedBookings.filter((b: any) => !settledSet.has(String(b.booking_id)));

    if (missing.length === 0) {
      console.log(`[SETTLEMENT-RECONCILIATION] All ${completedBookings.length} bookings have settlements. ✅`);
      cursor.last_reconciled_at = runStartedAt;
      await cursor.save();
      return { total: completedBookings.length, missing: 0, recovered: 0, failed: 0 };
    }

    console.log(`[SETTLEMENT-RECONCILIATION] Found ${missing.length} missing settlement(s) out of ${completedBookings.length} bookings.`);

    const SELF_URL = `http://127.0.0.1:${process.env.PORT || 5003}`;
    let recovered = 0;
    let failed = 0;

    for (const booking of missing) {
      try {
        await axios.post(
          `${SELF_URL}/api/providers/internal/settlements/create`,
          {
            provider_id: booking.provider_id,
            booking_id: booking.booking_id,
            booking_display_id: booking.booking_display_id,
            payment_type: booking.payment_type,
            payable_amount: booking.payable_amount,
            commission_percentage: booking.commission_percentage,
            service_name: booking.service_name,
            variant_name: booking.variant_name,
          },
          { headers: { 'x-internal-service-key': INTERNAL_KEY() }, timeout: 10000 }
        );
        recovered++;
        console.log(`[SETTLEMENT-RECONCILIATION] [AUDIT: SETTLEMENT_RECONCILED] booking=${booking.booking_display_id} provider=${booking.provider_id} at=${new Date().toISOString()}`);
      } catch (err: any) {
        if (err.response?.status === 409) {
          console.log(`[SETTLEMENT-RECONCILIATION] Already exists for ${booking.booking_display_id} (409)`);
        } else {
          failed++;
          console.error(`[SETTLEMENT-RECONCILIATION] Failed for ${booking.booking_display_id}: ${err.response?.data?.message || err.message}`);
        }
      }
    }

    // Advance cursor only on successful run
    cursor.last_reconciled_at = runStartedAt;
    await cursor.save();

    const result = { total: completedBookings.length, missing: missing.length, recovered, failed };
    console.log(`[SETTLEMENT-RECONCILIATION] Done. Recovered: ${recovered} | Failed: ${failed}`);
    return result;
  } catch (err: any) {
    console.error('[SETTLEMENT-RECONCILIATION] Reconciliation failed:', err.message);
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      throw err; // Let startup retry handle connection failures
    }
    return { total: 0, missing: 0, recovered: 0, failed: 0, error: err.message };
  }
};

/**
 * Health-gated startup + hourly interval.
 * ponytail: startup retries until booking-service responds, then schedules hourly.
 */
export const startSettlementReconciliation = () => {
  const checkAndRun = async (attempt = 1): Promise<void> => {
    try {
      await reconcileMissingSettlements();
      // Startup succeeded — schedule hourly repeating reconciliation
      console.log(`[SETTLEMENT-RECONCILIATION] Scheduled hourly incremental reconciliation.`);
      setInterval(() => {
        reconcileMissingSettlements().catch(err =>
          console.error('[SETTLEMENT-RECONCILIATION] Hourly run failed:', err.message)
        );
      }, RECON_INTERVAL_MS);
    } catch {
      if (attempt < 10) {
        const delay = attempt * 5000;
        console.log(`[SETTLEMENT-RECONCILIATION] Booking service not ready (attempt ${attempt}), retrying in ${delay / 1000}s...`);
        setTimeout(() => checkAndRun(attempt + 1), delay);
      } else {
        console.error('[SETTLEMENT-RECONCILIATION] Booking service unreachable after 10 attempts. Scheduling hourly anyway.');
        setInterval(() => {
          reconcileMissingSettlements().catch(err =>
            console.error('[SETTLEMENT-RECONCILIATION] Hourly run failed:', err.message)
          );
        }, RECON_INTERVAL_MS);
      }
    }
  };

  // Start 30s after server boot
  setTimeout(() => checkAndRun(), 30000);
};
