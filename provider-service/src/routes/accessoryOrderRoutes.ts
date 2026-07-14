import express from 'express';
import {
  getMyAccessoryOrders,
  createAccessoryRazorpayOrder,
  verifyAccessoryPayment,
  getAllAccessoryOrders
} from '../controllers/accessoryOrderController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/me', protect, getMyAccessoryOrders);
router.post('/create-razorpay-order', protect, createAccessoryRazorpayOrder);
router.post('/verify-payment', protect, verifyAccessoryPayment);
router.get('/', protect, admin, getAllAccessoryOrders);

export default router;
