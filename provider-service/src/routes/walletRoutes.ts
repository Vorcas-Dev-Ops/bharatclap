import express from 'express';
import { getMyWallet, withdrawMoney } from '../controllers/walletController';
import { 
  getReconciliationDashboardStatsController, 
  triggerReconciliationJobAdminController 
} from '../controllers/provider/walletAuditController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/me', protect, getMyWallet);
router.post('/withdraw', protect, withdrawMoney);

router.get('/admin/reconciliation/stats', protect, admin, getReconciliationDashboardStatsController);
router.post('/admin/reconciliation/trigger', protect, admin, triggerReconciliationJobAdminController);

export default router;
