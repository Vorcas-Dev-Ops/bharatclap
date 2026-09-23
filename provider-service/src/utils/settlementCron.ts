import { Provider } from '../models/Provider';
import { ProviderSettlement } from '../models/ProviderSettlement';
import { DispatchSetting } from '../models/DispatchSetting';
import { batchProcessSettlements, reconcileStuckPayouts, MAX_PAYOUT_ATTEMPTS } from '../services/batchSettlementProcessor';
import { sendAdminNotification } from './internalApi';

export const startSettlementCron = async () => {
  // Load configurable cron interval (ponytail: env var fallback for quick override without DB access)
  const envHours = process.env.SETTLEMENT_CRON_INTERVAL_HOURS;
  let intervalHours: number;

  if (envHours) {
    intervalHours = Number(envHours) || 4;
  } else {
    const cfg = await DispatchSetting.findOne().select('settlementCronIntervalHours').lean() || {} as any;
    intervalHours = cfg.settlementCronIntervalHours ?? 4;
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;

  const runSettlementAudit = async () => {
    try {
      console.log('[SETTLEMENT-CRON] Payout batch and COD audit started...');
      const now = new Date();

      // 1. Promote 'pending_hold' settlements whose hold has ended
      const promoted = await ProviderSettlement.updateMany(
        { status: 'pending_hold', hold_ends_at: { $lte: now } },
        {
          $set: { status: 'ready_for_payout' },
          $push: { audit_trail: { action: 'HOLD_RELEASED', performed_by: 'system', timestamp: now, notes: 'Hold period expired' } }
        }
      );
      if (promoted.modifiedCount > 0) {
        console.log(`[SETTLEMENT-CRON] Promoted ${promoted.modifiedCount} settlements from 'pending_hold' to 'ready_for_payout'.`);
      }

      // 2. Batch and transfer ready_for_payout settlements via batchProcessSettlements
      const readySettlements = await ProviderSettlement.find({
        $or: [
          { status: 'ready_for_payout' },
          { status: 'failed', is_non_retryable: { $ne: true }, payout_attempts: { $lt: MAX_PAYOUT_ATTEMPTS } }
        ]
      }).select('_id').lean();

      let heldCount = 0;
      let failedCount = 0;

      if (readySettlements.length > 0) {
        const ids = readySettlements.map(s => s._id.toString());
        console.log(`[SETTLEMENT-CRON] Triggering batch payout processor for ${ids.length} ready settlements...`);
        const batchRes = await batchProcessSettlements(ids);
        console.log(`[SETTLEMENT-CRON] Batch payout result: claimed ${batchRes.claimedCount}, skipped ${batchRes.skippedCount}, held ${batchRes.heldCount}, failed ${batchRes.failedCount} under batch ${batchRes.batchId}`);
        heldCount = batchRes.heldCount;
        failedCount = batchRes.failedCount;
      }

      // 3. Reconcile stuck payouts (>5m in processing awaiting webhooks)
      const recRes = await reconcileStuckPayouts();
      if (recRes.totalStuck > 0) {
        console.log(`[SETTLEMENT-CRON] Reconciled ${recRes.reconciledCount} / ${recRes.totalStuck} stuck payouts directly with RazorpayX.`);
      }

      // 4. COD Overdue Escalation: Check for 'cod_pending' overdue settlements (> 3 days)
      const overdueCodSettlements = await ProviderSettlement.find({
        status: 'cod_pending',
        cod_due_by: { $lte: now }
      });

      if (overdueCodSettlements.length > 0) {
        const uniqueProviderIds = [...new Set(overdueCodSettlements.map(s => String(s.provider_id)))];
        for (const pid of uniqueProviderIds) {
          const provider = await Provider.findById(pid);
          if (provider && !provider.isWalletBlocked) {
            provider.isWalletBlocked = true; // Blocks dispatches automatically
            await provider.save();
            console.warn(`[SETTLEMENT-CRON] Blocked provider ${pid} due to overdue COD dues.`);
          }
        }
      }

      // 5. Send admin notification if any settlements were held or failed
      // ponytail: fire-and-forget — sendAdminNotification already catches its own errors
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

  // Run on start (12s delay), then every intervalHours
  // ponytail: CAS claim in processSingleSettlementPayout + is_locked + orphan recovery at 5min
  // fully prevent double-processing even if cron runs overlap at higher frequency
  console.log(`[WORKER] 💰 Settlement Cron started (running every ${intervalHours}h)`);
  setTimeout(runSettlementAudit, 12000);
  setInterval(runSettlementAudit, intervalMs);
};
