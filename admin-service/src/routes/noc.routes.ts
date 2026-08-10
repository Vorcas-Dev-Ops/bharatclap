import { Router } from 'express';
import { NocController } from '../controllers/noc.controller';
import { requirePermission } from '../middlewares/permissionMiddleware';
import { AdminPermission } from '../types/permissions';

const router = Router();

// GET /api/v1/admin/noc
router.get('/', requirePermission(AdminPermission.NOC_VIEW), NocController.getNocTelemetry);

export default router;
