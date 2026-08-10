import { Router } from 'express';
import { Provider360Controller } from '../controllers/provider360.controller';
import { requirePermission } from '../middlewares/permissionMiddleware';
import { AdminPermission } from '../types/permissions';

const router = Router();

// GET /api/v1/admin/providers/:id/360
router.get('/:id/360', requirePermission(AdminPermission.PROVIDER_VIEW), Provider360Controller.getProvider360);

export default router;
