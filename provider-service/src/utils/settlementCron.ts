import { getDb } from '../config/db';
import { batchProcessSettlements, reconcileStuckPayouts, MAX_PAYOUT_ATTEMPTS } from '../services/batchSettlementProcessor';
import { sendAdminNotification } from './internalApi';

export const startSettlementCron = async () => {
  const envHours = process.env.SETTLEMENT_CRON_INTERVAL_HOURS;
  let intervalHours = Number(envHours) || 4;

  const intervalMs = intervalHours * 60 * 60 * 1000;

  const runSettlementAudit = async () => {
    try {
      console.log('[SETTLEMENT-CRON] Payout batch and COD audit started...');
      const now = new Date();
      const pool = getDb();

      // Fetch dynamic settlement hold and COD remit thresholds from dispatch_settings
      let holdDays = 3;
      let codRemitDays = 3;
      try {
        const cfgRes = await pool.query('SELECT settings FROM provider.dispatch_settings LIMIT 1');
        const cfg = cfgRes.rows[0]?.settings || {};
        if (typeof cfg.settlementHoldDays === 'number') holdDays = cfg.settlementHoldDays;
        if (typeof cfg.codRemitDays === 'number') codRemitDays = cfg.codRemitDays;
      } catch (_) {}

      // 1. Promote 'pending_hold' settlements whose hold has ended
      // ponytail: provider_settlements schema tracks created_at, hold duration is dynamic
      const promoted = await pool.query(
        `UPDATE provider.provider_settlements
         SET status = 'ready_for_payout', updated_at = NOW()
         WHERE status = 'pending_hold' AND created_at <= $1::timestamptz - ($2 || ' days')::interval`,
        [now, holdDays]
      );
      if (promoted.rowCount && promoted.rowCount > 0) {
        console.log(`[SETTLEMENT-CRON] Promoted ${promoted.rowCount} settlements from 'pending_hold' to 'ready_for_payout'.`);
      }

      // 2. Batch and transfer ready_for_payout settlements via batchProcessSettlements
      const readySettlementsRes = await pool.query(
        `SELECT id FROM provider.provider_settlements
         WHERE status = 'ready_for_payout'
            OR (status = 'failed' AND payout_attempts < $1)`,
        [MAX_PAYOUT_ATTEMPTS]
      );

      let heldCount = 0;
      let failedCount = 0;

      if (readySettlementsRes.rows.length > 0) {
        const ids = readySettlementsRes.rows.map(s => String(s.id));
        console.log(`[SETTLEMENT-CRON] Triggering batch payout processor for ${ids.length} ready settlements...`);
        const batchRes = await batchProcessSettlements(ids);
        console.log(`[SETTLEMENT-CRON] Batch payout result: claimed ${batchRes.claimedCount}, skipped ${batchRes.skippedCount}, held ${batchRes.heldCount}, failed ${batchRes.failedCount}`);
        heldCount = batchRes.heldCount;
        failedCount = batchRes.failedCount;
      }

      // 3. Reconcile stuck payouts (>5m in processing awaiting webhooks)
      const recRes = await reconcileStuckPayouts();
      if (recRes.totalStuck > 0) {
        console.log(`[SETTLEMENT-CRON] Reconciled ${recRes.reconciledCount} / ${recRes.totalStuck} stuck payouts directly with RazorpayX.`);
      }

      // 4. COD Overdue Escalation: Check for 'cod_pending' overdue settlements
      const overdueCodRes = await pool.query(
        `SELECT DISTINCT provider_id FROM provider.provider_settlements
         WHERE status = 'cod_pending' AND created_at <= $1::timestamptz - ($2 || ' days')::interval`,
        [now, codRemitDays]
      );

      if (overdueCodRes.rows.length > 0) {
        const overdueProviderIds = overdueCodRes.rows.map(r => r.provider_id);
        await pool.query(
          `UPDATE provider.providers
           SET is_dispatch_blocked_by_cod = TRUE, updated_at = NOW()
           WHERE id = ANY($1)`,
          [overdueProviderIds]
        );
        console.warn(`[SETTLEMENT-CRON] Blocked ${overdueProviderIds.length} provider(s) due to overdue COD dues.`);
      }

      // 5. Send admin notification if any settlements were held or failed
      if (heldCount > 0 || failedCount > 0) {
        const parts: string[] = [];
        if (heldCount > 0) parts.push(`${heldCount} held for admin review`);
        if (failedCount > 0) parts.push(`${failedCount} failed`);
        const summary = parts.join(', ');

        sendAdminNotification(
          '⚠️ Settlement Payout Alert',
          `Settlement cron completed with issues: ${summary}. Review at Admin → Settlements.`,
          'settlement_alert',
          { heldCount, failedCount, timestamp: now.toISOString() }
        );
        console.warn(`[SETTLEMENT-CRON] ⚠️ Alert sent: ${summary}`);
      }

      console.log('[SETTLEMENT-CRON] Payout batch and COD audit finished.');
    } catch (error: any) {
      console.error('[SETTLEMENT-CRON] Audit error:', error.message);
    }
  };

  console.log(`[WORKER] 💰 Settlement Cron started (running every ${intervalHours}h)`);
  setTimeout(runSettlementAudit, 12000);
  setInterval(runSettlementAudit, intervalMs);
};
