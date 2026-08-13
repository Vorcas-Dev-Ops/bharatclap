import express from 'express';
import { protect, admin } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';
import {
  getRevenueChart,
  getBookingChart,
  getOrderStatus,
  getServiceDistribution,
  getProviderPerformance,
  getPeakTimeHeatmap,
  getRecentReviews,
} from '../controllers/chartController';

const router = express.Router();

// ponytail: allow both JWT admin auth and internal service key for cross-service calls
const adminOrInternal = (req: any, res: any, next: any) => {
  if (req.headers['x-internal-service-key']) {
    return internalAuth(req, res, next);
  }
  protect(req, res, () => admin(req, res, next));
};

router.get('/revenue-chart',         adminOrInternal, getRevenueChart);
router.get('/booking-chart',         adminOrInternal, getBookingChart);
router.get('/order-status',          adminOrInternal, getOrderStatus);
router.get('/service-distribution',  adminOrInternal, getServiceDistribution);
router.get('/provider-performance',  adminOrInternal, getProviderPerformance);
router.get('/peak-time-heatmap',     adminOrInternal, getPeakTimeHeatmap);
router.get('/recent-reviews',        adminOrInternal, getRecentReviews);

export default router;
