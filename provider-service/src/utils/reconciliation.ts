import { Provider } from '../models/Provider';
import { WalletTransaction } from '../models/WalletTransaction';
import { WalletAuditLog, WalletSource } from '../models/WalletAuditLog';
import { WalletReconciliationLog } from '../models/WalletReconciliationLog';
import { walletMetrics } from '../services/walletMetrics';

interface DiscrepancyReport {
  jobId: string;
  startedAt: Date;
  finishedAt?: Date;
  totalProviders: number;
  dirtyProvidersScanned: number;
  discrepanciesDetected: number;
  corrections: {
    providerId: string;
    cachedBalance: number;
    computedBalance: number;
    difference: number;
  }[];
  errors: { providerId: string; error: string }[];
}

/**
 * Scheduled Reconciliation Job with Targeted Dirty Scan & Drift Detection
 */
export const runWalletReconciliationJob = async (jobId?: string, forceFullScan: boolean = false) => {
  const currentJobId = jobId || `RECON_${Date.now()}`;
  walletMetrics.incReconciliationTotal();

  const report: DiscrepancyReport = {
    jobId: currentJobId,
    startedAt: new Date(),
    totalProviders: 0,
    dirtyProvidersScanned: 0,
    discrepanciesDetected: 0,
    corrections: [],
    errors: [],
  };

  console.log(`[RECONCILIATION JOB] Started (jobId: ${currentJobId}, forceFullScan: ${forceFullScan})`);

  try {
    const filter = forceFullScan ? { isDeleted: false } : { wallet_dirty: true, isDeleted: false };
    const providers = await Provider.find(filter);
    report.totalProviders = await Provider.countDocuments({ isDeleted: false });
    report.dirtyProvidersScanned = providers.length;

    const creditTypes = ['recharge', 'refund', 'credit', 'initial_credit', 'release'];
    const debitTypes = ['deduction', 'debit', 'adjustment'];

    for (const p of providers) {
      try {
        const transactions = await WalletTransaction.find({
          provider_id: p._id,
          status: 'success'
        }).lean();

        const computedBalance = transactions.reduce((acc, tx) => {
          if (creditTypes.includes(tx.type)) return acc + tx.amount;
          if (debitTypes.includes(tx.type)) return acc - tx.amount;
          return acc;
        }, 0);

        const holds = transactions.filter(t => t.type === 'hold');
        let computedReserved = 0;
        for (const hold of holds) {
          const resolved = transactions.some(t =>
            (t.type === 'release' || t.type === 'deduction') &&
            t.referenceId === hold.referenceId
          );
          if (!resolved) computedReserved += hold.amount;
        }

        const cachedBalance = p.walletBalance || 0;
        const difference = computedBalance - cachedBalance;
        const balanceMismatch = computedBalance !== cachedBalance;
        const reservedMismatch = computedReserved !== (p.reservedBalance || 0);

        if (!balanceMismatch && !reservedMismatch) {
          await WalletReconciliationLog.create({
            provider_id: p._id,
            expected_balance: computedBalance,
            actual_balance: cachedBalance,
            difference: 0,
            status: 'MATCH',
            reconciled_at: new Date(),
            job_id: currentJobId
          }).catch(() => {});

          p.wallet_dirty = false;
          if (p.walletDiscrepancyFlagged) {
            p.walletDiscrepancyFlagged = false;
            p.walletDiscrepancyDetails = undefined;
          }
          p.$locals.walletLedgerAuthorized = true;
          await p.save();
          continue;
        }

        // Ledger Drift Detected!
        report.discrepanciesDetected++;
        walletMetrics.incDriftTotal();

        report.corrections.push({
          providerId: String(p._id),
          cachedBalance,
          computedBalance,
          difference,
        });

        console.warn(
          `[LEDGER DRIFT DETECTED] ⚠️ Provider ${p._id} balance mismatch: ` +
          `cached=₹${cachedBalance}, computed_ledger=₹${computedBalance}, diff=${difference > 0 ? '+' : ''}₹${difference}. ` +
          `Recording reconciliation log & applying correction...`
        );

        // 1. Record Reconciliation Log
        await WalletReconciliationLog.create({
          provider_id: p._id,
          expected_balance: computedBalance,
          actual_balance: cachedBalance,
          difference,
          status: 'CORRECTED',
          reconciled_at: new Date(),
          job_id: currentJobId,
          details: {
            cachedReserved: p.reservedBalance,
            computedReserved,
          }
        });

        // 2. Correct Cached Balance
        p.walletDiscrepancyFlagged = true;
        (p as any).walletDiscrepancyDetails = {
          detectedAt: new Date(),
          cachedBalance,
          computedBalance,
          diff: difference,
          runId: currentJobId,
        };

        p.walletBalance = computedBalance;
        p.reservedBalance = computedReserved;
        p.wallet_dirty = false;
        p.$locals.walletLedgerAuthorized = true;
        await p.save();

        // 3. Record Audit Log for correction
        await WalletAuditLog.create({
          provider_id: p._id,
          providerId: p._id,
          action: 'RECONCILIATION_CORRECTED',
          transaction_type: 'adjustment',
          amount: Math.abs(difference),
          balance_before: cachedBalance,
          balance_after: computedBalance,
          previousBalance: cachedBalance,
          newBalance: computedBalance,
          source: WalletSource.SYSTEM_JOB,
          actor_type: 'system',
          reason: `Ledger reconciliation job corrected balance drift (jobId: ${currentJobId})`,
          remarks: `Cached: ₹${cachedBalance} | Computed Ledger: ₹${computedBalance} | Diff: ₹${difference}`,
          reference_id: `RECON_${currentJobId}_${p._id}`,
          transactionRefId: `RECON_${currentJobId}_${p._id}`,
          status: 'Active',
          approvalStatus: 'approved'
        }).catch(() => {});

      } catch (providerErr: any) {
        report.errors.push({ providerId: String(p._id), error: providerErr.message });
        console.error(`[RECONCILIATION] Error processing provider ${p._id}:`, providerErr.message);

        await WalletReconciliationLog.create({
          provider_id: p._id,
          expected_balance: 0,
          actual_balance: p.walletBalance || 0,
          difference: 0,
          status: 'FAILED',
          reconciled_at: new Date(),
          job_id: currentJobId,
          details: { error: providerErr.message }
        }).catch(() => {});
      }
    }
  } catch (error: any) {
    console.error(`[RECONCILIATION] Fatal job error (jobId: ${currentJobId}):`, error.message);
  }

  report.finishedAt = new Date();
  const durationMs = report.finishedAt.getTime() - report.startedAt.getTime();

  console.log(
    `[RECONCILIATION JOB] Finished (jobId: ${currentJobId}) | ` +
    `Dirty Scanned: ${report.dirtyProvidersScanned} / ${report.totalProviders} | ` +
    `Discrepancies: ${report.discrepanciesDetected} | ` +
    `Duration: ${durationMs}ms`
  );

  return report;
};

/**
 * Exposes Admin Dashboard Reconciliation Telemetry Summary
 */
export const getReconciliationDashboardStats = async () => {
  const [
    totalLogs,
    correctedCount,
    failedCount,
    dirtyCount,
    recentLogs
  ] = await Promise.all([
    WalletReconciliationLog.countDocuments({}),
    WalletReconciliationLog.countDocuments({ status: 'CORRECTED' }),
    WalletReconciliationLog.countDocuments({ status: 'FAILED' }),
    Provider.countDocuments({ wallet_dirty: true, isDeleted: false }),
    WalletReconciliationLog.find({}).sort({ reconciled_at: -1 }).limit(50).populate('provider_id', 'user_id name').lean()
  ]);

  const largestDriftDoc = await WalletReconciliationLog.findOne({ status: 'CORRECTED' })
    .sort({ difference: -1 })
    .lean();

  return {
    totalReconciliations: totalLogs,
    correctedBalances: correctedCount,
    failedReconciliations: failedCount,
    dirtyProvidersQueue: dirtyCount,
    largestDrift: largestDriftDoc?.difference || 0,
    recentLogs,
    metricsSummary: walletMetrics.getMetricsSummary()
  };
};

export const startDailyReconciliation = () => {
  setInterval(() => {
    runWalletReconciliationJob(undefined, false).catch(console.error);
  }, 24 * 60 * 60 * 1000);
};
