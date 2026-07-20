import express from 'express';
import { protect, admin } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';
import {
  createCoupon,
  getAllCoupons,
  updateCoupon,
  deleteCoupon,
  getCouponStats,
  getCouponAnalytics,
  getCouponUsage,
  validateCoupon,
  consumeCouponInternal
} from '../controllers/couponController';

const router = express.Router();

router.get('/', getAllCoupons);
router.post('/validate', validateCoupon);
router.post('/internal/consume', internalAuth, consumeCouponInternal);

router.post('/', protect, admin, createCoupon);
router.get('/stats', protect, admin, getCouponStats);
router.put('/:id', protect, admin, updateCoupon);
router.delete('/:id', protect, admin, deleteCoupon);
router.get('/:id/analytics', protect, admin, getCouponAnalytics);
router.get('/:id/usage', protect, admin, getCouponUsage);

export default router;
