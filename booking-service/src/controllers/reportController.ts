import { Request, Response } from 'express';
import { Booking } from '../models/Booking';
import mongoose, { Schema } from 'mongoose';

let providerConnection: mongoose.Connection | null = null;
let catalogConnection: mongoose.Connection | null = null;
let authConnection: mongoose.Connection | null = null;

let ProviderModel: any = null;
let SubServiceModel: any = null;
let ServiceModel: any = null;
let UserModel: any = null;

const getProviderDb = () => {
  if (!providerConnection) providerConnection = mongoose.createConnection(process.env.PROVIDER_DB_URI || 'mongodb://localhost:27017/provider_db');
  return providerConnection;
};
const getCatalogDb = () => {
  if (!catalogConnection) catalogConnection = mongoose.createConnection(process.env.CATALOG_DB_URI || 'mongodb://localhost:27017/catalog_db');
  return catalogConnection;
};
const getAuthDb = () => {
  if (!authConnection) authConnection = mongoose.createConnection(process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db');
  return authConnection;
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
const getUserModel = () => {
  if (!UserModel) UserModel = getAuthDb().model('User', new Schema({ role: String, createdAt: Date }, { strict: false }), 'users');
  return UserModel;
};

export const getReportsData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateRange, startDate: customStart, endDate: customEnd, vertical, location, provider } = req.query;

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
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (dateRange === 'Custom' && customStart && customEnd) {
      startDate = new Date(customStart as string);
      endDate = new Date(customEnd as string);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate.setDate(now.getDate() - 30); // Default
    }

    const allBookingsRaw = await Booking.find({ isDeleted: false }).lean();
    
    const PModel = getProviderModel();
    const UModel = getUserModel();
    const SubSModel = getSubServiceModel();
    const SModel = getServiceModel();

    const [providers, users, subservices, services] = await Promise.all([
      PModel.find({}).lean(),
      UModel.find({}).lean(),
      SubSModel.find({}).lean(),
      SModel.find({}).lean()
    ]);

    const serviceMap = new Map(services.map((s: any) => [String(s._id), s.service_name || s.name || 'Unknown']));
    const subMap = new Map(subservices.map((s: any) => [String(s._id), serviceMap.get(String(s.service_id)) || s.subservice_name || 'Unknown']));
    const provMap = new Map(providers.map((p: any) => [String(p._id), p]));

    // Filter bookings based on query params
    let filteredBookings = allBookingsRaw.filter(b => b.createdAt >= startDate && b.createdAt <= endDate);

    if (vertical && vertical !== 'All Services') {
      filteredBookings = filteredBookings.filter(b => {
        const sName = subMap.get(String(b.subservice_id));
        return sName === vertical;
      });
    }

    if (provider && provider === 'Verified Only') {
      filteredBookings = filteredBookings.filter(b => {
        const p: any = provMap.get(String(b.provider_id));
        return p && p.isVerified === true;
      });
    }

    /* =========================================
       1. REVENUE ANALYTICS
    ========================================= */
    const completedBookings = filteredBookings.filter(b => b.status === 'completed');
    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.payable_amount || 0), 0);
    const commissionEarned = totalRevenue * 0.15; // 15% commission mock
    const providerEarnings = totalRevenue - commissionEarned;
    const netPlatformProfit = commissionEarned * 0.8; // mock 20% operational cost

    // Revenue Trend (Daily or Monthly based on days count)
    const daysCount = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const revenueTrend = [];
    const bookingTrendData = [];
    
    if (daysCount <= 60) {
      for (let i = daysCount; i >= 0; i--) {
        const d = new Date(endDate);
        d.setDate(d.getDate() - i);
        const dayStart = new Date(d.setHours(0,0,0,0));
        const dayEnd = new Date(d.setHours(23,59,59,999));
        
        const dayBookings = filteredBookings.filter(b => b.createdAt >= dayStart && b.createdAt <= dayEnd);
        const dayRev = dayBookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.payable_amount || 0), 0);
        
        const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        revenueTrend.push({ name, revenue: dayRev });
        bookingTrendData.push({ name, bookings: dayBookings.length });
      }
    } else {
      let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (currentMonth <= endDate) {
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthBookings = filteredBookings.filter(b => b.createdAt >= currentMonth && b.createdAt <= monthEnd);
        const monthRev = monthBookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.payable_amount || 0), 0);

        const name = currentMonth.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        revenueTrend.push({ name, revenue: monthRev });
        bookingTrendData.push({ name, bookings: monthBookings.length });
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }
    }

    // Revenue by Category
    const revByCategoryMap = new Map();
    completedBookings.forEach(b => {
      const name = subMap.get(String(b.subservice_id)) || 'Others';
      revByCategoryMap.set(name, (revByCategoryMap.get(name) || 0) + (b.payable_amount || 0));
    });
    const revByCategory = Array.from(revByCategoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 5);

    // Revenue by City (Mock data)
    const revenueByCity = [
      { name: 'Mumbai', value: totalRevenue * 0.35 },
      { name: 'Delhi', value: totalRevenue * 0.25 },
      { name: 'Bangalore', value: totalRevenue * 0.20 },
      { name: 'Pune', value: totalRevenue * 0.12 },
      { name: 'Others', value: totalRevenue * 0.08 }
    ];

    /* =========================================
       2. BOOKING ANALYTICS
    ========================================= */
    const totalBookings = filteredBookings.length;
    const cancelledBookings = filteredBookings.filter(b => ['cancelled', 'rejected'].includes(b.status)).length;
    const pendingBookings = filteredBookings.filter(b => ['pending', 'accepted', 'provider_searching'].includes(b.status)).length;
    
    const completedPct = totalBookings > 0 ? (completedBookings.length / totalBookings) * 100 : 0;
    const cancelledPct = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
    const pendingPct = totalBookings > 0 ? (pendingBookings / totalBookings) * 100 : 0;

    // Peak Booking Hours (Mock 24 hours distribution)
    const peakHours = Array.from({ length: 24 }).map((_, i) => ({
      hour: `${i}:00`,
      bookings: Math.floor(Math.random() * 50) + (i > 9 && i < 18 ? 100 : 10) // peak between 10am-6pm
    }));

    /* =========================================
       3. PROVIDER ANALYTICS
    ========================================= */
    const provStats = new Map();
    completedBookings.forEach(b => {
      const pId = String(b.provider_id);
      if (!provStats.has(pId)) provStats.set(pId, { bookings: 0, revenue: 0 });
      const stats = provStats.get(pId);
      stats.bookings += 1;
      stats.revenue += (b.payable_amount || 0);
    });

    let topEarningProvider = { name: 'N/A', amount: 0 };
    let mostBookedProvider = { name: 'N/A', bookings: 0 };
    
    Array.from(provStats.entries()).forEach(([pId, stats]) => {
      const p: any = provMap.get(pId);
      const name = p ? (p.name || p.full_name) : 'Unknown';
      if (stats.revenue > topEarningProvider.amount) topEarningProvider = { name, amount: stats.revenue };
      if (stats.bookings > mostBookedProvider.bookings) mostBookedProvider = { name, bookings: stats.bookings };
    });

    const inactiveProviders = providers.filter((p: any) => !p.isActive).length;

    // Avg Rating from Providers who completed bookings
    let highestRatedProvider = { name: 'N/A', rating: 0 };
    providers.forEach((p: any) => {
      const rating = p.rating || p.average_rating || 0;
      if (rating > highestRatedProvider.rating) {
        highestRatedProvider = { name: p.name || p.full_name || 'Unknown', rating };
      }
    });

    /* =========================================
       4. CUSTOMER ANALYTICS
    ========================================= */
    const usersInPeriod = users.filter((u: any) => u.role === 'customer' && u.createdAt >= startDate && u.createdAt <= endDate);
    const newCustomers = usersInPeriod.length;
    const repeatCustomers = Math.floor(totalBookings * 0.4); // Mock 40% repeat
    const topSpendingCustomer = { name: 'Rahul Verma', amount: 15400 }; // Mock

    /* =========================================
       5. REFUND ANALYTICS
    ========================================= */
    const refundRate = 2.35; // Mock %
    const refundTrend = revenueTrend.map(d => ({ name: d.name, amount: d.revenue * (refundRate/100) }));
    const refundCategories = revByCategory.map(c => ({ name: c.name, value: c.value * (refundRate/100) }));
    const refundReasons = [
      { name: 'Service not as described', value: 32 },
      { name: 'Provider Cancellation', value: 25 },
      { name: 'Customer Change of Plan', value: 20 },
      { name: 'Scheduling Issues', value: 13 },
      { name: 'Others', value: 10 }
    ];

    /* =========================================
       6. COMMISSION ANALYTICS
    ========================================= */
    const commissionByCategory = revByCategory.map(c => ({ name: c.name, value: c.value * 0.15 }));
    const topRevenueCategories = [...revByCategory];

    res.json({
      revenue: {
        total: totalRevenue,
        commission: commissionEarned,
        providerEarnings: providerEarnings,
        netProfit: netPlatformProfit,
        trend: revenueTrend,
        byCategory: revByCategory,
        byCity: revenueByCity
      },
      booking: {
        total: totalBookings,
        completedPct: completedPct,
        cancelledPct: cancelledPct,
        pendingPct: pendingPct,
        trend: bookingTrendData,
        byCategory: revByCategory.map(c => ({ name: c.name, value: Math.floor(c.value / 1000) })), // approximate counts
        peakHours: peakHours
      },
      provider: {
        topEarning: topEarningProvider,
        mostBooked: mostBookedProvider,
        highestRated: highestRatedProvider,
        inactiveCount: inactiveProviders
      },
      customer: {
        new: newCustomers,
        repeat: repeatCustomers,
        topSpender: topSpendingCustomer
      },
      refund: {
        rate: refundRate,
        totalAmount: totalRevenue * (refundRate/100),
        trend: refundTrend,
        categories: refundCategories,
        reasons: refundReasons
      },
      commission: {
        total: commissionEarned,
        byCategory: commissionByCategory,
        topCategories: topRevenueCategories
      }
    });

  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
