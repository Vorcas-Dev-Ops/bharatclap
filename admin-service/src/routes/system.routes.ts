import { Router } from 'express';
import { SystemController } from '../controllers/system.controller';
import { requirePermission } from '../middlewares/permissionMiddleware';
import { AdminPermission } from '../types/permissions';

const router = Router();

// GET /api/v1/admin/system
router.get('/', requirePermission(AdminPermission.NOC_VIEW), SystemController.getSystemOverview);

export default router;
