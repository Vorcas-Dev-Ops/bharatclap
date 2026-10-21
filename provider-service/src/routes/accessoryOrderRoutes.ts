import express from 'express';
import {
  getMyAccessoryOrders,
  createAccessoryRazorpayOrder,
  verifyAccessoryPayment,
  getAllAccessoryOrders
} from '../controllers/accessoryOrderController';
import { protect, admin, providerOnly } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/me', protect, providerOnly, getMyAccessoryOrders);
router.post('/create-razorpay-order', protect, providerOnly, createAccessoryRazorpayOrder);
router.post('/verify-payment', protect, providerOnly, verifyAccessoryPayment);
router.get('/', protect, admin, getAllAccessoryOrders);

export default router;
