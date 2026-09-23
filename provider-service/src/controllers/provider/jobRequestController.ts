import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getDb } from '../../config/db';
import { ProviderRepository } from '../../repositories/providerRepository';
import { JobRequestRepository } from '../../repositories/jobRequestRepository';
import { WalletRepository } from '../../repositories/walletRepository';
import { emitToUser, redisClient, isRedisAvailable } from '../../services/socketService';
import { getUsersBatch, getCatalogBatch, getAddressesBatch, getBookingsBatch } from '../../utils/internalApi';
import { filterConflictingProviders, parseBookingStart } from '../dispatchController';
import { travelTimeService } from '../../services/travel/TravelTimeService';
import { scheduleEngine } from '../../services/schedule/ScheduleEngine';
import { deductLeadOrWallet } from '../../services/leadService';
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
  let lockKey = '';
  let isLockedByUs = false;
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    if (provider.status === 'blocked') {
      res.status(403).json({ message: 'Your account is currently blocked. Please contact support.' });
      return;
    }

    const reqId = req.params.id;
    const reqRes = await db.query(
      `SELECT * FROM provider.job_requests
       WHERE (id::text = $1 OR legacy_mongo_id = $1 OR booking_id::text = $1)
       ORDER BY created_at DESC
       LIMIT 1`,
      [reqId]
    );

    const request = reqRes.rows[0];
    if (!request) {
      res.status(404).json({ message: 'Request not found' });
      return;
    }

    if (request.status === 'accepted' && String(request.provider_id) === String(provider.id)) {
      res.json({ message: 'Job already accepted' });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ message: 'Request is no longer valid or has already been processed' });
      return;
    }

    // Call booking-service to assign booking
    const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
    const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

    let booking: any;
    try {
      const assignRes = await axios.put(`${BOOKING_URL}/api/bookings/internal/${request.booking_id}/assign`, {
        provider_id: provider.id,
        estimatedDistance: 3.5,
        estimatedTravelMinutes: 15
      }, {
        headers: { 'x-internal-service-key': INTERNAL_KEY }
      });
      booking = assignRes.data;
    } catch (err: any) {
      if (err.response?.status === 409) {
        res.status(409).json({
          code: 'ORDER_ALREADY_TAKEN',
          message: '⚡ Order Taken: Another provider just accepted this order.'
        });
        return;
      }
      res.status(400).json({ message: err.response?.data?.message || 'Booking is already assigned or unavailable' });
      return;
    }

    // Mark job request accepted and provider busy in PostgreSQL
    await db.query(
      `UPDATE provider.job_requests
       SET status = 'accepted',
           responded_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [request.id]
    );

    await db.query(
      `UPDATE provider.job_requests
       SET status = 'expired',
           updated_at = NOW()
       WHERE booking_id = $1 AND id != $2 AND status = 'pending'`,
      [request.booking_id, request.id]
    );

    await ProviderRepository.updateAvailability(provider.id, 'busy', true, true);

    // Deduct lead fee or wallet
    try {
      await deductLeadOrWallet(provider.id, String(request.booking_id), String(booking?.subservice_id));
    } catch (deductErr: any) {
      console.warn(`[ACCEPT] Lead deduction warning: ${deductErr.message}`);
    }

    emitToUser(String(booking.user_id), 'booking_accepted', {
      booking_id: booking._id || booking.id,
      provider: {
        name: req.user?.name,
        profile_image: (req.user as any)?.profile_image
      }
    });

    res.json({ message: 'Job accepted successfully', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  } finally {
    if (isLockedByUs && lockKey && isRedisAvailable && redisClient) {
      await redisClient.del(lockKey).catch(() => {});
    }
  }
};

// @desc    Reject a job request
// @route   POST /api/providers/job-requests/:id/reject
// @access  Private/Provider
export const rejectJobRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const reqId = req.params.id;

    await db.query(
      `UPDATE provider.job_requests
       SET status = 'rejected',
           responded_at = NOW(),
           updated_at = NOW()
       WHERE id::text = $1 OR legacy_mongo_id = $1 OR booking_id::text = $1`,
      [reqId]
    );

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
