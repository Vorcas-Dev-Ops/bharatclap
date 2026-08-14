import { Router } from 'express';
import { LogsController } from '../controllers/logs.controller';
import { requirePermission } from '../middlewares/permissionMiddleware';
import { AdminPermission } from '../types/permissions';

const router = Router();

// GET /api/v1/admin/logs/system
router.get('/system', requirePermission(AdminPermission.NOC_VIEW), LogsController.getSystemLogs);

// GET /api/v1/admin/logs/provider-errors
router.get('/provider-errors', requirePermission(AdminPermission.NOC_VIEW), LogsController.getProviderErrorLogs);

// GET /api/v1/admin/logs/user-errors
router.get('/user-errors', requirePermission(AdminPermission.NOC_VIEW), LogsController.getUserErrorLogs);

export default router;
