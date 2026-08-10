import { Router } from 'express';
import { Customer360Controller } from '../controllers/customer360.controller';
import { requirePermission } from '../middlewares/permissionMiddleware';
import { AdminPermission } from '../types/permissions';

const router = Router();

// GET /api/v1/admin/customers/:id/360
router.get('/:id/360', requirePermission(AdminPermission.CUSTOMER_VIEW), Customer360Controller.getCustomer360);

export default router;
