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
  enqueueSmsNotification,
  emitSocketEvent,
} from '../../utils/internalApi';

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
    const { beforePhotos } = req.body;
    if (!beforePhotos || !Array.isArray(beforePhotos) || beforePhotos.length === 0) {
      res.status(400).json({ message: 'Before photos are required to start the service' });
      return;
    }

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

    if (booking.status !== 'accepted' && booking.status !== 'arrived') {
      res.status(400).json({ message: `Cannot start service from status: ${booking.status}. Booking must be 'accepted' or 'arrived'.` });
      return;
    }

    const otp = generate6DigitOtp();
    booking.start_otp = otp;
    booking.startOtp = hashOtp(otp); // Store hash for verification
    booking.startOtpGeneratedAt = new Date();
    booking.startOtpAttempts = 0;
    booking.startOtpVerified = false;
    booking.beforePhotos = beforePhotos;
    booking.status = 'waiting_start_otp';

    await booking.save();

    // 1. Push OTP to customer's browser in real-time (no SMS/email needed)
    emitSocketEvent(booking.user_id.toString(), 'otp_generated', {
      type: 'start',
      otp, // Send plaintext to customer; only hash is stored in DB
      bookingId: booking._id,
      bookingRef: booking.booking_id,
    }).catch(console.error);

    // 2. Also send in-app notification + SMS as fallback
    sendOtpToCustomer(booking, otp, 'start').catch(console.error);

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

    if (booking.status !== 'waiting_start_otp') {
      res.status(400).json({ message: 'Booking is not waiting for start OTP verification' });
      return;
    }

    const attempts = booking.startOtpAttempts || 0;
    if (attempts >= 5) {
      res.status(400).json({ message: 'Maximum OTP verification attempts (5) exceeded. Please request a new OTP.' });
      return;
    }

    const generatedAt = booking.startOtpGeneratedAt;
    if (!generatedAt || Date.now() - new Date(generatedAt).getTime() > 10 * 60 * 1000) {
      res.status(400).json({ message: 'OTP has expired (10 minutes limit). Please request a new OTP.' });
      return;
    }

    if (booking.startOtp !== hashOtp(otp)) {
      booking.startOtpAttempts = attempts + 1;
      await booking.save();
      res.status(400).json({ message: `Incorrect OTP. ${5 - (attempts + 1)} attempts remaining.` });
      return;
    }

    // Success
    booking.startOtpVerified = true;
    booking.startOtp = undefined; // Clear hash — single-use
    booking.serviceStartedAt = new Date();
    booking.status = 'in_progress';
    booking.started_at = new Date();

    await booking.save();

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

    // Idempotency: End OTP already generated
    if (booking.status === 'waiting_end_otp') {
      res.json({ message: 'End OTP already sent to customer', status: booking.status });
      return;
    }

    if (booking.status !== 'in_progress') {
      res.status(400).json({ message: `Cannot finish service from status: ${booking.status}. Booking must be 'in_progress'.` });
      return;
    }

    const otp = generate6DigitOtp();
    booking.completion_otp = otp;
    booking.endOtp = hashOtp(otp); // Store hash, not plaintext
    booking.endOtpGeneratedAt = new Date();
    booking.endOtpAttempts = 0;
    booking.endOtpVerified = false;
    booking.afterPhotos = afterPhotos;
    booking.status = 'waiting_end_otp';

    await booking.save();

    // 1. Push OTP to customer's browser in real-time
    emitSocketEvent(booking.user_id.toString(), 'otp_generated', {
      type: 'end',
      otp, // Send plaintext to customer; only hash is stored in DB
      bookingId: booking._id,
      bookingRef: booking.booking_id,
    }).catch(console.error);

    // 2. Also send in-app notification + SMS as fallback
    sendOtpToCustomer(booking, otp, 'end').catch(console.error);

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

    // Idempotency: already completed
    if (booking.status === 'completed') {
      res.json({ message: 'Booking already completed', booking });
      return;
    }

    if (booking.status !== 'waiting_end_otp') {
      res.status(400).json({ message: 'Booking is not waiting for end OTP verification' });
      return;
    }

    const attempts = booking.endOtpAttempts || 0;
    if (attempts >= 5) {
      res.status(400).json({ message: 'Maximum OTP verification attempts (5) exceeded. Please request a new OTP.' });
      return;
    }

    const generatedAt = booking.endOtpGeneratedAt;
    if (!generatedAt || Date.now() - new Date(generatedAt).getTime() > 10 * 60 * 1000) {
      res.status(400).json({ message: 'OTP has expired (10 minutes limit). Please request a new OTP.' });
      return;
    }

    if (booking.endOtp !== hashOtp(otp)) {
      booking.endOtpAttempts = attempts + 1;
      await booking.save();
      res.status(400).json({ message: `Incorrect OTP. ${5 - (attempts + 1)} attempts remaining.` });
      return;
    }

    // Success
    booking.endOtpVerified = true;
    booking.endOtp = undefined; // Invalidate OTP immediately
    booking.serviceEndedAt = new Date();
    booking.completed_at = new Date(); // keeping compatibility for existing code

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

    booking.status = 'completed';
    (booking as any).commission_percentage = commissionPercentage;
    (booking as any).commission_amount = commissionAmount;
    (booking as any).provider_payout = providerPayout;

    // Trigger mock invoice generation
    booking.invoice_url = `/invoices/${booking.booking_id}.pdf`;

    await booking.save();

    // 1. Consume locked coupon (if any)
    try {
      const { CouponRedemption } = await import('../../models/CouponRedemption');
      const redemption = await CouponRedemption.findOne({ bookingId: booking._id, status: 'locked' });
      if (redemption) {
        redemption.status = 'consumed';
        await redemption.save();
        console.log(`[BOOKING] Locked coupon ${redemption.couponCode} consumed for booking ${booking._id}`);

        // Update catalog-service global counters
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

    // 2. Trigger auth-service customer referral completion evaluation
    const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
    axios.post(`${AUTH_URL}/api/referrals/internal/on-booking-completed`, {
      userId: booking.user_id.toString(),
      bookingId: booking._id.toString()
    }, {
      headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
    }).catch(e => console.error('[BOOKING] Failed to evaluate referral conversion in auth-service:', e.message));

    // Trigger provider settlement creation
    if (booking.provider_id) {
      const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
      axios.post(`${PROV_URL}/api/providers/internal/settlements/create`, {
        provider_id: booking.provider_id,
        booking_id: booking._id,
        booking_display_id: booking.booking_id,
        payment_type: booking.payment_method === 'cod' ? 'cod' : 'online',
        payable_amount: booking.payable_amount,
        commission_percentage: commissionPercentage
      }, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
      }).catch(e => console.error('[BOOKING] Failed to trigger settlement creation:', e.message));

      // Trigger provider referral first-job reward evaluation
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

    // Trigger provider settlement creation
    if (booking.provider_id) {
      const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
      axios.post(`${PROV_URL}/api/providers/internal/settlements/create`, {
        provider_id: booking.provider_id,
        booking_id: booking._id,
        booking_display_id: booking.booking_id,
        payment_type: booking.payment_method === 'cod' ? 'cod' : 'online',
        payable_amount: booking.payable_amount,
        commission_percentage: commissionPercentage
      }, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
      }).catch(e => console.error('[BOOKING] Failed to trigger settlement creation:', e.message));
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
      booking.start_otp = newOtp;
      booking.startOtp = hashOtp(newOtp); // Store hash, not plaintext
      booking.startOtpGeneratedAt = new Date();
      booking.startOtpAttempts = 0;
      await booking.save();

      // Push new OTP to customer's browser in real-time
      emitSocketEvent(booking.user_id.toString(), 'otp_generated', {
        type: 'start',
        otp: newOtp,
        bookingId: booking._id,
        bookingRef: booking.booking_id,
      }).catch(console.error);

      sendOtpToCustomer(booking, newOtp, 'start').catch(console.error);
    } else {
      if (booking.status !== 'waiting_end_otp') {
        res.status(400).json({ message: 'Booking status is not waiting for end OTP' });
        return;
      }

      const generatedAt = booking.endOtpGeneratedAt;
      if (generatedAt && Date.now() - new Date(generatedAt).getTime() < 60000) {
        const remaining = Math.ceil((60000 - (Date.now() - new Date(generatedAt).getTime())) / 1000);
        res.status(400).json({ message: `Please wait ${remaining} seconds before requesting another OTP.` });
        return;
      }

      const newOtp = generate6DigitOtp();
      booking.completion_otp = newOtp;
      booking.endOtp = hashOtp(newOtp); // Store hash, not plaintext
      booking.endOtpGeneratedAt = new Date();
      booking.endOtpAttempts = 0;
      await booking.save();

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
