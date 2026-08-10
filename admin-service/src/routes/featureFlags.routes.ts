import { Router } from 'express';
import { FeatureFlagsController } from '../controllers/featureFlags.controller';
import { requirePermission } from '../middlewares/permissionMiddleware';
import { AdminPermission } from '../types/permissions';

const router = Router();

// GET /api/v1/admin/feature-flags
router.get('/', requirePermission(AdminPermission.FEATURE_FLAG_EDIT), FeatureFlagsController.getFlags);

// PUT /api/v1/admin/feature-flags/:key
router.put('/:key', requirePermission(AdminPermission.FEATURE_FLAG_EDIT), FeatureFlagsController.toggleFlag);

export default router;
