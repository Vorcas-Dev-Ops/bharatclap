import express from 'express';
import { protect, admin } from '../middleware/authMiddleware';
import {
  createCoupon,
  getAllCoupons,
  updateCoupon,
  deleteCoupon,
  getCouponStats,
  getCouponAnalytics,
  getCouponUsage
} from '../controllers/couponController';

const router = express.Router();

router.get('/', getAllCoupons);

router.post('/', protect, admin, createCoupon);
router.get('/stats', protect, admin, getCouponStats);
router.put('/:id', protect, admin, updateCoupon);
router.delete('/:id', protect, admin, deleteCoupon);
router.get('/:id/analytics', protect, admin, getCouponAnalytics);
router.get('/:id/usage', protect, admin, getCouponUsage);

export default router;
