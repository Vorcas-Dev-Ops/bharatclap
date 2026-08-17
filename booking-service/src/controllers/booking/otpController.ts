import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Booking } from '../../models/Booking';
import crypto from 'crypto';
import axios from 'axios';
import {
  getUsersBatch,
  getProvidersBatch,
  getActiveMembershipFeatures,
  sendNotification,
  sendProviderNotification,
  enqueueSmsNotification,
  emitSocketEvent,
} from '../../utils/internalApi';

import { BookingActivity } from '../../models/BookingActivity';

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES) || 15;
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5;

// Helper to generate a secure random 6-digit OTP
const generate6DigitOtp = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

// SHA-256 hash for short-lived OTPs (bcrypt is for long-lived passwords)
const hashOtp = (otp: string): string =>
  crypto.createHash('sha256').update(otp).digest('hex');

// Helper to send OTP notifications to customer
const sendOtpToCustomer = async (booking: any, otp: string, type: 'start' | 'end') => {
  try {
    const users = await getUsersBatch([booking.user_id.toString()]);
    const customer = users.length > 0 ? users[0] : null;

    if (!customer) {
      console.error('[OTP SEND] Customer not found for booking:', booking._id);
      return;
    }

    const customerName = customer.name || 'Valued Customer';
    const title = type === 'start' ? 'Start OTP for BharatClap Service' : 'End OTP for BharatClap Service';
    const body = type === 'start'
      ? `Hello ${customerName}, your Start OTP is ${otp}. Share this with the provider ONLY when they arrive and are ready to start the service.`
      : `Hello ${customerName}, your End OTP is ${otp}. Share this with the provider ONLY when the service is fully completed to your satisfaction.`;

    // 1. In-app notification
    await sendNotification(booking.user_id.toString(), title, body, 'booking_alert', { booking_id: booking._id });

    // 2. SMS notification (if phone exists)
    if (customer.phone) {
      await enqueueSmsNotification(customer.phone, title, body);
    }
  } catch (error: any) {
    console.error('[OTP SEND] Error sending OTP:', error.message);
  }
};

// Helper to check provider authorization
const checkProviderAuth = async (req: AuthRequest, booking: any, res: Response): Promise<boolean> => {
  if (req.user?.role === 'admin') {
    return true;
  }

  let providerId: string | null = null;
  try {
    const token = req.headers.authorization;
    const response = await axios.get(`${process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003'}/api/providers/me`, {
      headers: { Authorization: token }
    });
    const provider = response.data;
    if (provider) providerId = provider._id.toString();
  } catch (err) {
    res.status(500).json({ message: 'Failed to authenticate provider' });
    return false;
  }

  if (!providerId || booking.provider_id?.toString() !== providerId) {
    res.status(403).json({ message: 'Not authorized: You are not the assigned provider for this booking' });
    return false;
  }

  return true;
};

// @desc    Start service - Generate Start OTP
// @route   POST /api/bookings/:id/start-service
// @access  Private (Provider)
export const startService = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const beforePhotos = req.body.beforePhotos && Array.isArray(req.body.beforePhotos) ? req.body.beforePhotos : [];

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const authorized = await checkProviderAuth(req, booking, res);
    if (!authorized) return;

    // Idempotency: OTP already generated for this booking
    if (booking.status === 'waiting_start_otp') {
      res.json({ message: 'Start OTP already sent to customer', status: booking.status });
      return;
    }

    // ponytail: enforce grace period limit (60 mins post scheduled time) on start service
    const GRACE_PERIOD_MS = 60 * 60 * 1000;
    if (booking.scheduled_at && (Date.now() - new Date(booking.scheduled_at).getTime()) > GRACE_PERIOD_MS && !booking.started_at) {
      booking.status = 'expired' as any;
      booking.cancelled_at = new Date();
      booking.cancellation_reason = 'Booking expired: service not started within grace period';
      await booking.save();
      res.status(400).json({ message: 'Booking has expired. Service cannot be started after grace period.' });
      return;
    }

    const validStartStatuses = ['accepted', 'confirmed', 'ready_confirmed', 'on_the_way', 'arrived', 'reached', 'waiting_start_otp'];
    if (!validStartStatuses.includes(booking.status)) {
      res.status(400).json({ message: `Cannot start service from status: ${booking.status}.` });
      return;
    }

    const otp = generate6DigitOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    booking.start_otp = otp;
    booking.startOtp = hashOtp(otp); // Store hash for verification
    booking.startOtpGeneratedAt = now;
    booking.startOtpExpiresAt = expiresAt;
    booking.startOtpAttempts = 0;
    booking.startOtpVerified = false;
    booking.beforePhotos = beforePhotos;
    booking.status = 'waiting_start_otp';

    await booking.save();

    // Audit logs
    BookingActivity.create({
      booking_id: booking._id,
      action: 'START_OTP_GENERATED',
      actor: 'provider',
      actor_id: req.user?._id,
      details: { expiresAt, attempts: 0 },
      timestamp: now,
    }).catch(console.error);

    // 1. Push OTP to customer's browser in real-time (no SMS/email needed)
    emitSocketEvent(booking.user_id.toString(), 'otp_generated', {
      type: 'start',
      otp, // Send plaintext to customer; only hash is stored in DB
      bookingId: booking._id,
      bookingRef: booking.booking_id,
    }).catch(console.error);

    // 2. Also send in-app notification + SMS as fallback
    sendOtpToCustomer(booking, otp, 'start').then(() => {
      BookingActivity.create({
        booking_id: booking._id,
        action: 'START_OTP_SENT',
        actor: 'system',
        details: { type: 'start' },
        timestamp: new Date(),
      }).catch(console.error);
    }).catch(console.error);

    res.json({ message: 'Start OTP sent to customer successfully', status: booking.status });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify Start OTP
// @route   POST /api/bookings/:id/verify-start-otp
// @access  Private (Provider)
export const verifyStartOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { otp } = req.body;
    if (!otp) {
      res.status(400).json({ message: 'Please provide the OTP' });
      return;
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const authorized = await checkProviderAuth(req, booking, res);
    if (!authorized) return;

    // Idempotency: already verified — return current state
    if (booking.startOtpVerified === true || booking.status === 'in_progress') {
      res.json({ message: 'Service already started', booking });
      return;
    }

    // Idempotency: already verified or in-progress
    if (booking.startOtpVerified || ['in_progress', 'waiting_end_otp', 'service_completed', 'completed'].includes(booking.status)) {
      res.json({ message: 'Start OTP already verified', booking });
      return;
    }

    if (!['reached', 'arrived', 'waiting_start_otp', 'accepted', 'confirmed', 'ready_confirmed', 'on_the_way'].includes(booking.status)) {
      res.status(400).json({ message: 'Booking is not in a state waiting for start OTP verification' });
      return;
    }

    const attempts = booking.startOtpAttempts || 0;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      BookingActivity.create({
        booking_id: booking._id,
        action: 'OTP_MAX_ATTEMPTS_REACHED',
        actor: 'provider',
        actor_id: req.user?._id,
        details: { type: 'start', attempts },
        timestamp: new Date(),
      }).catch(console.error);
      res.status(400).json({ message: `Maximum OTP verification attempts (${OTP_MAX_ATTEMPTS}) exceeded. Please request a new OTP.` });
      return;
    }

    const expiresAt = booking.startOtpExpiresAt;
    const generatedAt = booking.startOtpGeneratedAt;
    const isExpired = expiresAt
      ? Date.now() > new Date(expiresAt).getTime()
      : (generatedAt && Date.now() - new Date(generatedAt).getTime() > OTP_EXPIRY_MINUTES * 60 * 1000);

    if (isExpired) {
      BookingActivity.create({
        booking_id: booking._id,
        action: 'START_OTP_EXPIRED',
        actor: 'system',
        details: { expiresAt: expiresAt || generatedAt },
        timestamp: new Date(),
      }).catch(console.error);
      res.status(400).json({ message: 'OTP has expired. Please request a new OTP.' });
      return;
    }

    const isOtpValid = (booking.startOtp && booking.startOtp === hashOtp(otp)) ||
                       (booking.start_otp && (String(booking.start_otp).trim() === String(otp).trim() || String(booking.start_otp).padStart(4, '0') === String(otp).padStart(4, '0')));

    if (!isOtpValid) {
      const newAttempts = attempts + 1;
      booking.startOtpAttempts = newAttempts;
      await booking.save();

      BookingActivity.create({
        booking_id: booking._id,
        action: 'START_OTP_VERIFICATION_FAILED',
        actor: 'provider',
        actor_id: req.user?._id,
        details: { attempts: newAttempts, maxAttempts: OTP_MAX_ATTEMPTS },
        timestamp: new Date(),
      }).catch(console.error);

      if (newAttempts >= OTP_MAX_ATTEMPTS) {
        BookingActivity.create({
          booking_id: booking._id,
          action: 'OTP_MAX_ATTEMPTS_REACHED',
          actor: 'provider',
          actor_id: req.user?._id,
          details: { type: 'start', attempts: newAttempts },
          timestamp: new Date(),
        }).catch(console.error);
      }

      res.status(400).json({ message: `Incorrect OTP. ${OTP_MAX_ATTEMPTS - newAttempts} attempts remaining.` });
      return;
    }

    // Success
    const now = new Date();
    booking.startOtpVerified = true;
    booking.startOtpVerifiedAt = now;
    booking.startOtp = undefined; // Clear hash — single-use
    booking.serviceStartedAt = now;
    booking.status = 'in_progress';
    booking.started_at = now;

    await booking.save();

    BookingActivity.create({
      booking_id: booking._id,
      action: 'START_OTP_VERIFICATION_SUCCESS',
      actor: 'provider',
      actor_id: req.user?._id,
      details: { verifiedAt: now },
      timestamp: now,
    }).catch(console.error);

    // Trigger Service Started user notification
    sendNotification(
      booking.user_id.toString(),
      'Service Started',
      `Your service for booking ${booking.booking_id} has started.`,
      'booking_alert',
      { booking_id: booking._id }
    ).catch(err => console.error('[NOTIFICATION] Failed to send Service Started notification:', err));

    res.json({ message: 'Service started successfully', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Finish service - Generate End OTP
// @route   POST /api/bookings/:id/finish-service
// @access  Private (Provider)
export const finishService = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { afterPhotos } = req.body;
    if (!afterPhotos || !Array.isArray(afterPhotos) || afterPhotos.length === 0) {
      res.status(400).json({ message: 'After photos are required to complete the service' });
      return;
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const authorized = await checkProviderAuth(req, booking, res);
    if (!authorized) return;

    // ponytail: allow re-triggering End OTP if provider clicks Finish Service again
    if (!['in_progress', 'waiting_end_otp'].includes(booking.status)) {
      res.status(400).json({ message: `Cannot finish service from status: ${booking.status}. Booking must be 'in_progress' or 'waiting_end_otp'.` });
      return;
    }

    const otp = generate6DigitOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    booking.completion_otp = otp;
    booking.endOtp = hashOtp(otp); // Store hash, not plaintext
    booking.endOtpGeneratedAt = now;
    booking.endOtpExpiresAt = expiresAt;
    booking.endOtpAttempts = 0;
    booking.endOtpVerified = false;
    booking.afterPhotos = afterPhotos;
    booking.status = 'waiting_end_otp';

    await booking.save();

    // Audit logs
    BookingActivity.create({
      booking_id: booking._id,
      action: 'END_OTP_GENERATED',
      actor: 'provider',
      actor_id: req.user?._id,
      details: { expiresAt, attempts: 0 },
      timestamp: now,
    }).catch(console.error);

    // 1. Push OTP to customer's browser in real-time
    emitSocketEvent(booking.user_id.toString(), 'otp_generated', {
      type: 'end',
      otp, // Send plaintext to customer; only hash is stored in DB
      bookingId: booking._id,
      bookingRef: booking.booking_id,
    }).catch(console.error);

    // 2. Also send in-app notification + SMS as fallback
    sendOtpToCustomer(booking, otp, 'end').then(() => {
      BookingActivity.create({
        booking_id: booking._id,
        action: 'END_OTP_SENT',
        actor: 'system',
        details: { type: 'end' },
        timestamp: new Date(),
      }).catch(console.error);
    }).catch(console.error);

    res.json({ message: 'End OTP sent to customer successfully', status: booking.status });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify End OTP and complete booking
// @route   POST /api/bookings/:id/verify-end-otp
// @access  Private (Provider)
export const verifyEndOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { otp } = req.body;
    if (!otp) {
      res.status(400).json({ message: 'Please provide the OTP' });
      return;
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const authorized = await checkProviderAuth(req, booking, res);
    if (!authorized) return;

    // Idempotency: already completed or verified (including COD service_completed)
    if (booking.endOtpVerified || ['completed', 'service_completed'].includes(booking.status)) {
      res.json({ message: 'Booking already completed', booking });
      return;
    }

    if (!['in_progress', 'waiting_end_otp'].includes(booking.status)) {
      res.status(400).json({ message: 'Booking is not in a state waiting for end OTP verification' });
      return;
    }

    const attempts = booking.endOtpAttempts || 0;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      BookingActivity.create({
        booking_id: booking._id,
        action: 'OTP_MAX_ATTEMPTS_REACHED',
        actor: 'provider',
        actor_id: req.user?._id,
        details: { type: 'end', attempts },
        timestamp: new Date(),
      }).catch(console.error);
      res.status(400).json({ message: `Maximum OTP verification attempts (${OTP_MAX_ATTEMPTS}) exceeded. Please request a new OTP.` });
      return;
    }

    const expiresAt = booking.endOtpExpiresAt;
    const generatedAt = booking.endOtpGeneratedAt;
    const isExpired = expiresAt
      ? Date.now() > new Date(expiresAt).getTime()
      : (generatedAt && Date.now() - new Date(generatedAt).getTime() > OTP_EXPIRY_MINUTES * 60 * 1000);

    if (isExpired) {
      BookingActivity.create({
        booking_id: booking._id,
        action: 'END_OTP_EXPIRED',
        actor: 'system',
        details: { expiresAt: expiresAt || generatedAt },
        timestamp: new Date(),
      }).catch(console.error);
      res.status(400).json({ message: 'OTP has expired. Please request a new OTP.' });
      return;
    }

    const isOtpValid = (booking.endOtp && booking.endOtp === hashOtp(otp)) ||
                       (booking.completion_otp && (String(booking.completion_otp).trim() === String(otp).trim() || String(booking.completion_otp).padStart(4, '0') === String(otp).padStart(4, '0')));

    if (!isOtpValid) {
      const newAttempts = attempts + 1;
      booking.endOtpAttempts = newAttempts;
      await booking.save();

      BookingActivity.create({
        booking_id: booking._id,
        action: 'END_OTP_VERIFICATION_FAILED',
        actor: 'provider',
        actor_id: req.user?._id,
        details: { attempts: newAttempts, maxAttempts: OTP_MAX_ATTEMPTS },
        timestamp: new Date(),
      }).catch(console.error);

      if (newAttempts >= OTP_MAX_ATTEMPTS) {
        BookingActivity.create({
          booking_id: booking._id,
          action: 'OTP_MAX_ATTEMPTS_REACHED',
          actor: 'provider',
          actor_id: req.user?._id,
          details: { type: 'end', attempts: newAttempts },
          timestamp: new Date(),
        }).catch(console.error);
      }

      res.status(400).json({ message: `Incorrect OTP. ${OTP_MAX_ATTEMPTS - newAttempts} attempts remaining.` });
      return;
    }

    // Success
    const now = new Date();
    booking.endOtpVerified = true;
    booking.endOtpVerifiedAt = now;
    booking.endOtp = undefined; // Invalidate OTP immediately
    booking.serviceEndedAt = now;

    // Calculate payouts
    let commissionPercentage = 15; // Default system commission
    if (booking.provider_id) {
      const providers = await getProvidersBatch([booking.provider_id.toString()]);
      const provider = providers.length > 0 ? providers[0] : null;

      if (provider && provider.user_id) {
        const membership = await getActiveMembershipFeatures(provider.user_id.toString());
        if (membership && membership.role === 'provider' && membership.providerConfig?.commissionPercentage !== undefined) {
          commissionPercentage = membership.providerConfig.commissionPercentage;
        }
      }
    }

    const commissionAmount = (booking.payable_amount * commissionPercentage) / 100;
    const providerPayout = booking.payable_amount - commissionAmount;

    (booking as any).commission_percentage = commissionPercentage;
    (booking as any).commission_amount = commissionAmount;
    (booking as any).provider_payout = providerPayout;

    // Trigger mock invoice generation
    booking.invoice_url = `/invoices/${booking.booking_id}.pdf`;

    const isPrepaid = booking.payment_method !== 'cod' && (booking.payment_status === 'paid' || booking.payment_status === 'completed');

    if (isPrepaid) {
      // Prepaid: complete immediately (existing behavior)
      booking.status = 'completed';
      booking.completed_at = now;
      booking.finance_status = 'payment_verified'; // ponytail: prepaid money already collected
      (booking as any).payment_collection = {
        status: 'verified',
        method: 'prepaid',
        final_amount: booking.payable_amount,
        collected_amount: booking.payable_amount,
        remaining_amount: 0,
        confirmed_by: 'system',
        confirmed_at: now,
        attempts: 0,
        financial_snapshot: {
          subtotal: booking.service_price,
          extra_charges: booking.slot_charge || 0,
          taxes: 0,
          discount: booking.discount_amount || 0,
          final_amount: booking.payable_amount,
          platform_commission: commissionAmount,
          provider_earning: providerPayout,
        },
        payout: { status: 'pending' },
      };

      await booking.save();

      BookingActivity.create({
        booking_id: booking._id,
        action: 'END_OTP_VERIFICATION_SUCCESS',
        actor: 'provider',
        actor_id: req.user?._id,
        details: { verifiedAt: now, commissionAmount, providerPayout, flow: 'prepaid' },
        timestamp: now,
      }).catch(console.error);

      // Consume locked coupon (if any)
      try {
        const { CouponRedemption } = await import('../../models/CouponRedemption');
        const redemption = await CouponRedemption.findOne({ bookingId: booking._id, status: 'locked' });
        if (redemption) {
          redemption.status = 'consumed';
          await redemption.save();
          console.log(`[BOOKING] Locked coupon ${redemption.couponCode} consumed for booking ${booking._id}`);
          const CATALOG_URL = process.env.CATALOG_SERVICE_URL || 'http://127.0.0.1:5002';
          axios.post(`${CATALOG_URL}/api/coupons/internal/consume`, {
            couponId: redemption.couponId,
            discountApplied: redemption.discountApplied
          }, {
            headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
          }).catch(e => console.error('[BOOKING] Failed to consume coupon globally in catalog-service:', e.message));
        }
      } catch (err: any) {
        console.error('[BOOKING] Coupon consumption handler failed:', err.message);
      }

      // Trigger auth-service customer referral completion evaluation
      const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
      axios.post(`${AUTH_URL}/api/referrals/internal/on-booking-completed`, {
        userId: booking.user_id.toString(),
        bookingId: booking._id.toString()
      }, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
      }).catch(e => console.error('[BOOKING] Failed to evaluate referral conversion in auth-service:', e.message));

      // Enqueue durable settlement outbox (poller handles delivery + retries)
      if (booking.provider_id) {
        const { SettlementOutbox } = await import('../../models/SettlementOutbox');
        SettlementOutbox.create({
          booking_id: booking._id,
          provider_id: booking.provider_id,
          booking_display_id: booking.booking_id,
          payment_type: 'online',
          payable_amount: booking.payable_amount,
          commission_percentage: commissionPercentage,
        }).catch(e => {
          // 11000 = duplicate key — already enqueued, safe to ignore
          if (e.code !== 11000) console.error('[BOOKING] Failed to enqueue settlement outbox:', e.message);
        });

        // Trigger provider referral first-job reward evaluation
        const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
        axios.post(`${PROV_URL}/api/providers/internal/referral/trigger-job-reward`, {
          providerId: booking.provider_id.toString(),
          bookingId: booking._id.toString()
        }, {
          headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
        }).catch(e => console.error('[BOOKING] Failed to trigger provider referral reward:', e.message));
      }

      // Send completion notifications asynchronously
      const completionMessage = `Your booking ${booking.booking_id} has been marked as completed successfully. Thank you for choosing BharatClap! You can now rate and review your service provider.`;
      sendNotification(booking.user_id.toString(), 'Booking Completed!', completionMessage, 'booking_alert', { booking_id: booking._id }).catch(console.error);

      if (booking.provider_id) {
        getProvidersBatch([booking.provider_id.toString()]).then(providers => {
          const provider = providers.length > 0 ? providers[0] : null;
          const providerUserId = provider?.user_id?._id?.toString() || provider?.user_id?.toString();
          if (providerUserId) {
            sendProviderNotification(providerUserId, 'Service Completed!', `Service for booking ${booking.booking_id} has been marked as completed. Thank you!`, 'booking_alert', { booking_id: booking._id }).catch(err => console.error('[NOTIFICATION] Failed to notify provider on completion:', err));
          }
        }).catch(err => console.error('[NOTIFICATION] Failed to fetch provider for completion notification:', err));
      }

      sendNotification(booking.user_id.toString(), 'Rate Your Experience', `Please take a moment to rate and review your service for booking ${booking.booking_id}.`, 'system_alert', { booking_id: booking._id }).catch(err => console.error('[NOTIFICATION] Failed to send review reminder:', err));

      const users = await getUsersBatch([booking.user_id.toString()]);
      const customer = users.length > 0 ? users[0] : null;
      if (customer && customer.phone) {
        enqueueSmsNotification(customer.phone, 'Booking Completed!', completionMessage).catch(console.error);
      }

      // Auto-release provider
      if (booking.provider_id) {
        const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
        axios.post(`${PROV_URL}/api/providers/internal/release`, {
          provider_id: booking.provider_id
        }, {
          headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
        }).catch(e => console.error('[BOOKING] Failed to release provider:', e.message));
      }

      res.json({ message: 'Booking completed successfully', booking });
    } else {
      // COD: transition to service_completed, defer settlement & provider release
      const PAYMENT_EXPIRY_HOURS = Number(process.env.PAYMENT_EXPIRY_HOURS) || 24;
      booking.status = 'service_completed' as any;
      booking.finance_status = 'collecting'; // ponytail: COD — awaiting cash/UPI from customer
      (booking as any).payment_collection = {
        status: 'pending',
        final_amount: booking.payable_amount,
        collected_amount: 0,
        remaining_amount: booking.payable_amount,
        attempts: 0,
        expires_at: new Date(now.getTime() + PAYMENT_EXPIRY_HOURS * 60 * 60 * 1000),
        financial_snapshot: {
          subtotal: booking.service_price,
          extra_charges: booking.slot_charge || 0,
          taxes: 0,
          discount: booking.discount_amount || 0,
          final_amount: booking.payable_amount,
          platform_commission: commissionAmount,
          provider_earning: providerPayout,
        },
        payout: { status: 'pending' },
      };

      await booking.save();

      // Log audit
      const { PaymentCollectionAudit } = await import('../../models/PaymentCollectionAudit');
      PaymentCollectionAudit.create({
        booking_id: booking._id,
        action: 'otp_verified',
        actor: 'provider',
        actor_id: req.user?._id,
        amount: booking.payable_amount,
        metadata: { commissionPercentage, commissionAmount, providerPayout },
        timestamp: now,
      }).catch(console.error);

      BookingActivity.create({
        booking_id: booking._id,
        action: 'END_OTP_VERIFICATION_SUCCESS',
        actor: 'provider',
        actor_id: req.user?._id,
        details: { verifiedAt: now, commissionAmount, providerPayout, flow: 'cod_payment_pending' },
        timestamp: now,
      }).catch(console.error);

      // Notify customer that payment is due
      sendNotification(
        booking.user_id.toString(),
        'Service Completed — Payment Due',
        `Your service for booking ${booking.booking_id} is complete. Please pay ₹${booking.payable_amount} to the provider.`,
        'payment_alert',
        { booking_id: booking._id }
      ).catch(console.error);

      // Notify provider to collect payment
      if (booking.provider_id) {
        getProvidersBatch([booking.provider_id.toString()]).then(providers => {
          const provider = providers.length > 0 ? providers[0] : null;
          const providerUserId = provider?.user_id?._id?.toString() || provider?.user_id?.toString();
          if (providerUserId) {
            sendProviderNotification(providerUserId, 'Collect Payment', `Please collect ₹${booking.payable_amount} for booking ${booking.booking_id}.`, 'payment_alert', { booking_id: booking._id }).catch(console.error);
          }
        }).catch(console.error);
      }

      res.json({
        message: 'Service completed. Payment collection pending.',
        booking,
        payment_collection: {
          status: 'pending',
          final_amount: booking.payable_amount,
          expires_at: (booking as any).payment_collection.expires_at,
        },
      });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify booking OTP
// @route   POST /api/bookings/:id/verify
// @access  Private
export const verifyBookingOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { otp } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    if (booking.start_otp !== otp) {
      res.status(400).json({ message: 'Invalid OTP' });
      return;
    }

    let commissionPercentage = 15; // Default system commission

    // Dynamic membership rule: Zero Commission for providers
    if (booking.provider_id) {
      const providers = await getProvidersBatch([booking.provider_id.toString()]);
      const provider = providers.length > 0 ? providers[0] : null;

      if (provider && provider.user_id) {
        const membership = await getActiveMembershipFeatures(provider.user_id.toString());
        if (membership && membership.role === 'provider' && membership.providerConfig?.commissionPercentage !== undefined) {
          commissionPercentage = membership.providerConfig.commissionPercentage;
        }
      }
    }

    const commissionAmount = (booking.payable_amount * commissionPercentage) / 100;
    const providerPayout = booking.payable_amount - commissionAmount;

    booking.status = 'completed';
    (booking as any).commission_percentage = commissionPercentage;
    (booking as any).commission_amount = commissionAmount;
    (booking as any).provider_payout = providerPayout;

    await booking.save();

    // Enqueue durable settlement outbox (poller handles delivery + retries)
    if (booking.provider_id) {
      const { SettlementOutbox } = await import('../../models/SettlementOutbox');
      SettlementOutbox.create({
        booking_id: booking._id,
        provider_id: booking.provider_id,
        booking_display_id: booking.booking_id,
        payment_type: booking.payment_method === 'cod' ? 'cod' : 'online',
        payable_amount: booking.payable_amount,
        commission_percentage: commissionPercentage,
      }).catch(e => {
        if (e.code !== 11000) console.error('[BOOKING] Failed to enqueue settlement outbox:', e.message);
      });
    }

    res.json({ message: 'Booking verified successfully', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resend OTP
// @route   POST /api/bookings/:id/resend-otp
// @access  Private (Provider)
export const resendOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.body; // 'start' or 'end'
    if (type !== 'start' && type !== 'end') {
      res.status(400).json({ message: "Invalid type. Must be 'start' or 'end'." });
      return;
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const authorized = await checkProviderAuth(req, booking, res);
    if (!authorized) return;

    if (type === 'start') {
      if (booking.status !== 'waiting_start_otp') {
        res.status(400).json({ message: 'Booking status is not waiting for start OTP' });
        return;
      }

      const generatedAt = booking.startOtpGeneratedAt;
      if (generatedAt && Date.now() - new Date(generatedAt).getTime() < 60000) {
        const remaining = Math.ceil((60000 - (Date.now() - new Date(generatedAt).getTime())) / 1000);
        res.status(400).json({ message: `Please wait ${remaining} seconds before requesting another OTP.` });
        return;
      }

      const newOtp = generate6DigitOtp();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

      booking.start_otp = newOtp;
      booking.startOtp = hashOtp(newOtp); // Store hash, not plaintext
      booking.startOtpGeneratedAt = now;
      booking.startOtpExpiresAt = expiresAt;
      booking.startOtpAttempts = 0;
      await booking.save();

      BookingActivity.create({
        booking_id: booking._id,
        action: 'START_OTP_RESENT',
        actor: 'provider',
        actor_id: req.user?._id,
        details: { expiresAt },
        timestamp: now,
      }).catch(console.error);

      // Push new OTP to customer's browser in real-time
      emitSocketEvent(booking.user_id.toString(), 'otp_generated', {
        type: 'start',
        otp: newOtp,
        bookingId: booking._id,
        bookingRef: booking.booking_id,
      }).catch(console.error);

      sendOtpToCustomer(booking, newOtp, 'start').catch(console.error);
    } else {
      if (!['in_progress', 'waiting_end_otp', 'service_completed'].includes(booking.status)) {
        res.status(400).json({ message: 'Booking status is not waiting for end OTP' });
        return;
      }
      booking.status = 'waiting_end_otp';

      const generatedAt = booking.endOtpGeneratedAt;
      if (generatedAt && Date.now() - new Date(generatedAt).getTime() < 60000) {
        const remaining = Math.ceil((60000 - (Date.now() - new Date(generatedAt).getTime())) / 1000);
        res.status(400).json({ message: `Please wait ${remaining} seconds before requesting another OTP.` });
        return;
      }

      const newOtp = generate6DigitOtp();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

      booking.completion_otp = newOtp;
      booking.endOtp = hashOtp(newOtp); // Store hash, not plaintext
      booking.endOtpGeneratedAt = now;
      booking.endOtpExpiresAt = expiresAt;
      booking.endOtpAttempts = 0;
      await booking.save();

      BookingActivity.create({
        booking_id: booking._id,
        action: 'END_OTP_RESENT',
        actor: 'provider',
        actor_id: req.user?._id,
        details: { expiresAt },
        timestamp: now,
      }).catch(console.error);

      // Push new OTP to customer's browser in real-time
      emitSocketEvent(booking.user_id.toString(), 'otp_generated', {
        type: 'end',
        otp: newOtp,
        bookingId: booking._id,
        bookingRef: booking.booking_id,
      }).catch(console.error);

      sendOtpToCustomer(booking, newOtp, 'end').catch(console.error);
    }

    res.json({ message: 'OTP resent successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
