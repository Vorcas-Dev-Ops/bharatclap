import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';

const router = Router();

// GET /api/v1/admin/dashboard
router.get('/', DashboardController.getDashboardMetrics);

export default router;
