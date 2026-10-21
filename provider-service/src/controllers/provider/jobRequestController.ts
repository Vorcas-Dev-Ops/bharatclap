import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getDb } from '../../config/db';
import { ProviderRepository } from '../../repositories/providerRepository';
import { JobRequestRepository } from '../../repositories/jobRequestRepository';
import { WalletRepository } from '../../repositories/walletRepository';
import { emitToUser, redisClient, isRedisAvailable } from '../../services/socketService';
import { getUsersBatch, getCatalogBatch, getAddressesBatch, getBookingsBatch } from '../../utils/internalApi';
import { filterConflictingProviders, parseBookingStart, isScheduleConflicting } from '../dispatchController';
import { travelTimeService } from '../../services/travel/TravelTimeService';
import { scheduleEngine } from '../../services/schedule/ScheduleEngine';
import { deductLeadOrWallet } from '../../services/leadService';
import { releaseHoldForBooking } from '../../services/leadHoldService';
import axios from 'axios';
import { getInternalServiceKey } from '@bharatclap/shared';

// @desc    Get pending job requests for current provider
// @route   GET /api/providers/job-requests
// @access  Private/Provider
export const getMyJobRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    if (provider.status === 'blocked') {
      res.json([]);
      return;
    }

    const isFreeAccess = provider.subscription_type === 'free_trial' || provider.subscription_status === 'active';

    if (!isFreeAccess && provider.is_wallet_blocked) {
      res.json([]);
      return;
    }

    const reqRes = await db.query(
      `SELECT * FROM provider.job_requests
       WHERE provider_id = $1
         AND status = 'pending'
       ORDER BY created_at DESC`,
      [provider.id]
    );

    const requests = reqRes.rows;
    if (requests.length === 0) {
      res.json([]);
      return;
    }

    const bookingIds = Array.from(new Set(requests.map(r => String(r.booking_id)).filter(Boolean)));
    const bookings = await getBookingsBatch(bookingIds).catch(() => []);
    const bookingMap = new Map(bookings.map((b: any) => [String(b._id || b.id), b]));

    const userIds = Array.from(new Set(bookings.map((b: any) => String(b.user_id)).filter(Boolean)));
    const subserviceIds = Array.from(new Set(bookings.map((b: any) => String(b.subservice_id)).filter(Boolean)));
    const addressIds = Array.from(new Set(bookings.map((b: any) => String(b.address_id)).filter(Boolean)));
    
    const [users, catalogData, addresses] = await Promise.all([
      getUsersBatch(userIds).catch(() => []),
      getCatalogBatch(subserviceIds, [], [], []).catch(() => ({ subservices: [], services: [], categories: [], coupons: [] })),
      getAddressesBatch(addressIds).catch(() => [])
    ]);

    const userMap = new Map<string, any>((users || []).map((u: any) => [String(u._id || u.id), u]));
    const subserviceMap = new Map<string, any>((catalogData?.subservices || []).map((s: any) => [String(s._id || s.id), s]));
    const addressMap = new Map<string, any>((addresses || []).map((a: any) => [String(a._id || a.id), a]));

    const graceMinutes = Number(process.env.BOOKING_START_GRACE_MINUTES) || 60;
    const graceCutoff = new Date(Date.now() - graceMinutes * 60 * 1000);

    const mappedRequests = requests.map(r => {
      const booking = bookingMap.get(String(r.booking_id)) as any;
      if (!booking) return null;

      const validStatuses = ['provider_searching', 'pending'];
      if (!validStatuses.includes(booking.status)) return null;

      if (booking.scheduled_at && new Date(booking.scheduled_at) < graceCutoff) return null;

      const user = userMap.get(String(booking.user_id));
      const subservice = subserviceMap.get(String(booking.subservice_id));
      const address = addressMap.get(String(booking.address_id));

      return {
        _id: r.id,
        booking_id: booking._id || booking.id,
        booking_display_id: booking.booking_id,
        status: r.status,
        service_name: subservice?.name || booking.variant_name || 'Service',
        amount: booking.payable_amount,
        scheduled_at: booking.scheduled_at,
        booking_time: booking.booking_time,
        customer_name: user?.name || 'Customer',
        location: address ? {
          address: address.address_line,
          city: address.city,
          pincode: address.pincode
        } : null,
        created_at: r.created_at
      };
    }).filter(Boolean);

    res.json(mappedRequests);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Accept a job request
// @route   POST /api/providers/job-requests/:id/accept
// @access  Private/Provider
export const acceptJobRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  const pool = getDb();

  try {
    const userIdStr = String(req.user?.id || req.user?._id);
    const reqId = req.params.id;

    // 1. Fetch Provider details
    const provRes = await pool.query(
      `SELECT * FROM provider.providers WHERE user_id::text = $1 OR id::text = $1 LIMIT 1`,
      [userIdStr]
    );
    const provider = provRes.rows[0];
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    if (provider.status === 'blocked') {
      res.status(403).json({ message: 'Your account is currently blocked. Please contact support.' });
      return;
    }

    if (provider.status !== 'active' || provider.deleted_at) {
      res.status(403).json({ message: 'Your account is inactive or suspended. Please contact support.' });
      return;
    }

    if (!provider.is_online) {
      res.status(400).json({ message: 'You must be online to accept job requests.' });
      return;
    }

    // 2. Fetch JobRequest and associated booking details checking database NOW()
    const reqRes = await pool.query(
      `SELECT jr.*, (jr.expires_at <= NOW()) AS is_expired,
              b.scheduled_at, b.booking_time, b.status AS booking_status, b.provider_id AS booking_provider_id
       FROM provider.job_requests jr
       JOIN booking.bookings b ON (b.id::text = jr.booking_id::text OR b.booking_id = jr.booking_id::text)
       WHERE ((jr.id::text = $1 OR jr.legacy_mongo_id = $1) OR jr.booking_id::text = $1)
         AND jr.provider_id::text = $2::text
       ORDER BY jr.created_at DESC
       LIMIT 1`,
      [reqId, String(provider.id)]
    );

    const request = reqRes.rows[0];
    if (!request) {
      res.status(404).json({ message: 'Request not found' });
      return;
    }

    // 3. Same-Provider Idempotent Replay Check
    const isOwnedBySelf = request.booking_provider_id && (
      String(request.booking_provider_id) === String(provider.id) ||
      String(request.booking_provider_id) === String(provider.user_id)
    );

    if (request.status === 'accepted' || (isOwnedBySelf && request.booking_status === 'accepted')) {
      if (request.status !== 'accepted') {
        await pool.query(
          `UPDATE provider.job_requests SET status = 'accepted', responded_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [request.id]
        );
        // Expire competing pending requests for this booking
        await pool.query(
          `UPDATE provider.job_requests
           SET status = 'expired', updated_at = NOW()
           WHERE booking_id::text = $1::text AND id != $2 AND status = 'pending'`,
          [String(request.booking_id), request.id]
        );
        await pool.query(
          `UPDATE provider.providers
           SET availability_status = 'busy', is_busy = TRUE, updated_at = NOW()
           WHERE id = $1`,
          [provider.id]
        );
        try {
          await deductLeadOrWallet(provider.id, String(request.booking_id), String(request.subservice_id));
        } catch (deductErr: any) {
          console.error(`[ACCEPT_RECONCILE] Lead deduction FAILED (recoverable): ${deductErr.message}`);
          const pool = getDb();
          await pool.query(
            `INSERT INTO provider.wallet_outbox (event_type, provider_id, payload, status)
             VALUES ('LEAD_FEE_RECOVERY', $1, $2, 'PENDING')`,
            [provider.id, JSON.stringify({
              bookingId: String(request.booking_id),
              subserviceId: String(request.subservice_id),
              error: deductErr.message,
              attemptedAt: new Date().toISOString(),
            })]
          ).catch((e: any) => console.error(`[ACCEPT_RECONCILE] CRITICAL: Recovery outbox failed: ${e.message}`));
        }
      }
      res.status(200).json({ message: 'Job already accepted' });
      return;
    }

    // 4. Competing Provider Conflict Check (booking already accepted by another provider)
    if (request.booking_status === 'accepted' && !isOwnedBySelf) {
      await pool.query(
        `UPDATE provider.job_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [request.id]
      );
      res.status(409).json({
        code: 'ORDER_ALREADY_TAKEN',
        message: '⚡ Order Taken: Another provider just accepted this order.'
      });
      return;
    }

    // 5. Authoritative Database-Clock Expiry Gate
    if (request.is_expired || (request.expires_at && new Date(request.expires_at).getTime() <= Date.now())) {
      await pool.query(
        `UPDATE provider.job_requests SET status = 'expired', updated_at = NOW() WHERE id = $1`,
        [request.id]
      );
      res.status(400).json({ message: 'Request has expired. Please wait for the next job.' });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ message: 'Request is no longer valid or has already been processed' });
      return;
    }

    // 6. Schedule Overlap & Busy Protection
    const existingBookingsRes = await pool.query(
      `SELECT id, scheduled_at, booking_time, status
       FROM booking.bookings
       WHERE (provider_id::text = $1 OR provider_id::text = $2)
         AND status IN ('accepted', 'confirmed', 'ready_confirmed', 'on_the_way', 'arrived', 'reached', 'otp_verified', 'in_progress', 'waiting_start_otp')
         AND id::text != $3`,
      [String(provider.id), String(provider.user_id), String(request.booking_id)]
    );

    for (const eb of existingBookingsRes.rows) {
      if (isScheduleConflicting(eb.scheduled_at, eb.booking_time, request.scheduled_at, request.booking_time)) {
        res.status(409).json({
          code: 'SCHEDULE_CONFLICT',
          message: 'You already have another booking scheduled for this time slot.'
        });
        return;
      }
    }

    // If immediate/active job and provider is currently marked busy, prevent concurrent conflict
    const isImmediate = !request.scheduled_at || Math.abs(new Date(request.scheduled_at).getTime() - Date.now()) < 3600000;
    if (isImmediate && (provider.is_busy || provider.availability_status === 'busy')) {
      res.status(409).json({ message: 'You are currently busy with another active job.' });
      return;
    }

    // 7. Atomic Booking Assignment via booking-service
    // (NO PostgreSQL transaction is held open across this HTTP call!)
    const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
    const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

    let booking: any;
    try {
      const assignRes = await axios.put(`${BOOKING_URL}/api/bookings/internal/${request.booking_id}/assign`, {
        provider_id: provider.id,
        estimatedDistance: 3.5,
        estimatedTravelMinutes: 15
      }, {
        headers: { 'x-internal-service-key': INTERNAL_KEY },
        timeout: 5000
      });
      booking = assignRes.data;
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Re-check ownership in case booking was assigned to this same provider
        const checkOwnerRes = await pool.query(
          `SELECT provider_id, status FROM booking.bookings
           WHERE id::text = $1::text OR booking_id = $1::text`,
          [String(request.booking_id)]
        );
        const bookingOwner = checkOwnerRes.rows[0];
        const isSame = bookingOwner && (
          String(bookingOwner.provider_id) === String(provider.id) ||
          String(bookingOwner.provider_id) === String(provider.user_id)
        );

        if (isSame && bookingOwner.status === 'accepted') {
          // Reconcile as ACCEPTED locally
          await pool.query(
            `UPDATE provider.job_requests
             SET status = 'accepted', responded_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [request.id]
          );
          await pool.query(
            `UPDATE provider.providers
             SET availability_status = 'busy', is_busy = TRUE, updated_at = NOW()
             WHERE id = $1`,
            [provider.id]
          );
          res.status(200).json({ message: 'Job already accepted' });
          return;
        }

        // Competing provider won the race -> clean up our JobRequest immediately
        await pool.query(
          `UPDATE provider.job_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
          [request.id]
        );
        res.status(409).json({
          code: 'ORDER_ALREADY_TAKEN',
          message: '⚡ Order Taken: Another provider just accepted this order.'
        });
        return;
      }

      res.status(400).json({ message: err.response?.data?.message || 'Booking is already assigned or unavailable' });
      return;
    }

    // 8. Booking assignment succeeded -> Atomic local database commit in provider-service (microsecond duration)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Lock provider & request rows to serialize availability transitions
      await client.query('SELECT * FROM provider.providers WHERE id = $1 FOR UPDATE', [provider.id]);

      // Check whether another active booking was committed for this provider concurrently
      const otherActiveRes = await client.query(
        `SELECT id FROM booking.bookings
         WHERE (provider_id::text = $1 OR provider_id::text = $2)
           AND status IN ('accepted', 'confirmed', 'ready_confirmed', 'on_the_way', 'arrived', 'reached', 'otp_verified', 'in_progress', 'waiting_start_otp')
           AND id::text != $3
         LIMIT 1`,
        [String(provider.id), String(provider.user_id), String(request.booking_id)]
      );

      if (isImmediate && otherActiveRes.rows.length > 0) {
        await client.query('ROLLBACK');
        // Compensating unassign on booking-service since provider became busy in parallel
        try {
          await axios.put(`${BOOKING_URL}/api/bookings/internal/${request.booking_id}/unassign`, {
            provider_id: provider.id,
            reason: 'Concurrency conflict: provider occupied'
          }, {
            headers: { 'x-internal-service-key': INTERNAL_KEY },
            timeout: 3000
          });
        } catch (_) {}

        res.status(409).json({ message: 'You are currently busy with another active job.' });
        return;
      }

      await client.query('SELECT * FROM provider.job_requests WHERE id = $1 FOR UPDATE', [request.id]);

      await client.query(
        `UPDATE provider.job_requests
         SET status = 'accepted',
             responded_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [request.id]
      );

      // Expire competing pending requests for this booking
      await client.query(
        `UPDATE provider.job_requests
         SET status = 'expired',
             updated_at = NOW()
         WHERE booking_id::text = $1::text AND id != $2 AND status = 'pending'`,
        [String(request.booking_id), request.id]
      );

      // Mark provider busy
      await client.query(
        `UPDATE provider.providers
         SET availability_status = 'busy',
             is_busy = TRUE,
             updated_at = NOW()
         WHERE id = $1`,
        [provider.id]
      );

      await client.query('COMMIT');
    } catch (txErr: any) {
      await client.query('ROLLBACK').catch(() => {});
      if (txErr.code === '23505') {
        res.status(409).json({
          code: 'ORDER_ALREADY_TAKEN',
          message: '⚡ Order Taken: Another provider just accepted this order.'
        });
        return;
      }
      throw txErr;
    } finally {
      client.release();
    }

    // 9. Asynchronous side-effects outside transaction
    try {
      await deductLeadOrWallet(provider.id, String(request.booking_id), String(booking?.subservice_id));
    } catch (deductErr: any) {
      // Defect F fix: financial failure must NOT be silently swallowed.
      // Booking ownership is already committed — we cannot roll it back.
      // Instead, create an observable recovery record.
      console.error(`[ACCEPT] Lead deduction FAILED (recoverable): ${deductErr.message}`);
      try {
        const pool = getDb();
        await pool.query(
          `INSERT INTO provider.wallet_outbox (event_type, provider_id, payload, status)
           VALUES ('LEAD_FEE_RECOVERY', $1, $2, 'PENDING')`,
          [provider.id, JSON.stringify({
            bookingId: String(request.booking_id),
            subserviceId: String(booking?.subservice_id),
            error: deductErr.message,
            attemptedAt: new Date().toISOString(),
          })]
        );
      } catch (outboxErr: any) {
        console.error(`[ACCEPT] CRITICAL: Failed to enqueue lead-fee recovery: ${outboxErr.message}`);
      }
    }

    emitToUser(String(booking.user_id), 'booking_accepted', {
      booking_id: booking._id || booking.id,
      provider: {
        name: req.user?.name,
        profile_image: (req.user as any)?.profile_image
      }
    });

    res.status(200).json({ message: 'Job accepted successfully', booking });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({
        code: 'ORDER_ALREADY_TAKEN',
        message: '⚡ Order Taken: Another provider just accepted this order.'
      });
      return;
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reject a job request
// @route   POST /api/providers/job-requests/:id/reject
// @access  Private/Provider
export const rejectJobRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const reqId = req.params.id;

    // Fetch the request before updating so we have provider_id + booking_id for hold release
    const jrRes = await db.query(
      `UPDATE provider.job_requests
       SET status = 'rejected',
           responded_at = NOW(),
           updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1 OR booking_id::text = $1)
         AND status = 'pending'
       RETURNING provider_id, booking_id`,
      [reqId]
    );

    // Release the wallet hold in the same request — idempotent, safe to call even if no hold exists
    if (jrRes.rows.length > 0) {
      const { provider_id, booking_id } = jrRes.rows[0];
      await releaseHoldForBooking(String(provider_id), String(booking_id)).catch(e =>
        console.warn(`[REJECT] Hold release failed (non-fatal): ${e.message}`)
      );
    }

    res.json({ message: 'Job rejected successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Provider confirms "I'm Ready" for an upcoming scheduled booking
// @route   POST /api/providers/job-requests/:bookingId/confirm-ready
// @access  Private/Provider
export const confirmReady = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
    const internalKey = getInternalServiceKey();

    await axios.patch(
      `${BOOKING_URL}/api/bookings/status/internal`,
      {
        booking_id: bookingId,
        status: 'ready_confirmed',
        ready_confirmed_at: new Date()
      },
      { headers: { 'x-internal-service-key': internalKey } }
    );

    res.json({ message: 'Confirmed readiness for upcoming booking!' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to confirm readiness' });
  }
};

// @desc    Provider requests structured cancellation with reason
// @route   POST /api/providers/job-requests/:bookingId/request-cancellation
// @access  Private/Provider
export const requestCancellation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const { reason, reason_category } = req.body;

    const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
    const internalKey = getInternalServiceKey();

    await axios.patch(
      `${BOOKING_URL}/api/bookings/status/internal`,
      {
        booking_id: bookingId,
        status: 'cancellation_requested',
        cancel_reason_category: reason_category || 'provider_issue',
        cancellation_reason: reason || 'Provider requested cancellation'
      },
      { headers: { 'x-internal-service-key': internalKey } }
    );

    res.json({ message: 'Cancellation request submitted. Reassignment initiated.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to submit cancellation request' });
  }
};
