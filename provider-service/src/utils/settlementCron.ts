import { Provider } from '../models/Provider';
import { ProviderSettlement } from '../models/ProviderSettlement';

export const startSettlementCron = () => {
  const runSettlementAudit = async () => {
    try {
      console.log('[SETTLEMENT-CRON] Nightly payout batch and COD audit started...');
      const now = new Date();

      // 1. Promote 'pending_hold' settlements whose hold has ended
      const promoted = await ProviderSettlement.updateMany(
        { status: 'pending_hold', hold_ends_at: { $lte: now } },
        { $set: { status: 'ready_for_payout' } }
      );
      if (promoted.modifiedCount > 0) {
        console.log(`[SETTLEMENT-CRON] Promoted ${promoted.modifiedCount} settlements from 'pending_hold' to 'ready_for_payout'.`);
      }

      // 2. Batch and transfer ready_for_payout settlements
      const readySettlements = await ProviderSettlement.find({
        $or: [
          { status: 'ready_for_payout' },
          { status: 'failed', payout_attempts: { $lt: 3 } }
        ]
      });
      if (readySettlements.length > 0) {
        // Group by provider_id
        const providerGroups = new Map<string, any[]>();
        for (const s of readySettlements) {
          const pid = String(s.provider_id);
          const list = providerGroups.get(pid) || [];
          list.push(s);
          providerGroups.set(pid, list);
        }

        const batchId = `batch_${Date.now()}`;

        for (const [pid, settlements] of providerGroups.entries()) {
          const provider = await Provider.findById(pid);
          if (!provider) {
            console.error(`[SETTLEMENT-CRON] Provider ${pid} not found for settlement batch.`);
            continue;
          }

          const payoutRef = `payout_ref_${pid}_${Date.now()}`;
          const totalPayout = settlements.reduce((sum, s) => sum + s.net_payable_amount, 0);

          if (!provider.bankDetails || provider.bankDetails.status !== 'verified') {
            console.warn(`[SETTLEMENT-CRON] Skipping provider ${pid} payout: bank details not configured or unverified.`);
            for (const s of settlements) {
              s.payout_attempts += 1;
              s.status = 'failed';
              s.failure_reason = s.payout_attempts >= 3
                ? 'Payout aborted: maximum payout attempts (3) exceeded. Escalated to admin review.'
                : `Payout failed (Attempt ${s.payout_attempts}/3): Bank details not configured or unverified`;
              s.settlement_batch_id = batchId;
              await s.save();
            }
            continue;
          }

          // Mock Bank payout transfer simulation
          // If IFSC starts with "FAIL", mock fail the payout for testing
          const isMockFail = provider.bankDetails.ifscCode?.toUpperCase().startsWith('FAIL');

          if (isMockFail) {
            for (const s of settlements) {
              s.payout_attempts += 1;
              s.status = 'failed';
              s.failure_reason = s.payout_attempts >= 3
                ? 'Payout aborted: maximum payout attempts (3) exceeded. Escalated to admin review.'
                : `Payout failed (Attempt ${s.payout_attempts}/3): Mock Payment Gateway failure: Transaction rejected by beneficiary bank`;
              s.settlement_batch_id = batchId;
              s.payout_reference_id = payoutRef;
              await s.save();
            }
            console.warn(`[SETTLEMENT-CRON] Payout failed for provider ${pid} (mock code FAIL matches IFSC). Amount: ₹${totalPayout}`);
          } else {
            for (const s of settlements) {
              s.payout_attempts += 1;
              s.status = 'paid';
              s.paid_at = new Date();
              s.settlement_batch_id = batchId;
              s.payout_reference_id = payoutRef;
              s.transaction_reference = `tx_ref_${Math.floor(Math.random() * 10000000)}`;
              await s.save();
            }
            console.log(`[SETTLEMENT-CRON] Successfully paid out ₹${totalPayout} to provider ${pid} under batch ${batchId} / payout ${payoutRef}`);
          }
        }
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
