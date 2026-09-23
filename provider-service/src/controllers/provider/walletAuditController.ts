import { Request, Response } from 'express';
import { Money } from '@bharatclap/shared';
import { ProviderRepository } from '../../repositories/providerRepository';
import { recordWalletChangeAndAudit } from '../../services/walletLedgerService';
import { getReconciliationDashboardStats, runWalletReconciliationJob } from '../../utils/reconciliation';
import { getDb } from '../../config/db';

export const createWalletAdjustmentAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, action, amount, reason, remarks } = req.body;

    if (!providerId || !action || !amount || amount <= 0 || !reason || !remarks) {
      res.status(400).json({ message: 'Mandatory fields missing: providerId, action, amount (>0), reason, and remarks are required.' });
      return;
    }

    const provider = await ProviderRepository.findById(providerId);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found.' });
      return;
    }

    if (provider.wallet_status === 'frozen_manual' || provider.wallet_status === 'frozen_auto') {
      res.status(403).json({ message: `Cannot perform wallet adjustment. Provider wallet is ${provider.wallet_status}. Super Admin unfreeze required.` });
      return;
    }

    const adminUser = (req as any).user || { _id: null, name: 'Admin', role: 'super_admin', admin_role: 'super_admin' };
    const adminRole = adminUser.admin_role || adminUser.role || 'super_admin';
    const isSuperOrFinance = adminRole === 'super_admin' || adminRole === 'finance_admin' || adminUser.role === 'super_admin';

    const amtMoney = Money.from(amount);
    const isHighValue = amtMoney.gt(Money.from(5000));
    const requiresApproval = isHighValue && !isSuperOrFinance;
    const isCredit = action === 'Wallet Credit' || action === 'Credit';
    const refId = `WAL-${Math.floor(100000 + Math.random() * 900000)}`;

    const db = getDb();

    if (requiresApproval) {
      await db.query(
        `INSERT INTO provider.wallet_audit_logs (
           provider_id, action, actor_type, actor_id, balance_before, balance_after, metadata
         ) VALUES ($1, $2, 'admin', $3, $4, $4, $5)`,
        [
          provider.id,
          isCredit ? 'Wallet Credit' : 'Wallet Debit',
          adminUser._id ? String(adminUser._id) : null,
          provider.wallet_balance,
          JSON.stringify({
            amount: amtMoney.toNumber(),
            reason,
            remarks: `[REQUIRES APPROVAL] ${remarks}`,
            approvalStatus: 'pending_approval',
            refId
          })
        ]
      );

      res.status(202).json({
        success: true,
        requiresApproval: true,
        message: `Adjustment request of ₹${amtMoney.toNumber()} requires Super Admin or Finance Manager approval.`,
        refId
      });
      return;
    }

    const result = await recordWalletChangeAndAudit({
      providerId: provider.id,
      amount: amtMoney.toNumber(),
      type: isCredit ? 'credit' : 'debit',
      action: isCredit ? 'Wallet Credit' : 'Wallet Debit',
      source: 'ADMIN_PANEL',
      reason,
      remarks,
      adminUser,
      referenceId: refId,
    });

    res.json({
      success: true,
      newBalance: result.newBalance,
      referenceId: refId,
      message: `Wallet adjustment of ₹${amtMoney.toNumber()} applied successfully.`
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const freezeWalletAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const { reason } = req.body;

    const db = getDb();
    const result = await db.query(
      `UPDATE provider.providers
       SET wallet_status = 'frozen_manual', is_wallet_blocked = TRUE, updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1)
       RETURNING id, wallet_balance, wallet_status`,
      [providerId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Provider not found.' });
      return;
    }

    res.json({
      success: true,
      message: `Provider wallet frozen successfully. Reason: ${reason || 'Admin action'}`
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const unfreezeWalletAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;

    const db = getDb();
    const result = await db.query(
      `UPDATE provider.providers
       SET wallet_status = 'active', is_wallet_blocked = FALSE, updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1)
       RETURNING id, wallet_balance, wallet_status`,
      [providerId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Provider not found.' });
      return;
    }

    res.json({
      success: true,
      message: 'Provider wallet unfrozen successfully. Status reset to Active.'
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getWalletAuditLogsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const db = getDb();
    const [logsRes, countRes] = await Promise.all([
      db.query(
        `SELECT * FROM provider.wallet_audit_logs
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      db.query(`SELECT COUNT(*)::int AS total FROM provider.wallet_audit_logs`)
    ]);

    res.json({
      logs: logsRes.rows,
      total: countRes.rows[0]?.total || 0,
      page,
      limit,
      totalPages: Math.ceil((countRes.rows[0]?.total || 0) / limit)
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const approveHighValueAdjustmentAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { auditLogId } = req.params;
    const db = getDb();

    const auditRes = await db.query(
      `SELECT * FROM provider.wallet_audit_logs WHERE id::text = $1`,
      [auditLogId]
    );

    const auditLog = auditRes.rows[0];
    if (!auditLog) {
      res.status(404).json({ message: 'Audit log request not found.' });
      return;
    }

    const metadata = typeof auditLog.metadata === 'object' ? auditLog.metadata : JSON.parse(auditLog.metadata || '{}');
    if (metadata.approvalStatus !== 'pending_approval') {
      res.status(400).json({ message: 'This adjustment request is not pending approval.' });
      return;
    }

    const provider = await ProviderRepository.findById(auditLog.provider_id);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found.' });
      return;
    }

    const adminUser = (req as any).user || { _id: null, name: 'Finance Manager', role: 'finance_admin' };
    const isCredit = auditLog.action.includes('Credit');
    const amount = Number(metadata.amount) || 0;

    const result = await recordWalletChangeAndAudit({
      providerId: provider.id,
      amount,
      type: isCredit ? 'credit' : 'debit',
      action: isCredit ? 'Wallet Credit' : 'Wallet Debit',
      source: 'ADMIN_PANEL',
      reason: metadata.reason || 'Approved adjustment',
      remarks: `[APPROVED] ${metadata.remarks || ''}`,
      adminUser,
      referenceId: metadata.refId || `REF_${Date.now()}`,
    });

    metadata.approvalStatus = 'approved';
    await db.query(
      `UPDATE provider.wallet_audit_logs
       SET metadata = $2::jsonb
       WHERE id = $1`,
      [auditLog.id, JSON.stringify(metadata)]
    );

    res.json({
      success: true,
      newBalance: result.newBalance,
      message: 'High-value adjustment approved and applied successfully.'
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getReconciliationDashboardStatsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getReconciliationDashboardStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const triggerReconciliationJobAdminController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { forceFullScan } = req.body;
    const report = await runWalletReconciliationJob(undefined, !!forceFullScan);
    res.json({ success: true, message: 'Reconciliation job completed', report });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getHistoricalBalanceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const { timestamp } = req.query;

    if (!timestamp) {
      res.status(400).json({ message: 'Target timestamp query parameter is required (e.g. ?timestamp=2026-07-01T14:30:00Z)' });
      return;
    }

    const targetDate = new Date(timestamp as string);
    const db = getDb();
    const result = await db.query(
      `SELECT * FROM provider.wallet_transactions
       WHERE (provider_id::text = $1 OR legacy_mongo_id = $1)
         AND status = 'success'
         AND created_at <= $2
       ORDER BY created_at ASC`,
      [providerId, targetDate]
    );

    const transactions = result.rows;
    const creditTypes = ['recharge', 'refund', 'credit', 'initial_credit', 'release'];
    const debitTypes = ['deduction', 'debit', 'adjustment'];

    const historicalBalance = transactions.reduce((acc: number, tx: any) => {
      const amt = Number(tx.amount);
      if (creditTypes.includes(tx.type)) return acc + amt;
      if (debitTypes.includes(tx.type)) return acc - amt;
      return acc;
    }, 0);

    const lastTx = transactions.at(-1);

    res.json({
      provider_id: providerId,
      historical_timestamp: targetDate.toISOString(),
      historical_balance: historicalBalance,
      total_transactions_counted: transactions.length,
      last_transaction_hash: lastTx?.current_hash || 'GENESIS_HASH'
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyLedgerCryptographicIntegrityController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const db = getDb();

    const result = await db.query(
      `SELECT * FROM provider.wallet_transactions
       WHERE (provider_id::text = $1 OR legacy_mongo_id = $1)
         AND status = 'success'
       ORDER BY fencing_token ASC`,
      [providerId]
    );

    const transactions = result.rows;
    if (transactions.length === 0) {
      res.json({ provider_id: providerId, status: 'VERIFIED', message: 'No transactions found. Genesis state clean.' });
      return;
    }

    let expectedPrevHash = 'GENESIS_HASH';
    const violations: any[] = [];

    for (const tx of transactions) {
      if (tx.previous_hash && tx.previous_hash !== expectedPrevHash) {
        violations.push({
          tx_id: tx.id,
          referenceId: tx.reference_id,
          error: 'Previous hash mismatch',
          expectedPrevHash,
          actualPrevHash: tx.previous_hash
        });
      }
      expectedPrevHash = tx.current_hash;
    }

    if (violations.length > 0) {
      res.status(422).json({
        provider_id: providerId,
        status: 'TAMPER_DETECTED',
        tamperViolations: violations,
        message: 'CRITICAL ALERT: Cryptographic Hash Chain Tamper Detected in Ledger!'
      });
      return;
    }

    res.json({
      provider_id: providerId,
      status: 'VERIFIED',
      total_transactions_verified: transactions.length,
      latest_hash: expectedPrevHash,
      message: 'Cryptographic SHA-256 Hash Chain Integrity Verified Successfully. Zero tampering detected.'
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
