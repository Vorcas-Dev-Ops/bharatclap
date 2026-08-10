import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { requirePermission } from '../middlewares/permissionMiddleware';
import { AdminPermission } from '../types/permissions';

const router = Router();

// GET /api/v1/admin/audit
router.get('/', requirePermission(AdminPermission.AUDIT_VIEW), AuditController.getAuditLogs);

export default router;
