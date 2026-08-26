import { Provider } from '../models/Provider';
import { ProviderSettlement } from '../models/ProviderSettlement';
import { batchProcessSettlements, reconcileStuckPayouts, MAX_PAYOUT_ATTEMPTS } from '../services/batchSettlementProcessor';

export const startSettlementCron = () => {
  const runSettlementAudit = async () => {
    try {
      console.log('[SETTLEMENT-CRON] Nightly payout batch and COD audit started...');
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

      if (readySettlements.length > 0) {
        const ids = readySettlements.map(s => s._id.toString());
        console.log(`[SETTLEMENT-CRON] Triggering batch payout processor for ${ids.length} ready settlements...`);
        const batchRes = await batchProcessSettlements(ids);
        console.log(`[SETTLEMENT-CRON] Batch payout result: claimed ${batchRes.claimedCount}, skipped ${batchRes.skippedCount} under batch ${batchRes.batchId}`);
      }

      // 3. Reconcile stuck payouts (>5m in processing awaiting webhooks)
      const recRes = await reconcileStuckPayouts();
      if (recRes.totalStuck > 0) {
        console.log(`[SETTLEMENT-CRON] Reconciled ${recRes.reconciledCount} / ${recRes.totalStuck} stuck payouts directly with RazorpayX.`);
      }

      // 3. COD Overdue Escalation: Check for 'cod_pending' overdue settlements (> 3 days)
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

      console.log('[SETTLEMENT-CRON] Nightly payout batch and COD audit finished.');
    } catch (error: any) {
      console.error('[SETTLEMENT-CRON] Audit error:', error.message);
    }
  };

  // Run on start, then every 24 hours
  setTimeout(runSettlementAudit, 12000); // Wait 12s for startup connection settling
  setInterval(runSettlementAudit, 24 * 60 * 60 * 1000);
};
