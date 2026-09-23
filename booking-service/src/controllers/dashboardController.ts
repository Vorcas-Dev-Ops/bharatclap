import { Request, Response, NextFunction } from 'express';
import { getDb } from '../config/db';
import { sendSuccess } from '@bharatclap/shared';
import { getUsersBatch, getCatalogBatch } from '../utils/internalApi';
import axios from 'axios';

const internalKey = process.env.INTERNAL_SERVICE_KEY || 'bharatclap-internal-secret';
const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5002';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db = getDb();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // Parallel queries to PostgreSQL
    const [
      totalBookingsRes,
      todayBookingsRes,
      cancelledOrdersRes,
      cancelledTodayRes,
      activeBookingsRes,
      revenueRes,
      todayRevenueRes,
      completedRes,
      recentBookingsRes
    ] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL`),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND created_at >= $1`, [startOfToday]),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status IN ('cancelled', 'CANCELLED', 'unassigned_timeout', 'HIGH_DEMAND_TIMEOUT', 'rejected')`),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status IN ('cancelled', 'CANCELLED', 'unassigned_timeout', 'HIGH_DEMAND_TIMEOUT', 'rejected') AND (updated_at >= $1 OR created_at >= $1)`, [startOfToday]),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status IN ('accepted', 'on_the_way', 'arrived', 'in_progress', 'waiting_start_otp', 'waiting_end_otp')`),
      db.query(`
        SELECT 
          COALESCE(SUM(COALESCE(payable_amount, service_price, 0)), 0)::float AS gross,
          COALESCE(SUM(CASE WHEN COALESCE(commission_amount, 0) > 0 THEN commission_amount ELSE COALESCE(payable_amount, service_price, 0) * 0.15 END), 0)::float AS commission,
          COALESCE(SUM(CASE WHEN COALESCE(provider_payout, 0) > 0 THEN provider_payout ELSE COALESCE(payable_amount, service_price, 0) * 0.85 END), 0)::float AS provider_payout
        FROM booking.bookings
        WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed')
      `),
      db.query(`
        SELECT 
          COALESCE(SUM(COALESCE(payable_amount, service_price, 0)), 0)::float AS gross,
          COALESCE(SUM(CASE WHEN COALESCE(commission_amount, 0) > 0 THEN commission_amount ELSE COALESCE(payable_amount, service_price, 0) * 0.15 END), 0)::float AS commission
        FROM booking.bookings
        WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed')
          AND (completed_at >= $1 OR updated_at >= $1 OR created_at >= $1)
      `, [startOfToday]),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed')`),
      db.query(`
        SELECT id, booking_id, user_id, subservice_id, status, payable_amount, created_at
        FROM booking.bookings
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 8
      `)
    ]);

    const totalBookings = totalBookingsRes.rows[0]?.count || 0;
    const todayBookings = todayBookingsRes.rows[0]?.count || 0;
    const cancelledOrders = cancelledOrdersRes.rows[0]?.count || 0;
    const cancelledToday = cancelledTodayRes.rows[0]?.count || 0;
    const activeBookings = activeBookingsRes.rows[0]?.count || 0;
    const completedCount = completedRes.rows[0]?.count || 0;

    const grossRevenue = revenueRes.rows[0]?.gross || 0;
    const platformRevenue = revenueRes.rows[0]?.commission || 0;
    const providerEarnings = revenueRes.rows[0]?.provider_payout || 0;
    const todayRevenue = todayRevenueRes.rows[0]?.commission || 0;
    const todayGross = todayRevenueRes.rows[0]?.gross || 0;

    const eligibleForCompletion = completedCount + cancelledOrders;
    const completionRate = eligibleForCompletion > 0 ? Math.round((completedCount / eligibleForCompletion) * 1000) / 10 : 0;

    // Stuck bookings — real queries
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);

    const [acceptedOver2hRes, waitingStartOver30mRes, waitingEndOver3hRes, searchingOver10mRes, pendingRefundsRes, pendingPayoutsRes] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status = 'accepted' AND accepted_at <= $1`, [twoHoursAgo]),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status = 'waiting_start_otp' AND updated_at <= $1`, [thirtyMinAgo]),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status = 'waiting_end_otp' AND updated_at <= $1`, [threeHoursAgo]),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status = 'provider_searching' AND updated_at <= $1`, [tenMinAgo]),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND refund_status IN ('initiated', 'processing')`),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND settlement_status IN ('Queued', 'Created', 'Ready')`)
    ]);

    const acceptedOver2h = acceptedOver2hRes.rows[0]?.count || 0;
    const waitingStartOver30m = waitingStartOver30mRes.rows[0]?.count || 0;
    const waitingEndOver3h = waitingEndOver3hRes.rows[0]?.count || 0;
    const searchingOver10m = searchingOver10mRes.rows[0]?.count || 0;
    const pendingRefunds = pendingRefundsRes.rows[0]?.count || 0;
    const pendingPayouts = pendingPayoutsRes.rows[0]?.count || 0;

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

    sendSuccess(res, 200, 'Dashboard overview stats fetched successfully', {
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
    });
  } catch (err) {
    next(err);
  }
};

export const getLiveKpis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db = getDb();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const [
      todayCompletedRes,
      todayCancelledRes,
      todayRevenueRes,
      yesterdayRevenueRes,
      mtdRevenueRes,
      jobsWaitingRes,
      jobsRunningRes,
      totalCompletedRes,
      totalEligibleRes
    ] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed') AND (completed_at >= $1 OR updated_at >= $1 OR created_at >= $1)`, [startOfToday]),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status = 'cancelled' AND created_at >= $1`, [startOfToday]),
      db.query(`SELECT COALESCE(SUM(COALESCE(payable_amount, service_price, 0)), 0)::float AS total FROM booking.bookings WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed') AND (completed_at >= $1 OR updated_at >= $1 OR created_at >= $1)`, [startOfToday]),
      db.query(`SELECT COALESCE(SUM(COALESCE(payable_amount, service_price, 0)), 0)::float AS total FROM booking.bookings WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed') AND ((completed_at >= $1 AND completed_at < $2) OR (updated_at >= $1 AND updated_at < $2) OR (created_at >= $1 AND created_at < $2))`, [startOfYesterday, startOfToday]),
      db.query(`SELECT COALESCE(SUM(COALESCE(payable_amount, service_price, 0)), 0)::float AS total FROM booking.bookings WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed') AND (completed_at >= $1 OR updated_at >= $1 OR created_at >= $1)`, [startOfMonth]),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status IN ('pending', 'provider_searching')`),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status IN ('accepted', 'on_the_way', 'arrived', 'in_progress', 'waiting_start_otp', 'waiting_end_otp')`),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed')`),
      db.query(`SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed', 'cancelled')`)
    ]);

    const todayCompleted = todayCompletedRes.rows[0]?.count || 0;
    const todayCancelled = todayCancelledRes.rows[0]?.count || 0;
    const todayRevenue = todayRevenueRes.rows[0]?.total || 0;
    const yesterdayRevenue = yesterdayRevenueRes.rows[0]?.total || 0;
    const mtdRevenue = mtdRevenueRes.rows[0]?.total || 0;
    const jobsWaiting = jobsWaitingRes.rows[0]?.count || 0;
    const jobsRunning = jobsRunningRes.rows[0]?.count || 0;
    const totalCompleted = totalCompletedRes.rows[0]?.count || 0;
    const totalEligible = totalEligibleRes.rows[0]?.count || 0;

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
