import { Request, Response } from 'express';
import { Booking } from '../models/Booking';
import { getProvidersBatch, getCatalogBatch } from '../utils/internalApi';

/* ─────────────────────────────────────────────────────────────────────────────
   1. REVENUE CHART  – monthly revenue for last 12 months (current vs previous year)
──────────────────────────────────────────────────────────────────────────── */
export const getRevenueChart = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const currentYear  = now.getFullYear();
    const previousYear = currentYear - 1;

    const aggregate = await Booking.aggregate([
      {
        $match: {
          isDeleted: false,
          status: 'completed',
          createdAt: {
            $gte: new Date(`${previousYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`)
          }
        }
      },
      {
        $group: {
          _id:     { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$payable_amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const revenueMap = new Map<string, number>();
    aggregate.forEach(d => revenueMap.set(`${d._id.year}-${d._id.month}`, d.revenue));

    const currentData  = MONTHS.map((_, i) => Math.round((revenueMap.get(`${currentYear}-${i + 1}`)  || 0) / 1000));
    const previousData = MONTHS.map((_, i) => Math.round((revenueMap.get(`${previousYear}-${i + 1}`) || 0) / 1000));

    const totalRevenue = currentData.reduce((a, b) => a + b, 0);
    const totalPrev    = previousData.reduce((a, b) => a + b, 0);
    const growthPct    = totalPrev > 0 ? (((totalRevenue - totalPrev) / totalPrev) * 100).toFixed(1) : '0.0';

    res.json({ months: MONTHS, currentData, previousData, totalRevenue, growthPct });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   2. BOOKING CHART  – daily bookings for current week vs previous week
──────────────────────────────────────────────────────────────────────────── */
export const getBookingChart = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - dayOfWeek);
    currentWeekStart.setHours(0, 0, 0, 0);

    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);

    const aggregate = await Booking.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: { $gte: previousWeekStart, $lte: now }
        }
      },
      {
        $group: {
          _id: {
            week:      { $cond: [{ $gte: ['$createdAt', currentWeekStart] }, 'current', 'previous'] },
            dayOfWeek: { $dayOfWeek: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const remapDay = (d: number) => (d === 1 ? 6 : d - 2);
    const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const currentWeek  = Array(7).fill(0);
    const previousWeek = Array(7).fill(0);

    aggregate.forEach(d => {
      const idx = remapDay(d._id.dayOfWeek);
      if (idx < 0 || idx > 6) return;
      if (d._id.week === 'current') currentWeek[idx]  = d.count;
      else                          previousWeek[idx] = d.count;
    });

    res.json({ days: DAYS, currentWeek, previousWeek });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   3. ORDER STATUS (Donut)  – completed / pending / cancelled percentages
──────────────────────────────────────────────────────────────────────────── */
export const getOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const aggregate = await Booking.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    let completed = 0, pending = 0, cancelled = 0, total = 0;
    aggregate.forEach(d => {
      total += d.count;
      if (d._id === 'completed') completed += d.count;
      else if (['cancelled', 'rejected', 'refund_processing'].includes(d._id)) cancelled += d.count;
      else pending += d.count;
    });

    const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

    res.json({
      total,
      data: [
        { name: 'Completed', value: pct(completed), color: '#2563EB' },
        { name: 'Pending',   value: pct(pending),   color: '#60A5FA' },
        { name: 'Cancelled', value: pct(cancelled), color: '#F87171' }
      ]
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   4. SERVICE DISTRIBUTION (Pie)  – top 5 services by booking count
──────────────────────────────────────────────────────────────────────────── */
export const getServiceDistribution = async (req: Request, res: Response): Promise<void> => {
  try {
    const aggregate = await Booking.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$subservice_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const subserviceIds = aggregate.map(d => d._id?.toString()).filter(Boolean);
    
    if (subserviceIds.length === 0) {
      res.json({ services: [] });
      return;
    }

    // Fetch subservice + service names via catalog batch API
    const catalogData  = await getCatalogBatch(subserviceIds, [], [], []);
    const serviceIds   = [...new Set(catalogData.subservices.map((s: any) => s.service_id?.toString()).filter(Boolean))];
    const catalogData2 = serviceIds.length > 0 ? await getCatalogBatch([], serviceIds, [], []) : { subservices: [], services: [], categories: [], coupons: [] };

    const serviceMap    = new Map(catalogData2.services.map((s: any) => [String(s._id), s.service_name || s.name || 'Unknown']));
    const subserviceMap = new Map(catalogData.subservices.map((s: any) => [
      String(s._id),
      String(serviceMap.get(String(s.service_id)) || s.subservice_name || 'Unknown')
    ]));

    const COLORS = ['#2563EB','#3B82F6','#60A5FA','#93C5FD','#BFDBFE','#DBEAFE'];
    const serviceCountMap = new Map<string, number>();
    let grandTotal = 0;

    aggregate.forEach(d => {
      const name = subserviceMap.get(String(d._id)) || 'Others';
      serviceCountMap.set(name, (serviceCountMap.get(name) || 0) + d.count);
      grandTotal += d.count;
    });

    const sorted     = [...serviceCountMap.entries()].sort((a, b) => b[1] - a[1]);
    const top4       = sorted.slice(0, 4);
    const othersCount = sorted.slice(4).reduce((acc, [, c]) => acc + c, 0);
    if (othersCount > 0) top4.push(['Others', othersCount]);

    const result = top4.map(([name, count], i) => ({
      name,
      value: grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0,
      color: COLORS[i] || COLORS[COLORS.length - 1]
    }));

    const sum = result.reduce((a, b) => a + b.value, 0);
    if (result.length > 0 && sum !== 100) result[0].value += (100 - sum);

    res.json({ services: result });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   5. PROVIDER PERFORMANCE  – top 5 providers by completed jobs + avg rating
──────────────────────────────────────────────────────────────────────────── */
export const getProviderPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const aggregate = await Booking.aggregate([
      { $match: { isDeleted: false, status: 'completed', provider_id: { $exists: true, $ne: null } } },
      { $group: { _id: '$provider_id', jobs: { $sum: 1 } } },
      { $sort: { jobs: -1 } },
      { $limit: 5 }
    ]);

    const providerIds = aggregate.map(d => d._id?.toString()).filter(Boolean);

    // Fetch provider details via provider-service batch API
    const providers = providerIds.length > 0 ? await getProvidersBatch(providerIds) : [];
    const provMap   = new Map(providers.map((p: any) => [String(p._id), p]));

    const result = aggregate.map(d => {
      const p: any = provMap.get(String(d._id)) || {};
      return {
        name:   p.name || p.full_name || 'Unknown Provider',
        jobs:   d.jobs,
        rating: parseFloat((p.average_rating || p.rating || 4.5).toFixed(1))
      };
    });

    res.json({ providers: result });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
