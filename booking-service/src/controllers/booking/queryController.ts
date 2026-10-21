import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { BookingRepository, mapBookingRow } from '../../repositories/bookingRepository';
import { SlotCapacityRepository } from '../../repositories/slotCapacityRepository';
import { getDb } from '../../config/db';
import axios from 'axios';
import {
  getProviderByUserId,
  expireJobRequestsForBookings,
  sendNotification,
} from '../../utils/internalApi';

// @desc    Get all bookings (Admin)
// @route   GET /api/bookings
// @access  Private/Admin
export const getAllBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const db = getDb();
    const conditions: string[] = ['b.deleted_at IS NULL'];
    const values: any[] = [];

    if (status) {
      values.push(status);
      conditions.push(`b.status = $${values.length}`);
    }

    if (search && search.trim()) {
      values.push(`%${search.trim()}%`);
      const idx = values.length;
      conditions.push(`(b.booking_id ILIKE $${idx} OR b.variant_name ILIKE $${idx} OR u.name ILIKE $${idx} OR u.phone ILIKE $${idx} OR p.name ILIKE $${idx})`);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM booking.bookings b
       LEFT JOIN auth.users u ON u.id = b.user_id
       LEFT JOIN auth.users p ON p.id = b.provider_id
       WHERE ${whereClause}`,
      values
    );
    const total = countRes.rows[0]?.total || 0;

    const offset = (page - 1) * limit;
    values.push(limit, offset);

    const dataRes = await db.query(
      `SELECT b.*,
              u.name AS customer_name,
              u.phone AS customer_phone,
              u.email AS customer_email,
              p.name AS provider_name,
              p.phone AS provider_phone,
              ss.subservice_name,
              ss.base_price AS subservice_base_price,
              srv.service_name,
              cat.name AS category_name,
              addr.address_line_1 AS address_line1,
              addr.city,
              addr.state,
              addr.pincode
       FROM booking.bookings b
       LEFT JOIN auth.users u ON u.id = b.user_id
       LEFT JOIN auth.users p ON p.id = b.provider_id
       LEFT JOIN catalog.subservices ss ON ss.id = b.subservice_id
       LEFT JOIN catalog.services srv ON srv.id = ss.service_id
       LEFT JOIN catalog.categories cat ON cat.id = srv.category_id
       LEFT JOIN auth.addresses addr ON addr.id = b.address_id
       WHERE ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    const populated = dataRes.rows.map(mapBookingRow);
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

    const provider = req.user?._id ? await getProviderByUserId(String(req.user._id)).catch(() => null) : null;
    const db = getDb();

    // Auto-transition stale unassigned bookings
    try {
      const timedOutRes = await db.query(
        `UPDATE booking.bookings
         SET status = 'unassigned_timeout',
             cancelled_at = NOW(),
             cancellation_reason = 'No provider accepted within 30 minutes',
             version = version + 1,
             updated_at = NOW()
         WHERE status IN ('pending', 'provider_searching')
           AND provider_id IS NULL
           AND (
             (provider_search_expires_at IS NOT NULL AND provider_search_expires_at <= NOW())
             OR (provider_search_expires_at IS NULL AND created_at <= NOW() - INTERVAL '30 minutes')
           )
         RETURNING id, booking_id, user_id`
      );

      if (timedOutRes.rows.length > 0) {
        const timedOutIds = timedOutRes.rows.map(r => String(r.id));
        expireJobRequestsForBookings(timedOutIds).catch(() => {});
        for (const b of timedOutRes.rows) {
          sendNotification(
            String(b.user_id),
            'Booking Couldn\'t Be Assigned',
            `Sorry! Your booking ${b.booking_id} couldn't be assigned. No provider was available.`,
            'booking_timeout',
            { bookingId: String(b.id), booking_id: b.booking_id }
          ).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn('[BOOKING SERVICE] Timeout auto-transition warning:', err.message);
    }

    let whereClause = '';
    const values: any[] = [];

    if (provider && (req.user?.role === 'provider' || req.query.role === 'provider' || req.query.as === 'provider')) {
      // ponytail: bookings store auth.users UUID in provider_id, not provider.providers UUID
      const providerUserId = String((provider as any).user_id || (provider as any).userId || req.user?._id);
      values.push(providerUserId);
      whereClause = `(b.provider_id::text = $1 OR b.provider_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1))`;
    } else if (provider) {
      const providerUserId = String((provider as any).user_id || (provider as any).userId || req.user?._id);
      values.push(providerUserId, String(req.user?._id));
      whereClause = `((b.provider_id::text = $1 OR b.provider_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1))
                   OR (b.user_id::text = $2 OR b.user_id = (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1)))`;
    } else {
      values.push(String(req.user?._id));
      whereClause = `(b.user_id::text = $1 OR b.user_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1))`;
    }

    whereClause += ' AND b.deleted_at IS NULL';

    const countRes = await db.query(
      `SELECT COUNT(*)::int AS total FROM booking.bookings b WHERE ${whereClause}`,
      values
    );
    const total = countRes.rows[0]?.total || 0;

    const offset = (page - 1) * limit;
    values.push(limit, offset);

    const dataRes = await db.query(
      `SELECT b.*,
              u.name AS customer_name,
              u.phone AS customer_phone,
              u.email AS customer_email,
              p.name AS provider_name,
              p.phone AS provider_phone,
              ss.subservice_name,
              ss.base_price AS subservice_base_price,
              srv.service_name,
              cat.name AS category_name,
              addr.address_line_1 AS address_line1,
              addr.city,
              addr.state,
              addr.pincode
       FROM booking.bookings b
       LEFT JOIN auth.users u ON u.id = b.user_id
       LEFT JOIN auth.users p ON p.id = b.provider_id
       LEFT JOIN catalog.subservices ss ON ss.id = b.subservice_id
       LEFT JOIN catalog.services srv ON srv.id = ss.service_id
       LEFT JOIN catalog.categories cat ON cat.id = srv.category_id
       LEFT JOIN auth.addresses addr ON addr.id = b.address_id
       WHERE ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    const populated = dataRes.rows.map(mapBookingRow);
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
    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const isOwner = String(booking.user_id) === String(req.user?._id);
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    let isProvider = false;
    if (req.user?.role === 'provider' && booking.provider_id) {
      const provider = await getProviderByUserId(req.user._id).catch(() => null);
      if (provider && String((provider as any)._id) === String(booking.provider_id)) {
        isProvider = true;
      }
    }

    if (!isOwner && !isAdmin && !isProvider) {
      res.status(403).json({ message: 'Not authorized to view this booking' });
      return;
    }

    res.json(booking);
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
    const idStrings = ids
      .map((id: any) => (typeof id === 'object' && id !== null ? (id._id || id.id || String(id)) : String(id)))
      .filter(Boolean);

    if (!idStrings.length) {
      res.json([]);
      return;
    }

    const db = getDb();
    const resBatch = await db.query(
      `SELECT * FROM booking.bookings WHERE id::text = ANY($1::text[]) OR legacy_mongo_id = ANY($1::text[]) OR booking_id = ANY($1::text[])`,
      [idStrings]
    );

    res.json(resBatch.rows.map(mapBookingRow));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get aggregated stats for a provider (Internal)
// @route   GET /api/bookings/provider/:providerId/stats
// @access  Internal
export const getProviderBookingStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const resAgg = await db.query(
      `SELECT status,
              COUNT(*)::int AS count,
              COALESCE(SUM(COALESCE(provider_payout, payable_amount * 0.85)), 0)::numeric AS payout
       FROM booking.bookings
       WHERE (provider_id::text = $1 OR provider_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1))
         AND deleted_at IS NULL
       GROUP BY status`,
      [req.params.providerId]
    );

    let total_jobs = 0, completed_jobs = 0, earnings = 0;
    for (const row of resAgg.rows) {
      total_jobs += row.count;
      if (row.status === 'completed' || row.status === 'service_completed') {
        completed_jobs += row.count;
        earnings += parseFloat(row.payout || 0);
      }
    }

    res.json({ total_jobs, completed_jobs, earnings });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get aggregated stats for multiple providers (Internal)
// @route   POST /api/bookings/provider-stats-batch
// @access  Internal
export const getProviderBookingStatsBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerIds } = req.body;
    if (!providerIds || !Array.isArray(providerIds) || providerIds.length === 0) {
      res.json({});
      return;
    }

    const db = getDb();
    const idStrings = providerIds.map(String);
    const resAgg = await db.query(
      `SELECT provider_id::text AS provider_id, status, COUNT(*)::int AS count
       FROM booking.bookings
       WHERE (provider_id::text = ANY($1::text[]) OR provider_id IN (SELECT id FROM auth.users WHERE legacy_mongo_id = ANY($1::text[])))
         AND deleted_at IS NULL
       GROUP BY provider_id, status`,
      [idStrings]
    );

    const result: Record<string, { total_jobs: number; completed_jobs: number }> = {};
    for (const row of resAgg.rows) {
      const pid = String(row.provider_id);
      if (!result[pid]) {
        result[pid] = { total_jobs: 0, completed_jobs: 0 };
      }
      result[pid].total_jobs += row.count;
      if (row.status === 'completed') {
        result[pid].completed_jobs += row.count;
      }
    }

    res.json(result);
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

    const result = await BookingRepository.findBookings({
      userId: req.params.userId,
      page,
      limit,
    });

    res.json({ data: result.bookings, total: result.total, page, limit, pages: Math.ceil(result.total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get bookings for a specific provider
// @route   GET /api/bookings/provider/:providerId
// @access  Private/Provider
export const getBookingsByProvider = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAdmin) {
      const provider = await getProviderByUserId(req.user?._id || '').catch(() => null);
      if (!provider || String((provider as any)._id) !== String(req.params.providerId)) {
        res.status(403).json({ message: 'Forbidden: Not authorized to view bookings for this provider' });
        return;
      }
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const result = await BookingRepository.findBookings({
      providerId: req.params.providerId,
      page,
      limit,
    });

    res.json({ data: result.bookings, total: result.total, page, limit, pages: Math.ceil(result.total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get booking activity timeline
// @route   GET /api/bookings/:id/activity
// @access  Private/Admin
export const getBookingActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const resActivities = await db.query(
      `SELECT * FROM booking.booking_activities
       WHERE booking_id::text = $1
          OR booking_id = (SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1 LIMIT 1)
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    res.json(resActivities.rows);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Pre-payment availability & capacity check
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
    const capacityDoc = await SlotCapacityRepository.findBySlot('00000000-0000-0000-0000-000000000000', new Date(targetDate), targetTime);
    const maxCapacity = capacityDoc?.maxCapacity ?? 40;
    const bookedCount = capacityDoc?.bookedCount ?? 0;

    const alternatives = [
      { time: '11:00 AM', label: '11:00 AM (Recommended)', date: targetDate },
      { time: '02:00 PM', label: '02:00 PM (Afternoon)', date: targetDate },
      { time: '05:00 PM', label: '05:00 PM (Evening)', date: targetDate }
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

// @desc    Get completed bookings for backfill reconciliation
// @route   GET /api/bookings/internal/completed-unsettled?since=ISO_DATE
// @access  Internal
export const getCompletedUnsettledBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const since = req.query.since as string;
    let query = `
      SELECT b.id, b.booking_id, b.provider_id, b.payable_amount, b.payment_method,
             b.commission_percentage, b.variant_name, ss.subservice_name
      FROM booking.bookings b
      LEFT JOIN catalog.subservices ss ON ss.id = b.subservice_id
      WHERE b.status = 'completed' AND b.provider_id IS NOT NULL AND b.deleted_at IS NULL
    `;
    const values: any[] = [];

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        values.push(sinceDate);
        query += ` AND b.updated_at >= $1`;
      }
    }

    const resBookings = await db.query(query, values);

    res.json(resBookings.rows.map((b: any) => ({
      booking_id: b.id,
      booking_display_id: b.booking_id,
      provider_id: b.provider_id,
      payable_amount: parseFloat(b.payable_amount || 0),
      payment_type: b.payment_method === 'cod' ? 'cod' : 'online',
      commission_percentage: parseFloat(b.commission_percentage || 15),
      service_name: b.subservice_name || b.variant_name || 'Home Service',
      variant_name: b.variant_name,
    })));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
