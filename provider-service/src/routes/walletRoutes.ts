import express from 'express';
import { getMyWallet, withdrawMoney } from '../controllers/walletController';
import { 
  getReconciliationDashboardStatsController, 
  triggerReconciliationJobAdminController,
  getHistoricalBalanceController,
  verifyLedgerCryptographicIntegrityController
} from '../controllers/provider/walletAuditController';
import { protect, admin, providerOnly } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/me', protect, providerOnly, getMyWallet);
router.post('/withdraw', protect, providerOnly, withdrawMoney);

router.get('/admin/reconciliation/stats', protect, admin, getReconciliationDashboardStatsController);
router.post('/admin/reconciliation/trigger', protect, admin, triggerReconciliationJobAdminController);

router.get('/admin/providers/:providerId/historical-balance', protect, admin, getHistoricalBalanceController);
router.post('/admin/providers/:providerId/verify-integrity', protect, admin, verifyLedgerCryptographicIntegrityController);

// Defect M: Admin wallet adjustment with full audit trail
router.post('/admin/providers/:providerId/adjust', protect, admin, async (req: any, res: any) => {
  try {
    const { providerId } = req.params;
    const { amount, type, reason, correlationId } = req.body;

    // Validation
    if (!amount || !type || !reason) {
      res.status(400).json({ success: false, message: 'amount, type (credit/debit), and reason are required' });
      return;
    }
    if (!['credit', 'debit'].includes(type)) {
      res.status(400).json({ success: false, message: 'type must be credit or debit' });
      return;
    }
    if (Number(amount) <= 0 || !Number.isFinite(Number(amount))) {
      res.status(400).json({ success: false, message: 'amount must be a positive number' });
      return;
    }
    if (reason.length < 5) {
      res.status(400).json({ success: false, message: 'reason must be at least 5 characters' });
      return;
    }

    const { recordWalletChangeAndAudit } = await import('../services/walletLedgerService');

    const walletType = type === 'credit' ? 'refund' : 'deduction';

    await recordWalletChangeAndAudit({
      providerId,
      amount: Number(amount),
      type: walletType,
      action: `Admin Wallet ${type === 'credit' ? 'Credit' : 'Debit'}`,
      referenceType: 'ADMIN_ADJUSTMENT',
      referenceId: correlationId || `admin_${Date.now()}`,
      source: 'Admin',
      reason,
      actorType: 'admin',
      actorId: String(req.user?._id || req.user?.id || 'unknown_admin'),
      metadata: {
        admin_name: req.user?.name || req.user?.email,
        correlation_id: correlationId,
        ip: req.ip
      }
    });

    const { getDb } = await import('../config/db');
    const db = getDb();
    const walletRes = await db.query(
      `SELECT balance FROM provider.wallets WHERE provider_id::text = $1`,
      [providerId]
    );

    res.json({
      success: true,
      message: `Wallet ${type}ed ₹${amount}`,
      balance: walletRes.rows[0]?.balance
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
