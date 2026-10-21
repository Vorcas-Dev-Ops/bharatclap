import { Request, Response, NextFunction } from 'express';
import { getDb } from '../config/db';
import { getCache, setCache } from '../config/redis';
import { sendSuccess } from '@bharatclap/shared';
import { getUsersBatch, getCatalogBatch } from '../utils/internalApi';
import axios from 'axios';

const internalKey = process.env.INTERNAL_SERVICE_KEY || '';
const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5002';
const DASHBOARD_CACHE_KEY = 'booking:admin:dashboard_stats';
const DASHBOARD_CACHE_TTL = 60; // 60 seconds

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const forceRefresh = req.query.force_refresh === 'true';

    if (!forceRefresh) {
      const cached = await getCache(DASHBOARD_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          sendSuccess(res, 200, 'Dashboard overview stats fetched successfully (cached)', parsed);
          return;
        } catch (_) {}
      }
    }

    const db = getDb();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);

    // Consolidate 14 aggregation queries into 1 single FILTER query alongside recent bookings
    const [aggregatedStatsRes, recentBookingsRes] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)::int AS total_bookings,
          COUNT(*) FILTER (WHERE created_at >= $1)::int AS today_bookings,
          COUNT(*) FILTER (WHERE status IN ('cancelled', 'CANCELLED', 'unassigned_timeout', 'HIGH_DEMAND_TIMEOUT', 'rejected'))::int AS cancelled_orders,
          COUNT(*) FILTER (WHERE status IN ('cancelled', 'CANCELLED', 'unassigned_timeout', 'HIGH_DEMAND_TIMEOUT', 'rejected') AND (updated_at >= $1 OR created_at >= $1))::int AS cancelled_today,
          COUNT(*) FILTER (WHERE status IN ('accepted', 'on_the_way', 'arrived', 'in_progress', 'waiting_start_otp', 'waiting_end_otp'))::int AS active_bookings,
          COUNT(*) FILTER (WHERE status IN ('completed', 'service_completed'))::int AS completed_count,
          COALESCE(SUM(COALESCE(payable_amount, service_price, 0)) FILTER (WHERE status IN ('completed', 'service_completed')), 0)::float AS gross_revenue,
          COALESCE(SUM(CASE WHEN COALESCE(commission_amount, 0) > 0 THEN commission_amount ELSE COALESCE(payable_amount, service_price, 0) * 0.15 END) FILTER (WHERE status IN ('completed', 'service_completed')), 0)::float AS platform_revenue,
          COALESCE(SUM(CASE WHEN COALESCE(provider_payout, 0) > 0 THEN provider_payout ELSE COALESCE(payable_amount, service_price, 0) * 0.85 END) FILTER (WHERE status IN ('completed', 'service_completed')), 0)::float AS provider_earnings,
          COALESCE(SUM(COALESCE(payable_amount, service_price, 0)) FILTER (WHERE status IN ('completed', 'service_completed') AND (completed_at >= $1 OR updated_at >= $1 OR created_at >= $1)), 0)::float AS today_gross,
          COALESCE(SUM(CASE WHEN COALESCE(commission_amount, 0) > 0 THEN commission_amount ELSE COALESCE(payable_amount, service_price, 0) * 0.15 END) FILTER (WHERE status IN ('completed', 'service_completed') AND (completed_at >= $1 OR updated_at >= $1 OR created_at >= $1)), 0)::float AS today_revenue,
          COUNT(*) FILTER (WHERE status = 'accepted' AND accepted_at <= $2)::int AS accepted_over_2h,
          COUNT(*) FILTER (WHERE status = 'waiting_start_otp' AND updated_at <= $3)::int AS waiting_start_over_30m,
          COUNT(*) FILTER (WHERE status = 'waiting_end_otp' AND updated_at <= $4)::int AS waiting_end_over_3h,
          COUNT(*) FILTER (WHERE status = 'provider_searching' AND updated_at <= $5)::int AS searching_over_10m,
          COUNT(*) FILTER (WHERE refund_status IN ('initiated', 'processing'))::int AS pending_refunds,
          COUNT(*) FILTER (WHERE settlement_status IN ('Queued', 'Created', 'Ready'))::int AS pending_payouts
        FROM booking.bookings
        WHERE deleted_at IS NULL
      `, [startOfToday, twoHoursAgo, thirtyMinAgo, threeHoursAgo, tenMinAgo]),
      db.query(`
        SELECT id, booking_id, user_id, subservice_id, status, payable_amount, created_at
        FROM booking.bookings
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 8
      `)
    ]);

    const statsRow = aggregatedStatsRes.rows[0] || {};
    const totalBookings = statsRow.total_bookings || 0;
    const todayBookings = statsRow.today_bookings || 0;
    const cancelledOrders = statsRow.cancelled_orders || 0;
    const cancelledToday = statsRow.cancelled_today || 0;
    const activeBookings = statsRow.active_bookings || 0;
    const completedCount = statsRow.completed_count || 0;

    const grossRevenue = statsRow.gross_revenue || 0;
    const platformRevenue = statsRow.platform_revenue || 0;
    const providerEarnings = statsRow.provider_earnings || 0;
    const todayRevenue = statsRow.today_revenue || 0;
    const todayGross = statsRow.today_gross || 0;

    const eligibleForCompletion = completedCount + cancelledOrders;
    const completionRate = eligibleForCompletion > 0 ? Math.round((completedCount / eligibleForCompletion) * 1000) / 10 : 0;

    const acceptedOver2h = statsRow.accepted_over_2h || 0;
    const waitingStartOver30m = statsRow.waiting_start_over_30m || 0;
    const waitingEndOver3h = statsRow.waiting_end_over_3h || 0;
    const searchingOver10m = statsRow.searching_over_10m || 0;
    const pendingRefunds = statsRow.pending_refunds || 0;
    const pendingPayouts = statsRow.pending_payouts || 0;

    // Enrich recent bookings with user names + service names
    const recentBookingsRaw = recentBookingsRes.rows;
    let recentBookings: any[] = [];
    if (recentBookingsRaw.length > 0) {
      const userIds = [...new Set(recentBookingsRaw.map(b => b.user_id?.toString()).filter(Boolean))];
      const subserviceIds = [...new Set(recentBookingsRaw.map(b => b.subservice_id?.toString()).filter(Boolean))];

      const [users, catalogData] = await Promise.all([
        getUsersBatch(userIds).catch(() => []),
        getCatalogBatch(subserviceIds, [], [], []).catch(() => ({ subservices: [], services: [], categories: [], coupons: [] }))
      ]);

      const userMap = new Map((users as any[]).map(u => [String(u._id || u.id), u]));
      const subMap = new Map(catalogData.subservices.map((s: any) => [String(s._id || s.id), s.subservice_name || s.name || 'Service']));

      recentBookings = recentBookingsRaw.map(b => {
        const u: any = userMap.get(String(b.user_id)) || {};
        return {
          id: b.booking_id || String(b.id).slice(-8).toUpperCase(),
          client: u.name || u.full_name || u.phone || 'Customer',
          service: subMap.get(String(b.subservice_id)) || 'Service',
          status: b.status,
          price: Number(b.payable_amount) || 0,
          color: b.status === 'completed' ? 'green' : b.status === 'cancelled' ? 'red' : 'blue',
          date: b.created_at
        };
      });
    }

    // External service counts
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

    const payload = {
      todayRevenue,
      todayGross,
      todayBookings,
      activeBookings,
      completionRate,
      totalCustomers: userCount,
      totalProviders: providerCount,
      verifiedProviders,
      pendingVerification,
      pendingSettlements,
      cancelledToday,
      totalBookings,
      grossRevenue,
      platformRevenue,
      providerEarnings,
      cancelledOrders,
      completedBookings: completedCount,
      stuckBookings: {
        acceptedOver2h,
        waitingStartOver30m,
        waitingEndOver3h,
        searchingOver10m,
        pendingRefunds,
        pendingPayouts,
      },
      recentBookings,
    };

    // Cache payload for 60 seconds (non-blocking)
    setCache(DASHBOARD_CACHE_KEY, payload, DASHBOARD_CACHE_TTL).catch(() => {});

    sendSuccess(res, 200, 'Dashboard overview stats fetched successfully', payload);
  } catch (err) {
    next(err);
  }
};

const LIVE_KPIS_CACHE_KEY = 'booking:admin:live_kpis';
const LIVE_KPIS_CACHE_TTL = 30; // 30 seconds

export const getLiveKpis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const forceRefresh = req.query.force_refresh === 'true';

    if (!forceRefresh) {
      const cached = await getCache(LIVE_KPIS_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          sendSuccess(res, 200, 'Live operational KPIs fetched successfully (cached)', parsed);
          return;
        } catch (_) {}
      }
    }

    const db = getDb();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    // Consolidate 9 operational queries into 1 single FILTER query
    const kpiStatsRes = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('completed', 'service_completed') AND (completed_at >= $1 OR updated_at >= $1 OR created_at >= $1))::int AS today_completed,
        COUNT(*) FILTER (WHERE status = 'cancelled' AND created_at >= $1)::int AS today_cancelled,
        COALESCE(SUM(COALESCE(payable_amount, service_price, 0)) FILTER (WHERE status IN ('completed', 'service_completed') AND (completed_at >= $1 OR updated_at >= $1 OR created_at >= $1)), 0)::float AS today_revenue,
        COALESCE(SUM(COALESCE(payable_amount, service_price, 0)) FILTER (WHERE status IN ('completed', 'service_completed') AND ((completed_at >= $2 AND completed_at < $1) OR (updated_at >= $2 AND updated_at < $1) OR (created_at >= $2 AND created_at < $1))), 0)::float AS yesterday_revenue,
        COALESCE(SUM(COALESCE(payable_amount, service_price, 0)) FILTER (WHERE status IN ('completed', 'service_completed') AND (completed_at >= $3 OR updated_at >= $3 OR created_at >= $3)), 0)::float AS mtd_revenue,
        COUNT(*) FILTER (WHERE status IN ('pending', 'provider_searching'))::int AS jobs_waiting,
        COUNT(*) FILTER (WHERE status IN ('accepted', 'on_the_way', 'arrived', 'in_progress', 'waiting_start_otp', 'waiting_end_otp'))::int AS jobs_running,
        COUNT(*) FILTER (WHERE status IN ('completed', 'service_completed'))::int AS total_completed,
        COUNT(*) FILTER (WHERE status IN ('completed', 'service_completed', 'cancelled'))::int AS total_eligible
      FROM booking.bookings
      WHERE deleted_at IS NULL
    `, [startOfToday, startOfYesterday, startOfMonth]);

    const row = kpiStatsRes.rows[0] || {};
    const todayCompleted = row.today_completed || 0;
    const todayCancelled = row.today_cancelled || 0;
    const todayRevenue = row.today_revenue || 0;
    const yesterdayRevenue = row.yesterday_revenue || 0;
    const mtdRevenue = row.mtd_revenue || 0;
    const jobsWaiting = row.jobs_waiting || 0;
    const jobsRunning = row.jobs_running || 0;
    const totalCompleted = row.total_completed || 0;
    const totalEligible = row.total_eligible || 0;

    const completionRate = totalEligible > 0 ? Math.round((totalCompleted / totalEligible) * 1000) / 10 : 0;
    const cancellationRate = totalEligible > 0 ? Math.round(((totalEligible - totalCompleted) / totalEligible) * 1000) / 10 : 0;

    let liveProviders = 0;
    let busyProviders = 0;

    try {
      const pRes = await axios.get(`${providerServiceUrl}/api/providers/stats`, {
        headers: { 'x-internal-service-key': internalKey }, timeout: 3000
      }).catch(() => null);
      if (pRes?.data) {
        const pd = pRes.data?.data || pRes.data;
        liveProviders = pd.total || pd.totalProviders || 0;
      }
    } catch (_) {}

    const availableProviders = Math.max(0, liveProviders - busyProviders);

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

    const healthMetrics = {
      completionRate,
      cancellationPercent: cancellationRate,
    };

    const payload = {
      kpis,
      healthMetrics,
      timestamp: new Date().toISOString()
    };

    setCache(LIVE_KPIS_CACHE_KEY, payload, LIVE_KPIS_CACHE_TTL).catch(() => {});

    sendSuccess(res, 200, 'Live operational KPIs fetched successfully', payload);
  } catch (err) {
    next(err);
  }
};

export const getLiveQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db = getDb();
    const result = await db.query(`
      SELECT status, COUNT(*)::int AS count
      FROM booking.bookings
      WHERE deleted_at IS NULL
      GROUP BY status
    `);

    const statusMap: Record<string, number> = {};
    result.rows.forEach(q => {
      statusMap[q.status] = q.count;
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
