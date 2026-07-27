import { Request, Response } from 'express';
import { Booking } from '../models/Booking';
import mongoose from 'mongoose';
import { getUsersBatch, getProvidersBatch, getCatalogBatch, getUserStats, getProviderStats } from '../utils/internalApi';
import axios from 'axios';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // ── Stats that live entirely in booking-service ───────────────────────
    const totalBookings      = await Booking.countDocuments({ isDeleted: { $ne: true } });
    const cancelledOrders    = await Booking.countDocuments({ status: 'cancelled', isDeleted: { $ne: true } });

    const revenueAggr = await Booking.aggregate([
      { $match: { status: 'completed', isDeleted: { $ne: true } } },
      { $group: { _id: null, totalRevenue: { $sum: '$payable_amount' } } }
    ]);
    const revenue = revenueAggr.length > 0 ? revenueAggr[0].totalRevenue : 0;

    // ── Recent Bookings (top 10) ──────────────────────────────────────────
    const recentRaw = await Booking.find({ isDeleted: { $ne: true } })
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
      const [userStatsData, providerStatsData] = await Promise.all([
        getUserStats(),
        getProviderStats()
      ]);

      if (userStatsData) {
        totalUsers = userStatsData.totalCustomers || 0;
      }
      if (providerStatsData) {
        totalProviders   = providerStatsData.total   || 0;
        pendingApprovals = providerStatsData.pending || 0;
      }
    } catch (_) {
      // Silently skip if stats endpoints fail
    }

    const acceptedStuck = await Booking.countDocuments({
      status: 'accepted',
      accepted_at: { $lt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      isDeleted: false
    });
    const waitingStartStuck = await Booking.countDocuments({
      status: 'waiting_start_otp',
      startOtpGeneratedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) },
      isDeleted: false
    });
    const waitingEndStuck = await Booking.countDocuments({
      status: 'waiting_end_otp',
      endOtpGeneratedAt: { $lt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      isDeleted: false
    });
    const searchingStuck = await Booking.countDocuments({
      status: 'provider_searching',
      createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) },
      isDeleted: false
    });

    let pendingRefunds = 0;
    try {
      const PAY_URL = process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:5005';
      const refRes = await axios.get(`${PAY_URL}/api/refunds?status=requested&limit=1`, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
      });
      pendingRefunds = refRes.data?.total || 0;
    } catch (e: any) {
      console.error('[DASHBOARD] Failed to fetch pending refunds:', e.message);
    }

    let pendingPayouts = 0;
    try {
      const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
      const payRes = await axios.get(`${PROV_URL}/api/payouts?status=pending&limit=1`, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
      });
      pendingPayouts = payRes.data?.total || 0;
    } catch (e: any) {
      console.error('[DASHBOARD] Failed to fetch pending payouts:', e.message);
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
      recentBookings,
      stuckBookings: {
        acceptedOver2h: acceptedStuck,
        waitingStartOver30m: waitingStartStuck,
        waitingEndOver3h: waitingEndStuck,
        searchingOver10m: searchingStuck,
        pendingRefunds,
        pendingPayouts
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
