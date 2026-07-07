import express from 'express';
import {
  createBooking,
  updateBookingStatus,
  assignProviderInternal,
  getAllBookings,
  getMyBookings,
  getBookingsByUserId,
  verifyBookingOtp,
  cancelBooking,
  getBookingById,
  getBookingsByProvider,
  getBookingsBatch,
  getProviderBookingStats,
  startService,
  verifyStartOtp,
  finishService,
  verifyEndOtp,
  resendOtp
} from '../controllers/bookingController';
import { protect, admin } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';

const router = express.Router();

router.route('/')
  .post(protect, createBooking)
  .get(protect, admin, getAllBookings);

router.get('/my', protect, getMyBookings);
router.post('/batch', internalAuth, getBookingsBatch);
router.get('/user/:userId', protect, admin, getBookingsByUserId);
router.get('/provider/:providerId/stats', internalAuth, getProviderBookingStats);
router.get('/provider/:providerId', protect, getBookingsByProvider);

// Internal route — only callable by services with x-internal-service-key
router.put('/internal/:id/assign', internalAuth, assignProviderInternal);

// NOTE: debug-dispatch removed from production — use only in dev environments
// router.get('/debug-dispatch', debugDispatch);

router.get('/:id', protect, getBookingById);
router.put('/:id/status', protect, updateBookingStatus);
router.put('/:id/cancel', protect, cancelBooking);
router.post('/:id/verify', protect, verifyBookingOtp);
router.post('/:id/start-service', protect, startService);
router.post('/:id/verify-start-otp', protect, verifyStartOtp);
router.post('/:id/finish-service', protect, finishService);
router.post('/:id/verify-end-otp', protect, verifyEndOtp);
router.post('/:id/resend-otp', protect, resendOtp);

export default router;
