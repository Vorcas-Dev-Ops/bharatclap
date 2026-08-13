import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';

const router = Router();

// GET /api/v1/admin/dashboard & GET /api/v1/admin/dashboard/stats
router.get('/', DashboardController.getDashboardMetrics);
router.get('/stats', DashboardController.getDashboardMetrics);

export default router;
