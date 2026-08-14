import { Request, Response, NextFunction } from 'express';
import { Booking } from '../models/Booking';
import { sendSuccess, sendError, ErrorCodes } from '@bharatclap/shared';
import { getUsersBatch, getCatalogBatch } from '../utils/internalApi';
import axios from 'axios';

const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const internalKey = process.env.INTERNAL_SERVICE_KEY || '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // All booking aggregations in parallel
    const [
      totalBookings,
      todayBookings,
      cancelledOrders,
      cancelledToday,
      activeBookings,
      revenueAggr,
      todayRevenueAggr,
      completedCount,
      recentBookingsRaw
    ] = await Promise.all([
      Booking.countDocuments({ isDeleted: false }),
      Booking.countDocuments({ isDeleted: false, createdAt: { $gte: startOfToday } }),
      Booking.countDocuments({ status: { $in: ['cancelled', 'CANCELLED', 'unassigned_timeout', 'HIGH_DEMAND_TIMEOUT', 'rejected'] }, isDeleted: false }),
      Booking.countDocuments({
        status: { $in: ['cancelled', 'CANCELLED', 'unassigned_timeout', 'HIGH_DEMAND_TIMEOUT', 'rejected'] },
        isDeleted: false,
        $or: [
          { updatedAt: { $gte: startOfToday } },
          { createdAt: { $gte: startOfToday } }
        ]
      }),
      Booking.countDocuments({ status: { $in: ['accepted', 'on_the_way', 'arrived', 'in_progress', 'waiting_start_otp', 'waiting_end_otp'] }, isDeleted: false }),
      Booking.aggregate([
        { $match: { status: 'completed', isDeleted: false } },
        { $group: { _id: null, gross: { $sum: '$payable_amount' }, commission: { $sum: { $ifNull: ['$commission_amount', 0] } }, providerPayout: { $sum: { $ifNull: ['$provider_payout', 0] } } } }
      ]),
      Booking.aggregate([
        { $match: { status: 'completed', isDeleted: false, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, gross: { $sum: '$payable_amount' }, commission: { $sum: { $ifNull: ['$commission_amount', 0] } } } }
      ]),
      Booking.countDocuments({ status: 'completed', isDeleted: false }),
      Booking.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(8).lean()
    ]);

    const grossRevenue = revenueAggr[0]?.gross || 0;
    const platformRevenue = revenueAggr[0]?.commission || 0;
    const providerEarnings = revenueAggr[0]?.providerPayout || 0;
    const todayRevenue = todayRevenueAggr[0]?.commission || 0;
    const todayGross = todayRevenueAggr[0]?.gross || 0;
    const eligibleForCompletion = completedCount + cancelledOrders;
    const completionRate = eligibleForCompletion > 0 ? Math.round((completedCount / eligibleForCompletion) * 1000) / 10 : 0;

    // Stuck bookings — real queries
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);

    const [acceptedOver2h, waitingStartOver30m, waitingEndOver3h, searchingOver10m, pendingRefunds, pendingPayouts] = await Promise.all([
      Booking.countDocuments({ status: 'accepted', accepted_at: { $lte: twoHoursAgo }, isDeleted: false }),
      Booking.countDocuments({ status: 'waiting_start_otp', updatedAt: { $lte: thirtyMinAgo }, isDeleted: false }),
      Booking.countDocuments({ status: 'waiting_end_otp', updatedAt: { $lte: threeHoursAgo }, isDeleted: false }),
      Booking.countDocuments({ status: 'provider_searching', updatedAt: { $lte: tenMinAgo }, isDeleted: false }),
      Booking.countDocuments({ refund_status: { $in: ['initiated', 'processing'] }, isDeleted: false }),
      Booking.countDocuments({ settlement_status: { $in: ['Queued', 'Created', 'Ready'] }, isDeleted: false })
    ]);

    // Enrich recent bookings with user names + service names
    let recentBookings: any[] = [];
    if (recentBookingsRaw.length > 0) {
      const userIds = [...new Set(recentBookingsRaw.map(b => b.user_id?.toString()).filter(Boolean))];
      const subserviceIds = [...new Set(recentBookingsRaw.map(b => b.subservice_id?.toString()).filter(Boolean))];

      const [users, catalogData] = await Promise.all([
        getUsersBatch(userIds).catch(() => []),
        getCatalogBatch(subserviceIds, [], [], []).catch(() => ({ subservices: [], services: [], categories: [], coupons: [] }))
      ]);

      const userMap = new Map((users as any[]).map(u => [String(u._id), u]));
      const subMap = new Map(catalogData.subservices.map((s: any) => [String(s._id), s.subservice_name || s.name || 'Service']));

      recentBookings = recentBookingsRaw.map(b => {
        const u: any = userMap.get(String(b.user_id)) || {};
        return {
          id: b.booking_id || String(b._id).slice(-8).toUpperCase(),
          client: u.name || u.full_name || u.phone || 'Customer',
          service: subMap.get(String(b.subservice_id)) || 'Service',
          status: b.status,
          price: b.payable_amount || 0,
          color: b.status === 'completed' ? 'green' : b.status === 'cancelled' ? 'red' : 'blue',
          date: b.createdAt
        };
      });
    }

    // External service counts - execute in parallel with tight timeouts for instant loading
    let userCount = 0;
    let providerCount = 0;
    let verifiedProviders = 0;
    let pendingVerification = 0;
    let pendingSettlements = 0;

    try {
      const [authRes, pRes] = await Promise.all([
        axios.get(`${process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001'}/api/users/stats`, {
          headers: { 'x-internal-service-key': internalKey }, timeout: 1500
        }).catch(() => null),
        axios.get(`${providerServiceUrl}/api/providers/stats`, {
          headers: { 'x-internal-service-key': internalKey }, timeout: 1500
        }).catch(() => null)
      ]);

      if (authRes?.data) {
        userCount = authRes.data.totalCustomers || 0;
      }
      if (pRes?.data) {
        const pd = pRes.data?.data || pRes.data;
        providerCount = pd.total || pd.totalProviders || 0;
        verifiedProviders = pd.verified || 0;
        pendingVerification = pd.pending || 0;
      }
    } catch (_) {}

    sendSuccess(res, 200, 'Dashboard overview stats fetched successfully', {
      // Executive KPI row 1
      todayRevenue,
      todayGross,
      todayBookings,
      activeBookings,
      completionRate,
      // Executive KPI row 2
      totalCustomers: userCount,
      totalProviders: providerCount,
      verifiedProviders,
      pendingVerification,
      pendingSettlements,
      cancelledToday,
      // Totals
      totalBookings,
      grossRevenue,
      platformRevenue,
      providerEarnings,
      cancelledOrders,
      completedBookings: completedCount,
      // Stuck bookings — real data
      stuckBookings: {
        acceptedOver2h,
        waitingStartOver30m,
        waitingEndOver3h,
        searchingOver10m,
        pendingRefunds,
        pendingPayouts,
      },
      recentBookings,
    });
  } catch (err) {
    next(err);
  }
};

export const getLiveKpis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const [
      todayCompleted,
      todayCancelled,
      todayRevenueAggr,
      yesterdayRevenueAggr,
      mtdRevenueAggr,
      jobsWaiting,
      jobsRunning,
      totalCompleted,
      totalEligible
    ] = await Promise.all([
      Booking.countDocuments({ status: 'completed', createdAt: { $gte: startOfToday }, isDeleted: false }),
      Booking.countDocuments({ status: 'cancelled', createdAt: { $gte: startOfToday }, isDeleted: false }),
      Booking.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfToday }, isDeleted: false } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$commission_amount', '$payable_amount'] } } } }
      ]),
      Booking.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfYesterday, $lt: startOfToday }, isDeleted: false } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$commission_amount', '$payable_amount'] } } } }
      ]),
      Booking.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfMonth }, isDeleted: false } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$commission_amount', '$payable_amount'] } } } }
      ]),
      Booking.countDocuments({ status: { $in: ['pending', 'provider_searching'] }, isDeleted: false }),
      Booking.countDocuments({ status: { $in: ['accepted', 'on_the_way', 'arrived', 'in_progress', 'waiting_start_otp', 'waiting_end_otp'] }, isDeleted: false }),
      Booking.countDocuments({ status: 'completed', isDeleted: false }),
      Booking.countDocuments({ status: { $in: ['completed', 'cancelled'] }, isDeleted: false })
    ]);

    const todayRevenue = todayRevenueAggr[0]?.total || 0;
    const yesterdayRevenue = yesterdayRevenueAggr[0]?.total || 0;
    const mtdRevenue = mtdRevenueAggr[0]?.total || 0;

    // Real health metrics computed from actual data
    const completionRate = totalEligible > 0 ? Math.round((totalCompleted / totalEligible) * 1000) / 10 : 0;
    const cancellationRate = totalEligible > 0 ? Math.round(((totalEligible - totalCompleted) / totalEligible) * 1000) / 10 : 0;

    let liveProviders = 0;
    let busyProviders = 0;
    let availableProviders = 0;

    try {
      const pRes = await axios.get(`${providerServiceUrl}/api/providers/stats`, {
        headers: { 'x-internal-service-key': internalKey }, timeout: 3000
      }).catch(() => null);
      if (pRes?.data) {
        const pd = pRes.data?.data || pRes.data;
        liveProviders = pd.total || pd.totalProviders || 0;
        // ponytail: online/busy not available from /stats yet — use total for now
      }
    } catch (_) {}

    availableProviders = Math.max(0, liveProviders - busyProviders);

    const kpis = {
      liveProviders,
      busyProviders,
      availableProviders,
      jobsWaiting,
      runningJobs: jobsRunning,
      completedToday: todayCompleted,
      cancelledToday: todayCancelled,
      todayRevenue,
      yesterdayRevenue,
      mtdRevenue,
      queueHealth: jobsWaiting > 10 ? 'RED' : jobsWaiting > 5 ? 'YELLOW' : 'GREEN'
    };

    // ponytail: only real computed metrics, no hardcoded numbers
    const healthMetrics = {
      completionRate,
      cancellationPercent: cancellationRate,
    };

    sendSuccess(res, 200, 'Live operational KPIs fetched successfully', {
      kpis,
      healthMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

export const getLiveQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queueCounts = await Booking.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const statusMap: Record<string, number> = {};
    queueCounts.forEach(q => {
      statusMap[q._id] = q.count;
    });

    const liveQueue = {
      pending: statusMap['pending'] || 0,
      searching_provider: statusMap['provider_searching'] || statusMap['searching'] || 0,
      assigned: statusMap['assigned'] || 0,
      accepted: statusMap['accepted'] || 0,
      travelling: statusMap['travelling'] || statusMap['on_the_way'] || 0,
      arrived: statusMap['arrived'] || statusMap['waiting_start_otp'] || 0,
      service_running: statusMap['in_progress'] || statusMap['running'] || 0,
      payment_pending: statusMap['waiting_end_otp'] || statusMap['payment_pending'] || 0,
      completed: statusMap['completed'] || 0,
      cancelled: statusMap['cancelled'] || 0
    };

    sendSuccess(res, 200, 'Live booking queue fetched successfully', { liveQueue });
  } catch (err) {
    next(err);
  }
};
