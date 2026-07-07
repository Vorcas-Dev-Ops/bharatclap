import express from 'express';
import { processPayment, getPaymentByBooking, getAllPayments, getMyPayments, createRazorpayOrder, verifyRazorpayPayment } from '../controllers/paymentController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/my', protect, getMyPayments);

// Razorpay routes
router.post('/create-order', protect, createRazorpayOrder);
router.post('/verify', protect, verifyRazorpayPayment);

router.route('/')
  .get(protect, admin, getAllPayments)
  .post(protect, processPayment);

router.get('/:bookingId', protect, getPaymentByBooking);

export default router;
