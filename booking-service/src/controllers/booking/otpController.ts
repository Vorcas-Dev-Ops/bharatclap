import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getDb } from '../../config/db';
import { BookingRepository, mapBookingRow } from '../../repositories/bookingRepository';
import { logBookingActivity } from '../../utils/activityLogger';
import { PaymentCollectionAuditRepository } from '../../repositories/paymentCollectionAuditRepository';
import { CouponRedemptionRepository } from '../../repositories/couponRedemptionRepository';
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

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES) || 15;
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5;

const generate6DigitOtp = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

const hashOtp = (otp: string): string =>
  crypto.createHash('sha256').update(otp).digest('hex');

const safeCompareHashes = (storedHash?: string | null, candidateHash?: string | null): boolean => {
  if (!storedHash || !candidateHash) return false;
  try {
    const a = Buffer.from(storedHash, 'hex');
    const b = Buffer.from(candidateHash, 'hex');
    if (a.length !== b.length || a.length !== 32) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

const sendOtpToCustomer = async (booking: any, otp: string, type: 'start' | 'end') => {
  try {
    const users = await getUsersBatch([booking.user_id.toString()]);
    const customer = users.length > 0 ? users[0] : null;

    if (!customer) {
      console.error('[OTP SEND] Customer not found for booking:', booking.id);
      return;
    }

    const customerName = customer.name || 'Valued Customer';
    const title = type === 'start' ? 'Start OTP for BharatClap Service' : 'End OTP for BharatClap Service';
    const body = type === 'start'
      ? `Hello ${customerName}, your Start OTP is ${otp}. Share this with the provider ONLY when they arrive and are ready to start the service.`
      : `Hello ${customerName}, your End OTP is ${otp}. Share this with the provider ONLY when the service is fully completed to your satisfaction.`;

    await sendNotification(booking.user_id.toString(), title, body, 'booking_alert', { booking_id: booking.id });

    if (customer.phone) {
      await enqueueSmsNotification(customer.phone, title, body);
    }
  } catch (error: any) {
    console.error('[OTP SEND] Error sending OTP:', error.message);
  }
};

const checkProviderAuth = async (req: AuthRequest, booking: any, res: Response): Promise<boolean> => {
  if (req.user?.role === 'admin' || req.user?.role === 'super_admin') {
    return true;
  }

  let providerId: string | null = null;
  try {
    const token = req.headers.authorization;
    const response = await axios.get(`${process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003'}/api/providers/me`, {
      headers: { Authorization: token }
    });
    const provider = response.data;
    if (provider) providerId = String(provider._id || provider.id);
  } catch (err) {
    res.status(500).json({ message: 'Failed to authenticate provider' });
    return false;
  }

  if (!providerId || (booking.provider_id && String(booking.provider_id) !== providerId)) {
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
    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const authorized = await checkProviderAuth(req, booking, res);
    if (!authorized) return;

    if (booking.status === 'waiting_start_otp') {
      res.json({ message: 'Start OTP already sent to customer', status: booking.status });
      return;
    }

    const GRACE_PERIOD_MS = 60 * 60 * 1000;
    const db = getDb();

    if (booking.scheduled_at && (Date.now() - new Date(booking.scheduled_at).getTime()) > GRACE_PERIOD_MS && !booking.started_at) {
      await db.query(
        `UPDATE booking.bookings
         SET status = 'expired', cancelled_at = NOW(), cancellation_reason = 'Booking expired: service not started within grace period', version = version + 1, updated_at = NOW()
         WHERE id = $1`,
        [booking.id]
      );
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

    const otpHash = hashOtp(otp);
    await db.query(
      `UPDATE booking.bookings
       SET start_otp = $1,
           start_otp_generated_at = $2,
           start_otp_expires_at = $3,
           start_otp_attempts = 0,
           start_otp_verified = false,
           status = 'waiting_start_otp',
           version = version + 1,
           updated_at = NOW()
       WHERE id = $4`,
      [otpHash, now, expiresAt, booking.id]
    );

    await logBookingActivity(booking.id, 'START_OTP_GENERATED', 'provider', req.user?._id, { expiresAt, attempts: 0 });

    emitSocketEvent(booking.user_id, 'otp_generated', {
      type: 'start',
      otp,
      bookingId: booking.id,
      bookingRef: booking.booking_id,
    }).catch(console.error);

    sendOtpToCustomer(booking, otp, 'start').then(() => {
      logBookingActivity(booking.id, 'START_OTP_SENT', 'system', undefined, { type: 'start' }).catch(console.error);
    }).catch(console.error);

    res.json({ message: 'Start OTP sent to customer successfully', status: 'waiting_start_otp' });
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

    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const authorized = await checkProviderAuth(req, booking, res);
    if (!authorized) return;

    if (booking.status === 'in_progress') {
      res.json({ message: 'Service already started', booking });
      return;
    }

    if (!['reached', 'arrived', 'waiting_start_otp', 'accepted', 'confirmed', 'ready_confirmed', 'on_the_way'].includes(booking.status)) {
      res.status(400).json({ message: 'Booking is not in a state waiting for start OTP verification' });
      return;
    }

    const db = getDb();
    const attempts = booking.startOtpAttempts || 0;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await logBookingActivity(booking.id, 'OTP_MAX_ATTEMPTS_REACHED', 'provider', req.user?._id, { type: 'start', attempts });
      res.status(400).json({ message: `Maximum OTP verification attempts (${OTP_MAX_ATTEMPTS}) exceeded. Please request a new OTP.` });
      return;
    }

    const isExpired = booking.startOtpGeneratedAt && (Date.now() - new Date(booking.startOtpGeneratedAt).getTime() > OTP_EXPIRY_MINUTES * 60 * 1000);
    if (isExpired) {
      await logBookingActivity(booking.id, 'START_OTP_EXPIRED', 'system', undefined, { expiresAt: booking.startOtpGeneratedAt });
      res.status(400).json({ message: 'OTP has expired. Please request a new OTP.' });
      return;
    }

    // ponytail: constant-time hash comparison prevents timing attack
    const isOtpValid = safeCompareHashes(booking.start_otp, hashOtp(String(otp).trim()));

    if (!isOtpValid) {
      const newAttempts = attempts + 1;
      await db.query(
        `UPDATE booking.bookings SET start_otp_attempts = $1, version = version + 1, updated_at = NOW() WHERE id = $2`,
        [newAttempts, booking.id]
      );

      await logBookingActivity(booking.id, 'START_OTP_VERIFICATION_FAILED', 'provider', req.user?._id, { attempts: newAttempts, maxAttempts: OTP_MAX_ATTEMPTS });

      res.status(400).json({ message: `Incorrect OTP. ${OTP_MAX_ATTEMPTS - newAttempts} attempts remaining.` });
      return;
    }

    // Success
    const now = new Date();
    const resUpdate = await db.query(
      `UPDATE booking.bookings
       SET start_otp_verified = true,
           start_otp_verified_at = $1,
           service_started_at = $1,
           started_at = $1,
           status = 'in_progress',
           version = version + 1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [now, booking.id]
    );

    const updated = mapBookingRow(resUpdate.rows[0]);
    await logBookingActivity(booking.id, 'START_OTP_VERIFICATION_SUCCESS', 'provider', req.user?._id, { verifiedAt: now });

    sendNotification(
      updated.user_id,
      'Service Started',
      `Your service for booking ${updated.booking_id} has started.`,
      'booking_alert',
      { booking_id: updated.id }
    ).catch(err => console.error('[NOTIFICATION] Failed to send Service Started notification:', err));

    res.json({ message: 'Service started successfully', booking: updated });
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

    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const authorized = await checkProviderAuth(req, booking, res);
    if (!authorized) return;

    if (!['in_progress', 'waiting_end_otp'].includes(booking.status)) {
      res.status(400).json({ message: `Cannot finish service from status: ${booking.status}. Booking must be 'in_progress' or 'waiting_end_otp'.` });
      return;
    }

    const otp = generate6DigitOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const db = getDb();

    const otpHash = hashOtp(otp);
    await db.query(
      `UPDATE booking.bookings
       SET end_otp = $1,
           end_otp_generated_at = $2,
           end_otp_expires_at = $3,
           end_otp_attempts = 0,
           end_otp_verified = false,
           after_photos = $4,
           status = 'waiting_end_otp',
           version = version + 1,
           updated_at = NOW()
       WHERE id = $5`,
      [otpHash, now, expiresAt, afterPhotos, booking.id]
    );

    await logBookingActivity(booking.id, 'END_OTP_GENERATED', 'provider', req.user?._id, { expiresAt, attempts: 0 });

    emitSocketEvent(booking.user_id, 'otp_generated', {
      type: 'end',
      otp,
      bookingId: booking.id,
      bookingRef: booking.booking_id,
    }).catch(console.error);

    sendOtpToCustomer(booking, otp, 'end').then(() => {
      logBookingActivity(booking.id, 'END_OTP_SENT', 'system', undefined, { type: 'end' }).catch(console.error);
    }).catch(console.error);

    res.json({ message: 'End OTP sent to customer successfully', status: 'waiting_end_otp' });
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

    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const authorized = await checkProviderAuth(req, booking, res);
    if (!authorized) return;

    if (['completed', 'service_completed'].includes(booking.status)) {
      res.json({ message: 'Booking already completed', booking });
      return;
    }

    if (!['in_progress', 'waiting_end_otp'].includes(booking.status)) {
      res.status(400).json({ message: 'Booking is not in a state waiting for end OTP verification' });
      return;
    }

    const db = getDb();
    const attempts = booking.endOtpAttempts || 0;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await logBookingActivity(booking.id, 'OTP_MAX_ATTEMPTS_REACHED', 'provider', req.user?._id, { type: 'end', attempts });
      res.status(400).json({ message: `Maximum OTP verification attempts (${OTP_MAX_ATTEMPTS}) exceeded. Please request a new OTP.` });
      return;
    }

    const isExpired = booking.endOtpGeneratedAt && (Date.now() - new Date(booking.endOtpGeneratedAt).getTime() > OTP_EXPIRY_MINUTES * 60 * 1000);
    if (isExpired) {
      await logBookingActivity(booking.id, 'END_OTP_EXPIRED', 'system', undefined, { expiresAt: booking.endOtpGeneratedAt });
      res.status(400).json({ message: 'OTP has expired. Please request a new OTP.' });
      return;
    }

    // ponytail: constant-time hash comparison prevents timing attack
    const isOtpValid = safeCompareHashes(booking.end_otp, hashOtp(String(otp).trim()));

    if (!isOtpValid) {
      const newAttempts = attempts + 1;
      await db.query(
        `UPDATE booking.bookings SET end_otp_attempts = $1, version = version + 1, updated_at = NOW() WHERE id = $2`,
        [newAttempts, booking.id]
      );
      await logBookingActivity(booking.id, 'END_OTP_VERIFICATION_FAILED', 'provider', req.user?._id, { attempts: newAttempts, maxAttempts: OTP_MAX_ATTEMPTS });

      res.status(400).json({ message: `Incorrect OTP. ${OTP_MAX_ATTEMPTS - newAttempts} attempts remaining.` });
      return;
    }

    // Success
    const now = new Date();
    let commissionPercentage = 15;
    if (booking.provider_id) {
      const providers = await getProvidersBatch([booking.provider_id]);
      const provider = providers.length > 0 ? providers[0] : null;
      if (provider?.user_id) {
        const membership = await getActiveMembershipFeatures(provider.user_id.toString());
        if (membership && membership.role === 'provider' && membership.providerConfig?.commissionPercentage !== undefined) {
          commissionPercentage = membership.providerConfig.commissionPercentage;
        }
      }
    }

    const payableAmount = booking.payable_amount || booking.final_amount || 0;
    const commissionAmount = (payableAmount * commissionPercentage) / 100;
    const providerPayout = payableAmount - commissionAmount;

    const isPrepaid = booking.payment_status === 'paid' || booking.payment_status === 'completed';
    const nextStatus = isPrepaid ? 'completed' : 'service_completed';
    const nextFinanceStatus = isPrepaid ? 'payment_verified' : 'collecting';

    const resUpdate = await db.query(
      `UPDATE booking.bookings
       SET end_otp_verified = true,
           end_otp_verified_at = $1,
           service_ended_at = $1,
           completed_at = CASE WHEN $2 = 'completed' THEN $1 ELSE completed_at END,
           status = $2,
           finance_status = $3,
           commission_percentage = $4,
           commission_amount = $5,
           provider_payout = $6,
           invoice_url = $7,
           version = version + 1,
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        now,
        nextStatus,
        nextFinanceStatus,
        commissionPercentage,
        commissionAmount,
        providerPayout,
        `/invoices/${booking.booking_id}.pdf`,
        booking.id
      ]
    );

    const updated = mapBookingRow(resUpdate.rows[0]);

    // Upsert payment collection record
    await db.query(
      `INSERT INTO booking.booking_payment_collections (
         booking_id, status, method, final_amount, collected_amount, remaining_amount,
         confirmed_by, confirmed_at, financial_snapshot
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9
       ) ON CONFLICT (booking_id) DO UPDATE
         SET status = EXCLUDED.status,
             method = EXCLUDED.method,
             final_amount = EXCLUDED.final_amount,
             collected_amount = EXCLUDED.collected_amount,
             remaining_amount = EXCLUDED.remaining_amount,
             confirmed_by = EXCLUDED.confirmed_by,
             confirmed_at = EXCLUDED.confirmed_at,
             financial_snapshot = EXCLUDED.financial_snapshot,
             updated_at = NOW()`,
      [
        booking.id,
        isPrepaid ? 'verified' : 'pending',
        isPrepaid ? 'prepaid' : 'cash',
        payableAmount,
        isPrepaid ? payableAmount : 0,
        isPrepaid ? 0 : payableAmount,
        isPrepaid ? 'system' : null,
        isPrepaid ? now : null,
        JSON.stringify({
          subtotal: booking.base_price,
          final_amount: payableAmount,
          platform_commission: commissionAmount,
          provider_earning: providerPayout
        })
      ]
    );

    // Audit logs
    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'otp_verified',
      actor: 'provider',
      amount: payableAmount,
      details: { commissionPercentage, commissionAmount, providerPayout, isPrepaid }
    });

    if (isPrepaid) {
      // Consume coupon
      await CouponRedemptionRepository.deleteByBookingId(booking.id).catch(() => {});

      // Enqueue settlement outbox
      if (booking.provider_id) {
        await db.query(
          `INSERT INTO booking.settlement_outbox (event_id, booking_id, provider_id, amount, status)
           VALUES ($1, $2, $3::uuid, $4, 'PENDING')
           ON CONFLICT (event_id) DO NOTHING`,
          [`settle_${booking.id}`, booking.id, booking.provider_id, payableAmount]
        ).catch(e => console.error('[BOOKING] Failed to enqueue settlement outbox:', e.message));

        const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
        axios.post(`${PROV_URL}/api/providers/internal/release`, {
          provider_id: booking.provider_id
        }, {
          headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
        }).catch(e => console.error('[BOOKING] Failed to release provider:', e.message));
      }

      sendNotification(
        updated.user_id,
        'Booking Completed!',
        `Your booking ${updated.booking_id} has been marked as completed successfully. Thank you for choosing BharatClap!`,
        'booking_alert',
        { booking_id: updated.id }
      ).catch(console.error);

      res.json({ message: 'Booking completed successfully', booking: updated });
    } else {
      sendNotification(
        updated.user_id,
        'Service Completed — Payment Due',
        `Your service for booking ${updated.booking_id} is complete. Please pay ₹${payableAmount} to the provider.`,
        'payment_alert',
        { booking_id: updated.id }
      ).catch(console.error);

      res.json({
        message: 'Service completed. Payment collection pending.',
        booking: updated,
        payment_collection: {
          status: 'pending',
          final_amount: payableAmount,
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
    const booking = await BookingRepository.findById(req.params.id);

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    if (!safeCompareHashes(booking.start_otp, hashOtp(String(otp).trim()))) {
      res.status(400).json({ message: 'Invalid OTP' });
      return;
    }

    const payableAmount = booking.payable_amount || booking.final_amount || 0;
    const commissionPercentage = 15;
    const commissionAmount = (payableAmount * commissionPercentage) / 100;
    const providerPayout = payableAmount - commissionAmount;

    const db = getDb();
    const resUpdate = await db.query(
      `UPDATE booking.bookings
       SET status = 'completed',
           completed_at = NOW(),
           commission_percentage = $1,
           commission_amount = $2,
           provider_payout = $3,
           version = version + 1,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [commissionPercentage, commissionAmount, providerPayout, booking.id]
    );

    const updated = mapBookingRow(resUpdate.rows[0]);

    if (booking.provider_id) {
      await db.query(
        `INSERT INTO booking.settlement_outbox (event_id, booking_id, provider_id, amount, status)
         VALUES ($1, $2, $3::uuid, $4, 'PENDING')
         ON CONFLICT (event_id) DO NOTHING`,
        [`settle_${booking.id}`, booking.id, booking.provider_id, payableAmount]
      ).catch(e => console.error('[BOOKING] Failed to enqueue settlement outbox:', e.message));
    }

    res.json({ message: 'Booking verified successfully', booking: updated });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resend OTP
// @route   POST /api/bookings/:id/resend-otp
// @access  Private (Provider)
export const resendOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.body;
    if (type !== 'start' && type !== 'end') {
      res.status(400).json({ message: "Invalid type. Must be 'start' or 'end'." });
      return;
    }

    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const authorized = await checkProviderAuth(req, booking, res);
    if (!authorized) return;

    const db = getDb();
    const newOtp = generate6DigitOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    if (type === 'start') {
      if (booking.status !== 'waiting_start_otp') {
        res.status(400).json({ message: 'Booking status is not waiting for start OTP' });
        return;
      }

      const otpHash = hashOtp(newOtp);
      await db.query(
        `UPDATE booking.bookings
         SET start_otp = $1, start_otp_generated_at = $2, start_otp_expires_at = $3, start_otp_attempts = 0, version = version + 1, updated_at = NOW()
         WHERE id = $4`,
        [otpHash, now, expiresAt, booking.id]
      );

      await logBookingActivity(booking.id, 'START_OTP_RESENT', 'provider', req.user?._id, { expiresAt });

      emitSocketEvent(booking.user_id, 'otp_generated', {
        type: 'start',
        otp: newOtp,
        bookingId: booking.id,
        bookingRef: booking.booking_id,
      }).catch(console.error);

      sendOtpToCustomer(booking, newOtp, 'start').catch(console.error);
    } else {
      if (!['in_progress', 'waiting_end_otp', 'service_completed'].includes(booking.status)) {
        res.status(400).json({ message: 'Booking status is not waiting for end OTP' });
        return;
      }

      const otpHash = hashOtp(newOtp);
      await db.query(
        `UPDATE booking.bookings
         SET end_otp = $1, end_otp_generated_at = $2, end_otp_expires_at = $3, end_otp_attempts = 0, status = 'waiting_end_otp', version = version + 1, updated_at = NOW()
         WHERE id = $4`,
        [otpHash, now, expiresAt, booking.id]
      );

      await logBookingActivity(booking.id, 'END_OTP_RESENT', 'provider', req.user?._id, { expiresAt });

      emitSocketEvent(booking.user_id, 'otp_generated', {
        type: 'end',
        otp: newOtp,
        bookingId: booking.id,
        bookingRef: booking.booking_id,
      }).catch(console.error);

      sendOtpToCustomer(booking, newOtp, 'end').catch(console.error);
    }

    res.json({ message: 'OTP resent successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
