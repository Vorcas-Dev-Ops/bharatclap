import express from 'express';
import axios from 'axios';
import { Booking } from '../models/Booking';
import { createBooking } from '../controllers/booking/createController';
import { getAllBookings, getMyBookings, getBookingById, getBookingsBatch, getProviderBookingStats, getProviderBookingStatsBatch, getBookingsByUserId, getBookingsByProvider, getBookingActivity, checkAvailability } from '../controllers/booking/queryController';
import { updateBookingStatus, assignProviderInternal, cancelBooking, getActiveBookingByProvider, updatePaymentStatusInternal, rescheduleBooking } from '../controllers/booking/lifecycleController';
import { startService, verifyStartOtp, finishService, verifyEndOtp, verifyBookingOtp, resendOtp } from '../controllers/booking/otpController';
import { protect, admin, checkPermission } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';
import { validate, createBookingSchema } from '../middleware/validate';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const getInternalKey = () => process.env.INTERNAL_SERVICE_KEY || '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

const router = express.Router();

router.post('/check-availability', checkAvailability);

router.route('/')
  .post(protect, validate(createBookingSchema), createBooking)
  .get(protect, admin, checkPermission('bookings', 'view'), getAllBookings);

if (process.env.NODE_ENV === 'development') {
  router.post('/debug-redispatch', protect, admin, async (req, res) => {
    const { booking_id } = req.body;
    const booking = await Booking.findOne({ booking_id }).lean();
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }

    try {
      const addrRes = await axios.post(`${AUTH_URL}/api/address/batch`, { ids: [String(booking.address_id)] }, { headers: { 'x-internal-service-key': getInternalKey() } });
      const address = addrRes.data?.[0];
      if (!address) { res.json({ error: 'Address not found', address_id: booking.address_id }); return; }

      const dispRes = await axios.post(`${PROV_URL}/api/providers/internal/dispatch-batch`, {
        bookings: [booking],
        address
      }, { headers: { 'x-internal-service-key': getInternalKey() } });

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
}

router.get('/my', protect, getMyBookings);
router.get('/user', protect, getMyBookings);
router.get('/user/bookings', protect, getMyBookings);
router.post('/batch', internalAuth, getBookingsBatch);
router.get('/user/:userId', protect, admin, getBookingsByUserId);
router.get('/provider/:providerId/stats', internalAuth, getProviderBookingStats);
router.post('/provider-stats-batch', internalAuth, getProviderBookingStatsBatch);
router.get('/provider/:providerId', protect, getBookingsByProvider);

import { checkCouponUsageInternal, applyCouponInternal, releaseCouponInternal } from '../controllers/booking/couponRedemptionController';

// Internal route — only callable by services with x-internal-service-key
router.put('/internal/:id/assign', internalAuth, assignProviderInternal);
router.get('/internal/:id', internalAuth, getBookingById);
router.get('/internal/active-booking/:providerId', internalAuth, getActiveBookingByProvider);
router.post('/internal/update-payment-status', internalAuth, updatePaymentStatusInternal);
router.post('/internal/coupons/usage-check', internalAuth, checkCouponUsageInternal);
router.post('/internal/coupons/apply', internalAuth, applyCouponInternal);
router.post('/internal/coupons/release', internalAuth, releaseCouponInternal);

// NOTE: debug-dispatch removed from production — use only in dev environments
// router.get('/debug-dispatch', debugDispatch);

router.get('/:id', protect, getBookingById);
router.get('/:id/activity', protect, admin, checkPermission('bookings', 'view'), getBookingActivity);
router.put('/:id/status', protect, updateBookingStatus);
router.put('/:id/cancel', protect, cancelBooking);
router.put('/:id/reschedule', protect, rescheduleBooking);
router.post('/:id/verify', protect, verifyBookingOtp);
router.post('/:id/start-service', protect, startService);
router.post('/:id/verify-start-otp', protect, verifyStartOtp);
router.post('/:id/finish-service', protect, finishService);
router.post('/:id/verify-end-otp', protect, verifyEndOtp);
router.post('/:id/resend-otp', protect, resendOtp);

export default router;
