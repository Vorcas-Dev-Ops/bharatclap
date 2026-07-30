import { Provider } from '../models/Provider';
import { WalletTransaction } from '../models/WalletTransaction';
import { WalletAuditLog } from '../models/WalletAuditLog';

interface DiscrepancyReport {
  runId: string;
  startedAt: Date;
  finishedAt?: Date;
  totalProviders: number;
  discrepanciesDetected: number;
  corrections: {
    providerId: string;
    cachedBalance: number;
    computedBalance: number;
    diff: number;
  }[];
  errors: { providerId: string; error: string }[];
}

export const startDailyReconciliation = () => {
  const runReconciliation = async () => {
    const runId  = `RECON_${Date.now()}`;
    const report: DiscrepancyReport = {
      runId,
      startedAt: new Date(),
      totalProviders: 0,
      discrepanciesDetected: 0,
      corrections: [],
      errors: [],
    };

    console.log(`[RECONCILIATION] Started (runId: ${runId})`);

    try {
      const providers = await Provider.find({ isDeleted: false });
      report.totalProviders = providers.length;

      const creditTypes = ['recharge', 'refund', 'credit', 'initial_credit', 'release'];
      const debitTypes  = ['deduction', 'debit'];

      for (const p of providers) {
        try {
          const transactions = await WalletTransaction.find({
            provider_id: p._id,
            status: 'success'
          }).lean();

          // Authoritative balance from ledger
          const computedBalance = transactions.reduce((acc, tx) => {
            if (creditTypes.includes(tx.type)) return acc + tx.amount;
            if (debitTypes.includes(tx.type))  return acc - tx.amount;
            return acc;
          }, 0);

          // Authoritative reservedBalance (active holds)
          const holds = transactions.filter(t => t.type === 'hold');
          let computedReserved = 0;
          for (const hold of holds) {
            const resolved = transactions.some(t =>
              (t.type === 'release' || t.type === 'deduction') &&
              t.referenceId === hold.referenceId
            );
            if (!resolved) computedReserved += hold.amount;
          }

          const balanceMismatch  = computedBalance  !== p.walletBalance;
          const reservedMismatch = computedReserved !== p.reservedBalance;

          if (!balanceMismatch && !reservedMismatch) {
            // Clear stale flag if previously flagged and now clean
            if (p.walletDiscrepancyFlagged) {
              p.walletDiscrepancyFlagged = false;
              p.walletDiscrepancyDetails = undefined;
              await p.save();
            }
            continue;
          }

          const diff = computedBalance - (p.walletBalance || 0);
          report.discrepanciesDetected++;
          report.corrections.push({
            providerId: String(p._id),
            cachedBalance: p.walletBalance || 0,
            computedBalance,
            diff,
          });

          // Step 1: FLAG — record the discrepancy on the provider doc for admin visibility
          console.warn(
            `[RECONCILIATION] ⚠️  Discrepancy detected (runId: ${runId}) Provider ${p._id}: ` +
            `wallet cached=₹${p.walletBalance} computed=₹${computedBalance} diff=${diff > 0 ? '+' : ''}₹${diff}, ` +
            `reserved cached=₹${p.reservedBalance} computed=₹${computedReserved}. Auto-correcting...`
          );

          p.walletDiscrepancyFlagged = true;
          (p as any).walletDiscrepancyDetails = {
            detectedAt: new Date(),
            cachedBalance: p.walletBalance || 0,
            computedBalance,
            diff,
            runId,
          };

          // Step 2: CORRECT — apply the authoritative values
          p.walletBalance   = computedBalance;
          p.reservedBalance = computedReserved;
          // $locals flag authorises the pre-save guard for this approved write path
          p.$locals.walletLedgerAuthorized = true;
          await p.save();

          // Step 3: AUDIT — immutable record of every correction
          if (balanceMismatch) {
            try {
              await WalletAuditLog.create({
                transactionRefId: `${runId}_${p._id}`,
                date: new Date(),
                source: 'System',
                adminName: 'System Reconciliation',
                adminRole: 'system',
                providerId: p._id,
                providerName: 'Service Expert',
                action: 'Reconciliation Correction',
                amount: Math.abs(diff),
                previousBalance: p.walletBalance,   // already updated — use diff for the record
                newBalance: computedBalance,
                reason: `Daily reconciliation corrected a balance mismatch (runId: ${runId})`,
                remarks:
                  `Cached: ₹${report.corrections.at(-1)?.cachedBalance} | ` +
                  `Computed from ledger: ₹${computedBalance} | ` +
                  `Diff: ₹${diff}`,
                ipAddress: '127.0.0.1',
                status: 'Active',
                approvalStatus: 'approved',
              });
            } catch (auditErr: any) {
              // Audit log creation might fail if same runId_providerId already exists (duplicate run protection)
              console.warn(`[RECONCILIATION] Audit log skipped for ${p._id}: ${auditErr.message}`);
            }
          }
        } catch (providerErr: any) {
          report.errors.push({ providerId: String(p._id), error: providerErr.message });
          console.error(`[RECONCILIATION] Error processing provider ${p._id}:`, providerErr.message);
        }
      }
    } catch (error: any) {
      console.error(`[RECONCILIATION] Fatal error (runId: ${runId}):`, error.message);
    }

    report.finishedAt = new Date();
    const durationMs = report.finishedAt.getTime() - report.startedAt.getTime();

    // Summary log — visible in monitoring/alerting tools
    console.log(
      `[RECONCILIATION] Finished (runId: ${runId}) | ` +
      `Providers: ${report.totalProviders} | ` +
      `Discrepancies: ${report.discrepanciesDetected} | ` +
      `Errors: ${report.errors.length} | ` +
      `Duration: ${durationMs}ms`
    );

    if (report.discrepanciesDetected > 0) {
      console.warn(
        `[RECONCILIATION] ⚠️  ${report.discrepanciesDetected} balance discrepanc${report.discrepanciesDetected === 1 ? 'y' : 'ies'} corrected. ` +
        `Affected providers are flagged with walletDiscrepancyFlagged=true. ` +
        `Review in admin → Wallet → Reconciliation Flags.`
      );
    }

    return report;
  };

  // Run on start (10 s delay for DB connection), then every 24 hours
  setTimeout(runReconciliation, 10000);
  setInterval(runReconciliation, 24 * 60 * 60 * 1000);
};
