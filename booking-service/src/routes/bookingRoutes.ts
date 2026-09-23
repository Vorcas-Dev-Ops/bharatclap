import express from 'express';
import axios from 'axios';
import { BookingRepository } from '../repositories/bookingRepository';
import { getDb } from '../config/db';
import { createBooking } from '../controllers/booking/createController';
import { getAllBookings, getMyBookings, getBookingById, getBookingsBatch, getProviderBookingStats, getProviderBookingStatsBatch, getBookingsByUserId, getBookingsByProvider, getBookingActivity, checkAvailability, getCompletedUnsettledBookings } from '../controllers/booking/queryController';
import { updateBookingStatus, assignProviderInternal, unassignProviderInternal, cancelBooking, getActiveBookingByProvider, updatePaymentStatusInternal, rescheduleBooking } from '../controllers/booking/lifecycleController';
import { startService, verifyStartOtp, finishService, verifyEndOtp, verifyBookingOtp, resendOtp } from '../controllers/booking/otpController';
import { validateProviderArrival } from '../controllers/providerJobExecutionController';
import { handleCustomerCancellation } from '../controllers/customerCancellationController';
import { protect, admin, checkPermission } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';
import { validate, createBookingSchema } from '../middleware/validate';

import { getInternalServiceKey } from '@bharatclap/shared';
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const getInternalKey = getInternalServiceKey;


import { validateSchedule } from '../controllers/booking/scheduleValidationController';

const router = express.Router();

router.post('/validate-schedule', protect, validateSchedule);
router.post('/check-availability', checkAvailability);

router.route('/')
  .post(protect, validate(createBookingSchema), createBooking)
  .get(protect, admin, checkPermission('bookings', 'view'), getAllBookings);

if (process.env.NODE_ENV === 'development') {
  router.post('/debug-redispatch', protect, admin, async (req, res) => {
    const { booking_id } = req.body;
    const booking = await BookingRepository.findByBookingId(booking_id);
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
      const db = getDb();
      for (const r of results) {
        if (r.provider_id) {
          await db.query(
            `UPDATE booking.bookings
             SET provider_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
                 version = version + 1,
                 updated_at = NOW()
             WHERE id::text = $2 OR legacy_mongo_id = $2 OR booking_id = $2`,
            [String(r.provider_id), String(r.booking_id)]
          );
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
router.put('/internal/:id/unassign', internalAuth, unassignProviderInternal);
router.get('/internal/completed-unsettled', internalAuth, getCompletedUnsettledBookings);
router.get('/internal/active-booking/:providerId', internalAuth, getActiveBookingByProvider);
router.get('/internal/:id', internalAuth, getBookingById);
router.post('/internal/update-payment-status', internalAuth, updatePaymentStatusInternal);
router.post('/internal/coupons/usage-check', internalAuth, checkCouponUsageInternal);
router.post('/internal/coupons/apply', internalAuth, applyCouponInternal);
router.post('/internal/coupons/release', internalAuth, releaseCouponInternal);

router.get('/:id', protect, getBookingById);
router.get('/:id/activity', protect, admin, checkPermission('bookings', 'view'), getBookingActivity);
router.put('/:id/status', protect, updateBookingStatus);
router.put('/:id/cancel', protect, handleCustomerCancellation);
router.put('/:id/reschedule', protect, rescheduleBooking);
router.post('/:id/arrival-check', protect, validateProviderArrival);
router.post('/:id/verify', protect, verifyBookingOtp);
router.post('/:id/start-service', protect, startService);
router.post('/:id/verify-start-otp', protect, verifyStartOtp);
router.post('/:id/finish-service', protect, finishService);
router.post('/:id/verify-end-otp', protect, verifyEndOtp);
router.post('/:id/resend-otp', protect, resendOtp);

// Payment collection routes
import { collectCash, requestUpi, regeneratePaymentLink, confirmCashPayment, disputePayment, adminPaymentOverride, adminResendLink, adminCancelLink, adminMarkOffline, adminForceSettlement, adminRetrySettlement, adminRetryPayout, internalUpiConfirmed, getPaymentCollectionStatus, getPaymentCollectionAudit } from '../controllers/booking/paymentCollectionController';

router.post('/:id/collect-cash', protect, collectCash);
router.post('/:id/payment/collect-cash', protect, collectCash);
router.post('/:id/request-upi', protect, requestUpi);
router.post('/:id/regenerate-payment-link', protect, regeneratePaymentLink);
router.post('/:id/confirm-cash-payment', protect, confirmCashPayment);
router.post('/:id/dispute-payment', protect, disputePayment);
router.post('/:id/admin-payment-override', protect, admin, adminPaymentOverride);
router.post('/:id/admin-resend-link', protect, admin, adminResendLink);
router.post('/:id/admin-cancel-link', protect, admin, adminCancelLink);
router.post('/:id/admin-mark-offline', protect, admin, adminMarkOffline);
router.post('/:id/admin-force-settlement', protect, admin, adminForceSettlement);
router.post('/:id/admin-retry-settlement', protect, admin, adminRetrySettlement);
router.post('/:id/admin-retry-payout', protect, admin, adminRetryPayout);
router.get('/:id/payment-collection', protect, getPaymentCollectionStatus);
router.get('/:id/payment-collection-audit', protect, admin, getPaymentCollectionAudit);

// Internal: called by payment-service webhook
router.post('/internal/payment-collection/upi-confirmed', internalAuth, internalUpiConfirmed);

export default router;
