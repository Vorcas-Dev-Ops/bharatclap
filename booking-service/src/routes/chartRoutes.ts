import express from 'express';
import { protect, admin } from '../middleware/authMiddleware';
import {
  getRevenueChart,
  getBookingChart,
  getOrderStatus,
  getServiceDistribution,
  getProviderPerformance,
} from '../controllers/chartController';

const router = express.Router();

router.get('/revenue-chart',         protect, admin, getRevenueChart);
router.get('/booking-chart',         protect, admin, getBookingChart);
router.get('/order-status',          protect, admin, getOrderStatus);
router.get('/service-distribution',  protect, admin, getServiceDistribution);
router.get('/provider-performance',  protect, admin, getProviderPerformance);

export default router;
