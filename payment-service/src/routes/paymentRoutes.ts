import express from 'express';
import { processPayment, getPaymentByBooking, getAllPayments, getMyPayments } from '../controllers/paymentController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/my', protect, getMyPayments);

router.route('/')
  .get(protect, admin, getAllPayments)
  .post(protect, processPayment);

router.get('/:bookingId', protect, getPaymentByBooking);

export default router;
