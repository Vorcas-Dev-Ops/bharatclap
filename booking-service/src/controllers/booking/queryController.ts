import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Booking } from '../../models/Booking';
import mongoose from 'mongoose';
import axios from 'axios';
import {
  getUsersBatch,
  getAddressesBatch,
  getProvidersBatch,
  getCatalogBatch,
  InternalUser
} from '../../utils/internalApi';

const populateBookings = async (bookings: any[]) => {
  if (!bookings || bookings.length === 0) return [];

  const userIds = [...new Set(bookings.map(b => b.user_id?.toString()).filter(Boolean))];
  const addressIds = [...new Set(bookings.map(b => b.address_id?.toString()).filter(Boolean))];
  const providerIds = [...new Set(bookings.map(b => b.provider_id?.toString()).filter(Boolean))];
  const subserviceIds = [...new Set(bookings.map(b => b.subservice_id?.toString()).filter(Boolean))];

  const [users, addresses, providers] = await Promise.all([
    getUsersBatch(userIds),
    getAddressesBatch(addressIds),
    getProvidersBatch(providerIds)
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
  if (subserviceIds.length > 0) {
    // Call 1: fetch subservices, services, and categories in one round-trip
    const catalogData = await getCatalogBatch(subserviceIds, [], [], [], true);

    const categoryMap = new Map(catalogData.categories.map((c: any) => [String(c._id), c]));
    const serviceMap = new Map(catalogData.services.map((s: any) => [
      String(s._id),
      { ...s, category_id: categoryMap.get(String(s.category_id)) || s.category_id }
    ]));

    const populatedSubservices = catalogData.subservices.map((s: any) => ({
      ...s,
      service_id: serviceMap.get(String(s.service_id)) || s.service_id
    }));
    subserviceMap = new Map(populatedSubservices.map((s: any) => [String(s._id), s]));
  }

  return bookings.map(b => ({
    ...b,
    user_id: userMap.get(String(b.user_id)) || b.user_id,
    address_id: addressMap.get(String(b.address_id)) || b.address_id,
    provider_id: providerMap.get(String(b.provider_id)) || b.provider_id,
    subservice_id: subserviceMap.get(String(b.subservice_id)) || b.subservice_id
  }));
};

// @desc    Get all bookings (Admin)
// @route   GET /api/bookings
// @access  Private/Admin
export const getAllBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const [bookings, total] = await Promise.all([
      Booking.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments({ isDeleted: false })
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
      try {
        const token = req.headers.authorization;
        const response = await axios.get(`${process.env.PROVIDER_SERVICE_URL || 'http://localhost:5003'}/api/providers/me`, {
          headers: { Authorization: token }
        });
        const provider = response.data;
        query = { provider_id: provider ? provider._id : new mongoose.Types.ObjectId() };
      } catch (err) {
        query = { provider_id: new mongoose.Types.ObjectId() };
      }
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
    const booking = await Booking.findById(req.params.id).lean();

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    // Verify ownership or admin
    if (booking.user_id.toString() !== req.user?._id.toString() && req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Not authorized' });
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
// @access  Private/Provider
export const getBookingsByProvider = async (req: Request, res: Response): Promise<void> => {
  try {
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
