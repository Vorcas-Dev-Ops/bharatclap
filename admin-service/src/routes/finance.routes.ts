import { Router } from 'express';
import { FinanceController } from '../controllers/finance.controller';
import { requirePermission } from '../middlewares/permissionMiddleware';
import { AdminPermission } from '../types/permissions';

const router = Router();

// GET /api/v1/admin/finance/dashboard
router.get('/dashboard', requirePermission(AdminPermission.FINANCE_VIEW), FinanceController.getFinanceDashboard);

export default router;
