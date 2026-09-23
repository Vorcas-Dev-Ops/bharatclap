import { getDb } from '../config/db';
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
export const runWalletReconciliationJob = async (jobId?: string, forceFullScan: boolean = false): Promise<DiscrepancyReport> => {
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
    const db = getDb();
    const whereFilter = forceFullScan ? `deleted_at IS NULL` : `wallet_dirty = TRUE AND deleted_at IS NULL`;

    const [providersRes, countRes] = await Promise.all([
      db.query(`SELECT id, wallet_balance, reserved_balance FROM provider.providers WHERE ${whereFilter}`),
      db.query(`SELECT COUNT(*)::int AS total FROM provider.providers WHERE deleted_at IS NULL`)
    ]);

    const providers = providersRes.rows;
    report.totalProviders = countRes.rows[0]?.total || 0;
    report.dirtyProvidersScanned = providers.length;

    for (const p of providers) {
      try {
        const txRes = await db.query(`
          SELECT 
            COALESCE(SUM(CASE 
              WHEN type IN ('recharge', 'refund', 'credit', 'initial_credit', 'release') THEN amount 
              ELSE -amount 
            END), 0)::float AS computed_balance
          FROM provider.wallet_transactions
          WHERE provider_id = $1 AND status = 'success'
        `, [p.id]);

        const computedBalance = Number(txRes.rows[0]?.computed_balance) || 0;
        const cachedBalance = Number(p.wallet_balance) || 0;
        const difference = computedBalance - cachedBalance;

        if (difference === 0) {
          await db.query(`
            INSERT INTO provider.wallet_reconciliation_logs (
              provider_id, expected_balance, actual_balance, difference, status, reconciled_at, job_id
            ) VALUES ($1, $2, $3, 0, 'MATCH', NOW(), $4)
          `, [p.id, computedBalance, cachedBalance, currentJobId]);

          await db.query(`
            UPDATE provider.providers SET wallet_dirty = FALSE, updated_at = NOW() WHERE id = $1
          `, [p.id]);
          continue;
        }

        // Ledger Drift Detected!
        report.discrepanciesDetected++;
        walletMetrics.incDriftTotal();

        report.corrections.push({
          providerId: String(p.id),
          cachedBalance,
          computedBalance,
          difference,
        });

        console.warn(
          `[LEDGER DRIFT DETECTED] ⚠️ Provider ${p.id} balance mismatch: ` +
          `cached=₹${cachedBalance}, computed_ledger=₹${computedBalance}, diff=${difference > 0 ? '+' : ''}₹${difference}. ` +
          `Recording reconciliation log & applying correction...`
        );

        // 1. Record Reconciliation Log
        await db.query(`
          INSERT INTO provider.wallet_reconciliation_logs (
            provider_id, expected_balance, actual_balance, difference, status, reconciled_at, job_id
          ) VALUES ($1, $2, $3, $4, 'CORRECTED', NOW(), $5)
        `, [p.id, computedBalance, cachedBalance, difference, currentJobId]);

        // 2. Correct Cached Balance
        await db.query(`
          UPDATE provider.providers
          SET wallet_balance = $1, wallet_dirty = FALSE, updated_at = NOW()
          WHERE id = $2
        `, [computedBalance, p.id]);

        // 3. Record Audit Log for correction
        await db.query(`
          INSERT INTO provider.wallet_audit_logs (
            provider_id, action, actor_type, balance_before, balance_after, metadata
          ) VALUES ($1, 'RECONCILIATION_CORRECTED', 'system', $2, $3, $4::jsonb)
        `, [
          p.id,
          cachedBalance,
          computedBalance,
          JSON.stringify({
            amount: Math.abs(difference),
            reason: `Ledger reconciliation job corrected balance drift (jobId: ${currentJobId})`,
            remarks: `Cached: ₹${cachedBalance} | Computed Ledger: ₹${computedBalance} | Diff: ₹${difference}`
          })
        ]);
      } catch (providerErr: any) {
        report.errors.push({ providerId: String(p.id), error: providerErr.message });
        console.error(`[RECONCILIATION] Error processing provider ${p.id}:`, providerErr.message);

        await db.query(`
          INSERT INTO provider.wallet_reconciliation_logs (
            provider_id, expected_balance, actual_balance, difference, status, reconciled_at, job_id, details
          ) VALUES ($1, 0, $2, 0, 'FAILED', NOW(), $3, $4::jsonb)
        `, [p.id, p.wallet_balance || 0, currentJobId, JSON.stringify({ error: providerErr.message })]);
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
  const db = getDb();
  const [totalRes, correctedRes, failedRes, dirtyRes, recentRes, largestRes] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS total FROM provider.wallet_reconciliation_logs`),
    db.query(`SELECT COUNT(*)::int AS total FROM provider.wallet_reconciliation_logs WHERE status = 'CORRECTED'`),
    db.query(`SELECT COUNT(*)::int AS total FROM provider.wallet_reconciliation_logs WHERE status = 'FAILED'`),
    db.query(`SELECT COUNT(*)::int AS total FROM provider.providers WHERE wallet_dirty = TRUE AND deleted_at IS NULL`),
    db.query(`SELECT * FROM provider.wallet_reconciliation_logs ORDER BY reconciled_at DESC LIMIT 50`),
    db.query(`SELECT difference FROM provider.wallet_reconciliation_logs WHERE status = 'CORRECTED' ORDER BY difference DESC LIMIT 1`)
  ]);

  return {
    totalReconciliations: totalRes.rows[0]?.total || 0,
    correctedBalances: correctedRes.rows[0]?.total || 0,
    failedReconciliations: failedRes.rows[0]?.total || 0,
    dirtyProvidersQueue: dirtyRes.rows[0]?.total || 0,
    largestDrift: Number(largestRes.rows[0]?.difference) || 0,
    recentLogs: recentRes.rows,
    metricsSummary: walletMetrics.getMetricsSummary()
  };
};

export const startDailyReconciliation = () => {
  setInterval(() => {
    runWalletReconciliationJob(undefined, false).catch(console.error);
  }, 24 * 60 * 60 * 1000);
};
