import express from 'express';
import { 
  createBooking, 
  updateBookingStatus, 
  getAllBookings, 
  getMyBookings, 
  getBookingsByUserId,
  verifyBookingOtp,
  cancelBooking,
  getBookingById,
  getBookingsByProvider,
  debugDispatch
} from '../controllers/bookingController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/')
  .post(protect, createBooking)
  .get(protect, admin, getAllBookings);

router.get('/my', protect, getMyBookings);
router.get('/user/:userId', protect, admin, getBookingsByUserId);
router.get('/provider/:providerId', protect, getBookingsByProvider);

router.get('/debug-dispatch', debugDispatch);

router.get('/:id', protect, getBookingById);
router.put('/:id/status', protect, updateBookingStatus);
router.put('/:id/cancel', protect, cancelBooking);
router.post('/:id/verify', protect, verifyBookingOtp);

export default router;
