import express from 'express';
import { createBooking } from '../controllers/booking/createController';
import { getAllBookings, getMyBookings, getBookingById, getBookingsBatch, getProviderBookingStats, getBookingsByUserId, getBookingsByProvider, getBookingActivity } from '../controllers/booking/queryController';
import { updateBookingStatus, assignProviderInternal, cancelBooking, getActiveBookingByProvider } from '../controllers/booking/lifecycleController';
import { startService, verifyStartOtp, finishService, verifyEndOtp, verifyBookingOtp, resendOtp } from '../controllers/booking/otpController';
import { protect, admin, checkPermission } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';
import { validate, createBookingSchema } from '../middleware/validate';

const router = express.Router();

router.route('/')
  .post(protect, validate(createBookingSchema), createBooking)
  .get(protect, admin, checkPermission('bookings', 'view'), getAllBookings);

// TEMP: re-dispatch stuck bookings — synchronous version for debugging
import axios from 'axios';
import { Booking } from '../models/Booking';
const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://localhost:5003';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || 'internal_secure_key_98765';
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';

router.post('/debug-redispatch', async (req, res) => {
  const { booking_id } = req.body;
  const booking = await Booking.findOne({ booking_id }).lean();
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }

  try {
    const addrRes = await axios.post(`${AUTH_URL}/api/address/batch`, { ids: [String(booking.address_id)] }, { headers: { 'x-internal-service-key': INTERNAL_KEY } });
    const address = addrRes.data?.[0];
    if (!address) { res.json({ error: 'Address not found', address_id: booking.address_id }); return; }

    const dispRes = await axios.post(`${PROV_URL}/api/providers/internal/dispatch-batch`, {
      bookings: [booking],
      address
    }, { headers: { 'x-internal-service-key': INTERNAL_KEY } });

    const results = dispRes.data?.results || [];
    const mongoose = await import('mongoose');
    for (const r of results) {
      if (r.provider_id) {
        await Booking.findByIdAndUpdate(new mongoose.default.Types.ObjectId(String(r.booking_id)), { $set: { provider_id: new mongoose.default.Types.ObjectId(String(r.provider_id)) } });
      }
    }
    res.json({ dispatch_results: results, address_used: address });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my', protect, getMyBookings);
router.post('/batch', internalAuth, getBookingsBatch);
router.get('/user/:userId', protect, admin, getBookingsByUserId);
router.get('/provider/:providerId/stats', internalAuth, getProviderBookingStats);
router.get('/provider/:providerId', protect, getBookingsByProvider);

// Internal route — only callable by services with x-internal-service-key
router.put('/internal/:id/assign', internalAuth, assignProviderInternal);
router.get('/internal/active-booking/:providerId', internalAuth, getActiveBookingByProvider);

// NOTE: debug-dispatch removed from production — use only in dev environments
// router.get('/debug-dispatch', debugDispatch);

router.get('/:id', protect, getBookingById);
router.get('/:id/activity', protect, admin, checkPermission('bookings', 'view'), getBookingActivity);
router.put('/:id/status', protect, admin, checkPermission('bookings', 'update'), updateBookingStatus);
router.put('/:id/cancel', protect, cancelBooking);
router.post('/:id/verify', protect, verifyBookingOtp);
router.post('/:id/start-service', protect, startService);
router.post('/:id/verify-start-otp', protect, verifyStartOtp);
router.post('/:id/finish-service', protect, finishService);
router.post('/:id/verify-end-otp', protect, verifyEndOtp);
router.post('/:id/resend-otp', protect, resendOtp);

export default router;
