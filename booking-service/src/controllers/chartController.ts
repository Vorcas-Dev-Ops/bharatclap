import { Request, Response } from 'express';
import { Booking } from '../models/Booking';
import mongoose, { Schema } from 'mongoose';

/* ─── Shared lazy cross-DB connections ─────────────────────────────────────── */
let providerConnection: mongoose.Connection | null = null;
let catalogConnection: mongoose.Connection | null = null;
let ProviderModel: any = null;
let SubServiceModel: any = null;
let ServiceModel: any = null;

const getProviderDb = () => {
  if (!providerConnection)
    providerConnection = mongoose.createConnection(process.env.PROVIDER_DB_URI || 'mongodb://localhost:27017/provider_db');
  return providerConnection;
};
const getCatalogDb = () => {
  if (!catalogConnection)
    catalogConnection = mongoose.createConnection(process.env.CATALOG_DB_URI || 'mongodb://localhost:27017/catalog_db');
  return catalogConnection;
};
const getProviderModel = () => {
  if (!ProviderModel) ProviderModel = getProviderDb().model('Provider', new Schema({}, { strict: false }), 'providers');
  return ProviderModel;
};
const getSubServiceModel = () => {
  if (!SubServiceModel) SubServiceModel = getCatalogDb().model('SubService', new Schema({}, { strict: false }), 'subservices');
  return SubServiceModel;
};
const getServiceModel = () => {
  if (!ServiceModel) ServiceModel = getCatalogDb().model('Service', new Schema({}, { strict: false }), 'services');
  return ServiceModel;
};

/* ─────────────────────────────────────────────────────────────────────────────
   1. REVENUE CHART  – monthly revenue for last 12 months (current vs previous year)
──────────────────────────────────────────────────────────────────────────── */
export const getRevenueChart = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
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
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$payable_amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Build maps keyed by "year-month"
    const revenueMap = new Map<string, number>();
    aggregate.forEach(d => revenueMap.set(`${d._id.year}-${d._id.month}`, d.revenue));

    const currentData = MONTHS.map((_, i) => Math.round((revenueMap.get(`${currentYear}-${i + 1}`) || 0) / 1000));
    const previousData = MONTHS.map((_, i) => Math.round((revenueMap.get(`${previousYear}-${i + 1}`) || 0) / 1000));

    // Total current year revenue
    const totalRevenue = currentData.reduce((a, b) => a + b, 0);
    const totalPrev = previousData.reduce((a, b) => a + b, 0);
    const growthPct = totalPrev > 0 ? (((totalRevenue - totalPrev) / totalPrev) * 100).toFixed(1) : '0.0';

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
    // Start of current week (Monday)
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon
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
            week: {
              $cond: [{ $gte: ['$createdAt', currentWeekStart] }, 'current', 'previous']
            },
            dayOfWeek: { $dayOfWeek: '$createdAt' } // 1=Sun … 7=Sat
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // dayOfWeek: 1=Sun,2=Mon,...,7=Sat → remap to Mon=0..Sun=6
    const remapDay = (d: number) => (d === 1 ? 6 : d - 2); // Sun(1)->6, Mon(2)->0, ...
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const currentWeek = Array(7).fill(0);
    const previousWeek = Array(7).fill(0);

    aggregate.forEach(d => {
      const idx = remapDay(d._id.dayOfWeek);
      if (idx < 0 || idx > 6) return;
      if (d._id.week === 'current') currentWeek[idx] = d.count;
      else previousWeek[idx] = d.count;
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
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    let completed = 0, pending = 0, cancelled = 0, total = 0;
    aggregate.forEach(d => {
      total += d.count;
      if (d._id === 'completed') completed += d.count;
      else if (['cancelled', 'rejected', 'refund_processing'].includes(d._id)) cancelled += d.count;
      else pending += d.count; // pending, accepted, provider_searching, on_the_way, arrived, in_progress
    });

    const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

    res.json({
      total,
      data: [
        { name: 'Completed', value: pct(completed), color: '#2563EB' },
        { name: 'Pending', value: pct(pending), color: '#60A5FA' },
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
    const SubSModel = getSubServiceModel();
    const SModel = getServiceModel();

    const aggregate = await Booking.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$subservice_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const subserviceIds = aggregate.map(d => d._id).filter(Boolean);
    const subservices = await SubSModel.find({ _id: { $in: subserviceIds } }).lean();
    const serviceIds = subservices.map((s: any) => s.service_id).filter(Boolean);
    const services = await SModel.find({ _id: { $in: serviceIds } }).lean();
    const serviceMap = new Map<string, string>(services.map((s: any) => [String(s._id), String(s.service_name || s.name || 'Unknown')]));
    const subMap = new Map<string, string>(subservices.map((s: any) => [String(s._id), String(serviceMap.get(String(s.service_id)) || s.subservice_name || 'Unknown')]));

    const COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'];

    // Group by service name
    const serviceCountMap = new Map<string, number>();
    let grandTotal = 0;
    aggregate.forEach(d => {
      const name: string = subMap.get(String(d._id)) || 'Others';
      serviceCountMap.set(name, (serviceCountMap.get(name) || 0) + d.count);
      grandTotal += d.count;
    });

    // Top 4 + Others
    const sorted = [...serviceCountMap.entries()].sort((a, b) => b[1] - a[1]);
    const top4 = sorted.slice(0, 4);
    const othersCount = sorted.slice(4).reduce((acc, [, c]) => acc + c, 0);
    if (othersCount > 0) top4.push(['Others', othersCount]);

    const result = top4.map(([name, count], i) => ({
      name,
      value: grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0,
      color: COLORS[i] || COLORS[COLORS.length - 1]
    }));

    // Normalise to 100%
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
    const PModel = getProviderModel();

    const aggregate = await Booking.aggregate([
      { $match: { isDeleted: false, status: 'completed', provider_id: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$provider_id',
          jobs: { $sum: 1 }
        }
      },
      { $sort: { jobs: -1 } },
      { $limit: 5 }
    ]);

    const providerIds = aggregate.map(d => d._id).filter(Boolean);
    const providers = await PModel.find({ _id: { $in: providerIds } }).select('name full_name average_rating rating').lean();
    const provMap = new Map(providers.map((p: any) => [String(p._id), p]));

    const result = aggregate.map(d => {
      const p: any = provMap.get(String(d._id)) || {};
      return {
        name: p.name || p.full_name || 'Unknown Provider',
        jobs: d.jobs,
        rating: parseFloat((p.average_rating || p.rating || 4.5).toFixed(1))
      };
    });

    res.json({ providers: result });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
