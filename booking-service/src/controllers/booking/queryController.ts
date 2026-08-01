import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Booking } from '../../models/Booking';
import { BookingActivity } from '../../models/BookingActivity';
import mongoose from 'mongoose';
import axios from 'axios';
import { SlotCapacity } from '../../models/SlotCapacity';
import {
  getUsersBatch,
  getAddressesBatch,
  getProvidersBatch,
  getProviderByUserId,
  getCatalogBatch,
  InternalUser,
  expireJobRequestsForBookings,
  sendNotification,
  searchUserIdsByKeyword,
  searchProviderIdsByKeyword
} from '../../utils/internalApi';

const populateBookings = async (bookings: any[]) => {
  if (!bookings || bookings.length === 0) return [];

  const userIds = [...new Set(bookings.map(b => b.user_id?.toString()).filter(Boolean))];
  const addressIds = [...new Set(bookings.map(b => b.address_id?.toString()).filter(Boolean))];
  const providerIds = [...new Set(bookings.map(b => b.provider_id?.toString()).filter(Boolean))];
  const subserviceIds = [...new Set(bookings.map(b => b.subservice_id?.toString()).filter(Boolean))];

  // Execute all batch RPC requests in a single parallel round-trip
  const [users, addresses, providers, catalogData] = await Promise.all([
    getUsersBatch(userIds),
    getAddressesBatch(addressIds),
    getProvidersBatch(providerIds),
    subserviceIds.length > 0
      ? getCatalogBatch(subserviceIds, [], [], [], true)
      : Promise.resolve({ subservices: [], services: [], categories: [], coupons: [] })
  ]);

  const providerUserIds = [...new Set(providers.map((p: any) => p.user_id?.toString()).filter(Boolean))];
  let providerUsers: InternalUser[] = [];
  if (providerUserIds.length > 0) {
    providerUsers = await getUsersBatch(providerUserIds);
  }

  const userMap = new Map(users.map((u: any) => [String(u._id), u]));
  const addressMap = new Map(addresses.map((a: any) => [String(a._id), a]));
  const providerUserMap = new Map(providerUsers.map((u: any) => [String(u._id), u]));

  const populatedProviders = providers.map((p: any) => ({
    ...p,
    user_id: providerUserMap.get(String(p.user_id)) || p.user_id
  }));
  const providerMap = new Map(populatedProviders.map((p: any) => [String(p._id), p]));

  let subserviceMap = new Map();
  if (catalogData && catalogData.subservices && catalogData.subservices.length > 0) {
    const categoryMap = new Map((catalogData.categories || []).map((c: any) => [String(c._id), c]));
    const serviceMap = new Map((catalogData.services || []).map((s: any) => [
      String(s._id),
      { ...s, category_id: categoryMap.get(String(s.category_id)) || s.category_id }
    ]));

    const populatedSubservices = catalogData.subservices.map((s: any) => ({
      ...s,
      service_id: serviceMap.get(String(s.service_id)) || s.service_id
    }));
    subserviceMap = new Map(populatedSubservices.map((s: any) => [String(s._id), s]));
  }

  return bookings.map(b => {
    const isTimeout = b.status === 'unassigned_timeout';
    const isPendingTimeout = ['pending', 'provider_searching'].includes(b.status) &&
      !b.provider_id &&
      b.createdAt &&
      (Date.now() - new Date(b.createdAt).getTime()) >= 30 * 60 * 1000;

    return {
      ...b,
      user_id: userMap.get(String(b.user_id)) || b.user_id,
      address_id: addressMap.get(String(b.address_id)) || b.address_id,
      provider_id: providerMap.get(String(b.provider_id)) || b.provider_id,
      subservice_id: subserviceMap.get(String(b.subservice_id)) || b.subservice_id,
      isHighDemandTimeout: isTimeout || isPendingTimeout,
      highDemandReason: (isTimeout || isPendingTimeout) ? 'No provider accepted within 30 minutes' : null
    };
  });
};

// @desc    Get all bookings (Admin)
// @route   GET /api/bookings
// @access  Private/Admin
export const getAllBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const filter: any = { isDeleted: false };
    if (status) {
      filter.status = status;
    }
    
    if (search && search.trim()) {
      const trimmedSearch = search.trim();
      const escapedSearch = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');

      const matchingUserIdsStr = await searchUserIdsByKeyword(trimmedSearch);
      const { providerIds: matchingProviderIdsStr, userIds: providerUserIdsStr } = await searchProviderIdsByKeyword(matchingUserIdsStr, trimmedSearch);

      const allUserIdsStr = [...new Set([...matchingUserIdsStr, ...providerUserIdsStr])];
      const allUserObjectIds = allUserIdsStr
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

      const allProviderIdsStr = [...new Set(matchingProviderIdsStr)];
      const allProviderObjectIds = allProviderIdsStr
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

      const searchConditions: any[] = [
        { booking_id: searchRegex },
        { variant_name: searchRegex }
      ];

      if (allUserIdsStr.length > 0) {
        const userMatches = [...allUserObjectIds, ...allUserIdsStr];
        searchConditions.push({ user_id: { $in: userMatches } });
        searchConditions.push({ customer_id: { $in: userMatches } });
      }

      if (allProviderIdsStr.length > 0) {
        const providerMatches = [...allProviderObjectIds, ...allProviderIdsStr];
        searchConditions.push({ provider_id: { $in: providerMatches } });
      }

      if (mongoose.Types.ObjectId.isValid(trimmedSearch)) {
        searchConditions.push({ _id: new mongoose.Types.ObjectId(trimmedSearch) });
      }

      filter.$or = searchConditions;
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter)
    ]);

    const populated = await populateBookings(bookings);
    res.json({ data: populated, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get my bookings (Customer or Provider)
// @route   GET /api/bookings/my
// @access  Private
export const getMyBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    let query = {};

    if (req.user?.role === 'customer') {
      query = {
        $or: [
          { user_id: new mongoose.Types.ObjectId(req.user._id) },
          { customer_id: new mongoose.Types.ObjectId(req.user._id) }
        ]
      };
    } else if (req.user?.role === 'provider') {
      const provider = await getProviderByUserId(req.user._id);
      query = { provider_id: provider ? (provider as any)._id : new mongoose.Types.ObjectId() };
    }

    // Auto-transition unassigned bookings older than 30 minutes to unassigned_timeout
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    try {
      // Find bookings about to timeout (for side-effects before updating)
      const timedOutBookings = await Booking.find({
        status: { $in: ['pending', 'provider_searching'] },
        createdAt: { $lte: thirtyMinsAgo },
        provider_id: { $exists: false }
      }).select('_id user_id booking_id').lean();

      if (timedOutBookings.length > 0) {
        const timedOutIds = timedOutBookings.map(b => String(b._id));

        // Transition status
        await Booking.updateMany(
          { _id: { $in: timedOutIds.map(id => new mongoose.Types.ObjectId(id)) } },
          { $set: { status: 'unassigned_timeout' } }
        );

        // Audit log
        const activities = timedOutBookings.map(b => ({
          booking_id: b._id,
          action: 'BOOKING_HIGH_DEMAND_TIMEOUT',
          performed_by: 'system',
          details: `No provider accepted within 30 minutes. Booking ${b.booking_id} timed out.`,
          metadata: { elapsedMinutes: 30, timeoutAt: new Date() }
        }));
        BookingActivity.insertMany(activities).catch(() => {});

        // Expire provider job requests & release wallet holds (fire-and-forget)
        expireJobRequestsForBookings(timedOutIds).catch(() => {});

        // Notify customers (fire-and-forget)
        for (const b of timedOutBookings) {
          sendNotification(
            String(b.user_id),
            'Booking Couldn\'t Be Assigned',
            `Your booking ${b.booking_id} couldn't be assigned due to high demand. You can re-book for another time slot.`,
            'booking_timeout',
            { bookingId: String(b._id), booking_id: b.booking_id }
          ).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn('[BOOKING SERVICE] Timeout auto-transition warning:', err.message);
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments(query)
    ]);

    const populated = await populateBookings(bookings);
    res.json({ data: populated, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
// @access  Private
export const getBookingById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const booking = await Booking.findById(req.params.id).lean();

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    // Verify ownership (customer), assigned provider, or admin/super_admin
    const isOwner = booking.user_id?.toString() === req.user?._id?.toString() || (booking as any).customer_id?.toString() === req.user?._id?.toString();
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    let isProvider = false;
    if (req.user?.role === 'provider' && booking.provider_id) {
      const provider = await getProviderByUserId(req.user._id);
      if (provider && String((provider as any)._id) === String(booking.provider_id)) {
        isProvider = true;
      }
    }

    if (!isOwner && !isAdmin && !isProvider) {
      res.status(403).json({ message: 'Not authorized to view this booking' });
      return;
    }

    const populated = await populateBookings([booking]);
    res.json(populated[0]);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get multiple bookings by IDs (Internal API)
// @route   POST /api/bookings/batch
// @access  Public (Internal)
export const getBookingsBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      res.status(400).json({ message: 'Please provide an array of ids' });
      return;
    }
    const bookings = await Booking.find({ _id: { $in: ids } }).lean();
    res.json(bookings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get aggregated stats for a provider (Internal — replaces full booking list fetch)
// @route   GET /api/bookings/provider/:providerId/stats
// @access  Internal
export const getProviderBookingStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.params.providerId);

    const agg = await Booking.aggregate([
      { $match: { provider_id: providerId, isDeleted: false } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          payout: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, { $ifNull: ['$provider_payout', { $multiply: ['$payable_amount', 0.8] }] }, 0] } }
        }
      }
    ]);

    let total_jobs = 0, completed_jobs = 0, earnings = 0;
    for (const row of agg) {
      total_jobs += row.count;
      if (row._id === 'completed') {
        completed_jobs = row.count;
        earnings = row.payout;
      }
    }

    res.json({ total_jobs, completed_jobs, earnings });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get bookings for a specific user ID
// @route   GET /api/bookings/user/:userId
// @access  Private/Admin
export const getBookingsByUserId = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = { user_id: new mongoose.Types.ObjectId(req.params.userId) };

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter)
    ]);

    const populated = await populateBookings(bookings);
    res.json({ data: populated, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get bookings for a specific provider
// @route   GET /api/bookings/provider/:providerId
// @access  Private/Provider (Assigned Provider or Admin)
export const getBookingsByProvider = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAdmin) {
      const provider = await getProviderByUserId(req.user?._id || '');
      if (!provider || String((provider as any)._id) !== String(req.params.providerId)) {
        res.status(403).json({ message: 'Forbidden: Not authorized to view bookings for this provider' });
        return;
      }
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = { provider_id: new mongoose.Types.ObjectId(req.params.providerId) };

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter)
    ]);

    const populated = await populateBookings(bookings);
    res.json({ data: populated, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get booking activity timeline
// @route   GET /api/bookings/:id/activity
// @access  Private/Admin
export const getBookingActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const activities = await BookingActivity
      .find({ booking_id: new mongoose.Types.ObjectId(req.params.id) })
      .sort({ timestamp: 1 })
      .lean();
    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Pre-payment availability & capacity check + Smart Reschedule suggestion
// @route   POST /api/bookings/check-availability
// @access  Public / Auth
export const checkAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { city, date, booking_time, subservice_id, address_id } = req.body;
    if (!city || !date || !booking_time) {
      res.status(400).json({ message: 'City, date, and booking_time are required' });
      return;
    }

    const targetDate = String(date);
    const targetTime = String(booking_time);
    const targetCity = String(city);

    // 1. Slot Capacity check
    const capacityDoc = await SlotCapacity.findOne({ city: targetCity, date: targetDate, booking_time: targetTime }).lean();
    const maxCapacity = capacityDoc?.max_capacity ?? 40;
    const bookedCount = capacityDoc?.booked_count ?? 0;

    const alternatives = [
      { time: '11:00 AM', label: '11:00 AM (Recommended)' },
      { time: '02:00 PM', label: '02:00 PM (Afternoon)' },
      { time: '04:00 PM', label: '04:00 PM (Evening)' }
    ];

    if (bookedCount >= maxCapacity) {
      res.status(200).json({
        available: false,
        reason: 'slot_full',
        message: 'No providers are available for your selected time. Please choose another available time slot.',
        booked_count: bookedCount,
        max_capacity: maxCapacity,
        suggested_slots: alternatives
      });
      return;
    }

    // 2. Pre-Fulfillment Provider Availability Check via provider-service
    if (subservice_id) {
      const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
      try {
        const provRes = await axios.get(`${PROVIDER_SERVICE_URL}/api/providers/check-availability`, {
          params: {
            subservice_id,
            location_name: targetCity,
            location_id: address_id,
            scheduled_at: targetDate,
            booking_time: targetTime
          },
          timeout: 4000
        });

        if (!provRes.data?.available) {
          res.status(200).json({
            available: false,
            reason: 'no_providers_available',
            message: 'No verified providers are available for your selected time in this area.',
            suggested_slots: alternatives
          });
          return;
        }
      } catch (err: any) {
        console.warn('[PRE-PAYMENT CHECK] Provider service check warning:', err.message);
      }
    }

    res.status(200).json({
      available: true,
      city: targetCity,
      date: targetDate,
      booking_time: targetTime,
      remaining_slots: maxCapacity - bookedCount
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
