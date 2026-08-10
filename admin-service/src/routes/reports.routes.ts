import { Router } from 'express';
import { ReportsController } from '../controllers/reports.controller';
import { requirePermission } from '../middlewares/permissionMiddleware';
import { AdminPermission } from '../types/permissions';

const router = Router();

// GET /api/v1/admin/reports
router.get('/', requirePermission(AdminPermission.REPORT_EXPORT), ReportsController.getReports);

export default router;
