import express from 'express';
import { getDashboardStats, getLiveKpis, getLiveQueue } from '../controllers/dashboardController';
import { protect, admin } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';

const router = express.Router();

// ponytail: allow both JWT admin auth and internal service key for cross-service calls
const adminOrInternal = (req: any, res: any, next: any) => {
  if (req.headers['x-internal-service-key']) {
    return internalAuth(req, res, next);
  }
  protect(req, res, () => admin(req, res, next));
};

router.get('/stats', adminOrInternal, getDashboardStats);
router.get('/live-kpis', protect, admin, getLiveKpis);
router.get('/live-queue', protect, admin, getLiveQueue);

export default router;
