import express from 'express';
import {
  getCouponUsages,
  getCouponUsageStats,
  getCouponDailyUsage,
  deleteCouponUsages
} from '../controllers/couponUsageController';

const router = express.Router();

router.get('/stats',   getCouponUsageStats);
router.get('/daily',   getCouponDailyUsage);
router.get('/',        getCouponUsages);
router.delete('/',     deleteCouponUsages);

export default router;
