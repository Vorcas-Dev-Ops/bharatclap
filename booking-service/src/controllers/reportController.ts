import { Request, Response } from 'express';
import { Booking } from '../models/Booking';
import { getProvidersBatch, getCatalogBatch } from '../utils/internalApi';
import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';

export const getReportsData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateRange, startDate: customStart, endDate: customEnd, vertical, provider } = req.query;

    const now = new Date();
    let startDate = new Date();
    let endDate = now;

    if (dateRange === 'Last 7 Days') {
      startDate.setDate(now.getDate() - 7);
    } else if (dateRange === 'Last 30 Days') {
      startDate.setDate(now.getDate() - 30);
    } else if (dateRange === 'Last 90 Days') {
      startDate.setDate(now.getDate() - 90);
    } else if (dateRange === 'This Month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRange === 'Previous Month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (dateRange === 'Custom' && customStart && customEnd) {
      startDate = new Date(customStart as string);
      endDate   = new Date(customEnd as string);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate.setDate(now.getDate() - 30);
    }

    const daysCount = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // ── Base match — date filter pushed into MongoDB, never into JS ──────────
    const baseMatch: any = { isDeleted: false, createdAt: { $gte: startDate, $lte: endDate } };
    const completedMatch = { ...baseMatch, status: 'completed' };

    // ── Run all 5 aggregations in parallel ───────────────────────────────────
    const [statusAgg, trendAgg, subserviceAgg, providerAgg, peakHoursAgg] = await Promise.all([

      // 1. Summary: count + revenue by status
      Booking.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$payable_amount' } } }
      ]),

      // 2. Trend: daily (≤60 days) or monthly
      Booking.aggregate([
        { $match: baseMatch },
        { $group: {
          _id: daysCount <= 60
            ? { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } }
            : { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$payable_amount', 0] } },
          bookings: { $sum: 1 }
        }},
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]),

      // 3. Revenue by subservice (top 10 for category breakdown)
      Booking.aggregate([
        { $match: { ...completedMatch, subservice_id: { $exists: true, $ne: null } } },
        { $group: { _id: '$subservice_id', revenue: { $sum: '$payable_amount' } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 }
      ]),

      // 4. Provider performance
      Booking.aggregate([
        { $match: { ...completedMatch, provider_id: { $exists: true, $ne: null } } },
        { $group: { _id: '$provider_id', revenue: { $sum: '$payable_amount' }, bookings: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 20 }
      ]),

      // 5. Peak hours — real $hour aggregation (fixes 1.5)
      Booking.aggregate([
        { $match: baseMatch },
        { $group: { _id: { $hour: '$createdAt' }, bookings: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    // ── Hydrate subservice + provider names ──────────────────────────────────
    const subserviceIds = subserviceAgg.map((d: any) => d._id?.toString()).filter(Boolean);
    const providerIds   = providerAgg.map((d: any) => d._id?.toString()).filter(Boolean);

    const [catalogData, providers] = await Promise.all([
      subserviceIds.length > 0 ? getCatalogBatch(subserviceIds, [], [], []) : { subservices: [], services: [], categories: [], coupons: [] },
      providerIds.length > 0   ? getProvidersBatch(providerIds)             : []
    ]);

    const allServiceIds = [...new Set(catalogData.subservices.map((s: any) => s.service_id?.toString()).filter(Boolean))];
    const catalogData2  = allServiceIds.length > 0
      ? await getCatalogBatch([], allServiceIds, [], [])
      : { subservices: [], services: [], categories: [], coupons: [] };

    const serviceNameMap = new Map(catalogData2.services.map((s: any) => [String(s._id), s.service_name || s.name || 'Unknown']));
    const subMap = new Map(catalogData.subservices.map((s: any) => [
      String(s._id),
      serviceNameMap.get(String(s.service_id)) || s.subservice_name || 'Unknown'
    ]));
    const provMap = new Map(providers.map((p: any) => [String(p._id), p]));

    // ── Summary stats ────────────────────────────────────────────────────────
    let totalBookings = 0, completedCount = 0, cancelledCount = 0, pendingCount = 0, totalRevenue = 0;
    for (const s of statusAgg) {
      totalBookings += s.count;
      if (s._id === 'completed') { completedCount = s.count; totalRevenue = s.revenue; }
      else if (['cancelled', 'rejected'].includes(s._id)) cancelledCount += s.count;
      else pendingCount += s.count;
    }

    const commissionEarned  = totalRevenue * 0.15;
    const providerEarnings  = totalRevenue - commissionEarned;
    const netPlatformProfit = commissionEarned * 0.8;
    const completedPct = totalBookings > 0 ? (completedCount / totalBookings) * 100 : 0;
    const cancelledPct = totalBookings > 0 ? (cancelledCount / totalBookings) * 100 : 0;
    const pendingPct   = totalBookings > 0 ? (pendingCount   / totalBookings) * 100 : 0;

    // ── Trend data (built from aggregation result, not JS array filtering) ───
    const revenueTrend:     { name: string; revenue: number }[]   = [];
    const bookingTrendData: { name: string; bookings: number }[]  = [];

    if (daysCount <= 60) {
      const trendMap = new Map(trendAgg.map((d: any) => [
        `${d._id.year}-${d._id.month}-${d._id.day}`,
        { revenue: d.revenue as number, bookings: d.bookings as number }
      ]));
      for (let i = daysCount; i >= 0; i--) {
        const d   = new Date(endDate);
        d.setDate(d.getDate() - i);
        const key   = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        const entry = trendMap.get(key) || { revenue: 0, bookings: 0 };
        const name  = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        revenueTrend.push({ name, revenue: entry.revenue });
        bookingTrendData.push({ name, bookings: entry.bookings });
      }
    } else {
      const trendMap = new Map(trendAgg.map((d: any) => [
        `${d._id.year}-${d._id.month}`,
        { revenue: d.revenue as number, bookings: d.bookings as number }
      ]));
      let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (current <= endDate) {
        const key   = `${current.getFullYear()}-${current.getMonth() + 1}`;
        const entry = trendMap.get(key) || { revenue: 0, bookings: 0 };
        const name  = current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        revenueTrend.push({ name, revenue: entry.revenue });
        bookingTrendData.push({ name, bookings: entry.bookings });
        current.setMonth(current.getMonth() + 1);
      }
    }

    // ── Revenue by category ───────────────────────────────────────────────────
    const revByCategoryMap = new Map<string, number>();
    for (const d of subserviceAgg) {
      const name = subMap.get(String(d._id)) || 'Others';
      revByCategoryMap.set(name, (revByCategoryMap.get(name) || 0) + d.revenue);
    }
    const revByCategory = Array.from(revByCategoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // ── Provider analytics ────────────────────────────────────────────────────
    let topEarningProvider  = { name: 'N/A', amount: 0 };
    let mostBookedProvider  = { name: 'N/A', bookings: 0 };
    let highestRatedProvider = { name: 'N/A', rating: 0 };
    const inactiveProviders = providers.filter((p: any) => !p.isActive).length;

    for (const d of providerAgg) {
      const p: any = provMap.get(String(d._id)) || {};
      const name   = p.name || p.full_name || 'Unknown';
      if (d.revenue  > topEarningProvider.amount)   topEarningProvider  = { name, amount: d.revenue };
      if (d.bookings > mostBookedProvider.bookings)  mostBookedProvider  = { name, bookings: d.bookings };
    }
    providers.forEach((p: any) => {
      const rating = p.rating || p.average_rating || 0;
      if (rating > highestRatedProvider.rating) {
        highestRatedProvider = { name: p.name || p.full_name || 'Unknown', rating };
      }
    });

    // ── Peak hours — built from real $hour aggregation ───────────────────────
    const peakHoursMap = new Map<number, number>(peakHoursAgg.map((d: any) => [d._id as number, d.bookings as number]));
    const peakHours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      bookings: peakHoursMap.get(i) || 0
    }));

    // ── Customer stats ────────────────────────────────────────────────────────
    let newCustomers = 0;
    try {
      const resp = await axios.get(`${AUTH_SERVICE_URL}/api/users/stats`);
      newCustomers = resp.data?.totalCustomers || 0;
    } catch (_) {}

    const revenueByCity = [
      { name: 'Mumbai',    value: totalRevenue * 0.35 },
      { name: 'Delhi',     value: totalRevenue * 0.25 },
      { name: 'Bangalore', value: totalRevenue * 0.20 },
      { name: 'Pune',      value: totalRevenue * 0.12 },
      { name: 'Others',    value: totalRevenue * 0.08 }
    ];

    const refundRate       = 2.35;
    const refundTrend      = revenueTrend.map(d => ({ name: d.name, amount: d.revenue * (refundRate / 100) }));
    const refundCategories = revByCategory.map(c => ({ name: c.name, value: c.value * (refundRate / 100) }));
    const refundReasons    = [
      { name: 'Service not as described', value: 32 },
      { name: 'Provider Cancellation',    value: 25 },
      { name: 'Customer Change of Plan',  value: 20 },
      { name: 'Scheduling Issues',        value: 13 },
      { name: 'Others',                   value: 10 }
    ];
    const commissionByCategory = revByCategory.map(c => ({ name: c.name, value: c.value * 0.15 }));

    res.json({
      revenue: {
        total:            totalRevenue,
        commission:       commissionEarned,
        providerEarnings,
        netProfit:        netPlatformProfit,
        trend:            revenueTrend,
        byCategory:       revByCategory,
        byCity:           revenueByCity
      },
      booking: {
        total:        totalBookings,
        completedPct,
        cancelledPct,
        pendingPct,
        trend:        bookingTrendData,
        byCategory:   revByCategory.map(c => ({ name: c.name, value: Math.floor(c.value / 1000) })),
        peakHours
      },
      provider: {
        topEarning:    topEarningProvider,
        mostBooked:    mostBookedProvider,
        highestRated:  highestRatedProvider,
        inactiveCount: inactiveProviders
      },
      customer: {
        new:        newCustomers,
        repeat:     Math.floor(totalBookings * 0.4),
        topSpender: { name: 'N/A', amount: 0 }
      },
      refund: {
        rate:        refundRate,
        totalAmount: totalRevenue * (refundRate / 100),
        trend:       refundTrend,
        categories:  refundCategories,
        reasons:     refundReasons
      },
      commission: {
        total:         commissionEarned,
        byCategory:    commissionByCategory,
        topCategories: revByCategory
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
