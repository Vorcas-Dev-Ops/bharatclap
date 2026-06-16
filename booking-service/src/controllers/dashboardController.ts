import { Request, Response } from 'express';
import { Booking } from '../models/Booking';
import mongoose from 'mongoose';
import { getUsersBatch, getProvidersBatch, getCatalogBatch } from '../utils/internalApi';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // ── Stats that live entirely in booking-service ───────────────────────
    const totalBookings      = await Booking.countDocuments({ isDeleted: false });
    const cancelledOrders    = await Booking.countDocuments({ status: 'cancelled', isDeleted: false });

    const revenueAggr = await Booking.aggregate([
      { $match: { status: 'completed', isDeleted: false } },
      { $group: { _id: null, totalRevenue: { $sum: '$payable_amount' } } }
    ]);
    const revenue = revenueAggr.length > 0 ? revenueAggr[0].totalRevenue : 0;

    // ── Recent Bookings (top 10) ──────────────────────────────────────────
    const recentRaw = await Booking.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const userIds       = [...new Set(recentRaw.map(b => b.user_id?.toString()).filter(Boolean))];
    const subserviceIds = [...new Set(recentRaw.map(b => b.subservice_id?.toString()).filter(Boolean))];

    // Fetch users from auth-service and subservices from catalog-service in parallel
    const [users, catalogData] = await Promise.all([
      getUsersBatch(userIds),
      getCatalogBatch(subserviceIds, [], [], [])
    ]);

    // Fetch service names for subservices
    const serviceIds = [...new Set(catalogData.subservices.map((s: any) => s.service_id?.toString()).filter(Boolean))];
    const catalogData2 = serviceIds.length > 0 ? await getCatalogBatch([], serviceIds, [], []) : { subservices: [], services: [], categories: [], coupons: [] };

    const userMap = new Map(users.map((u: any) => [String(u._id), u]));

    const serviceMap = new Map(catalogData2.services.map((s: any) => [String(s._id), s]));
    const subserviceMap = new Map(catalogData.subservices.map((s: any) => [
      String(s._id),
      { ...s, service: serviceMap.get(String(s.service_id)) }
    ]));

    const recentBookings = recentRaw.map(b => {
      const user: any       = userMap.get(String(b.user_id));
      const subservice: any = subserviceMap.get(String(b.subservice_id));
      return {
        id:      b.booking_id,
        _id:     b._id,
        client:  user?.name || 'Unknown User',
        service: subservice?.service?.service_name || subservice?.subservice_name || 'Service',
        status:  b.status.charAt(0).toUpperCase() + b.status.slice(1).replace(/_/g, ' '),
        price:   b.payable_amount,
        color:   ['completed'].includes(b.status) ? 'green'
               : ['cancelled', 'rejected'].includes(b.status) ? 'red'
               : 'blue',
      };
    });

    // ── Cross-service stats: fetch counts from each service API ──────────
    // We call the provider-service /batch with empty ids just to see if it's up;
    // actual counts come from dedicated stats endpoints or we fall back to 0.
    let totalUsers     = 0;
    let totalProviders = 0;
    let pendingApprovals = 0;

    try {
      const { default: axios } = await import('axios');
      const AUTH_URL     = process.env.AUTH_SERVICE_URL     || 'http://localhost:5001';
      const PROVIDER_URL = process.env.PROVIDER_SERVICE_URL || 'http://localhost:5003';

      const [userStatsRes, providerStatsRes] = await Promise.allSettled([
        axios.get(`${AUTH_URL}/api/users/stats`),
        axios.get(`${PROVIDER_URL}/api/providers/stats`)
      ]);

      if (userStatsRes.status === 'fulfilled') {
        totalUsers = userStatsRes.value.data?.totalCustomers || 0;
      }
      if (providerStatsRes.status === 'fulfilled') {
        totalProviders   = providerStatsRes.value.data?.total   || 0;
        pendingApprovals = providerStatsRes.value.data?.pending || 0;
      }
    } catch (_) {
      // Silently skip if stats endpoints don't exist yet
    }

    res.json({
      stats: [
        { title: 'Total Users',        value: totalUsers.toLocaleString() },
        { title: 'Service Providers',  value: totalProviders.toLocaleString() },
        { title: 'Total Bookings',     value: totalBookings.toLocaleString() },
        { title: 'Revenue',            value: `₹${(revenue / 100000).toFixed(2)}L` },
        { title: 'Pending Approvals',  value: pendingApprovals.toLocaleString() },
        { title: 'Cancelled Orders',   value: cancelledOrders.toLocaleString() },
      ],
      recentBookings
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
