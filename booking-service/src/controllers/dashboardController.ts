import { Request, Response } from 'express';
import { Booking } from '../models/Booking';
import mongoose, { Schema } from 'mongoose';

// Lazy connections for joins
let authConnection: mongoose.Connection | null = null;
let providerConnection: mongoose.Connection | null = null;
let catalogConnection: mongoose.Connection | null = null;

let UserModel: any = null;
let ProviderModel: any = null;
let SubServiceModel: any = null;
let ServiceModel: any = null;

const getAuthDb = () => {
  if (!authConnection) {
    authConnection = mongoose.createConnection(process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db');
  }
  return authConnection;
};

const getProviderDb = () => {
  if (!providerConnection) {
    providerConnection = mongoose.createConnection(process.env.PROVIDER_DB_URI || 'mongodb://localhost:27017/provider_db');
  }
  return providerConnection;
};

const getCatalogDb = () => {
  if (!catalogConnection) {
    catalogConnection = mongoose.createConnection(process.env.CATALOG_DB_URI || 'mongodb://localhost:27017/catalog_db');
  }
  return catalogConnection;
};

const getUserModel = () => {
  if (!UserModel) UserModel = getAuthDb().model('User', new Schema({}, { strict: false }), 'users');
  return UserModel;
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

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const UModel = getUserModel();
    const PModel = getProviderModel();
    const SubSModel = getSubServiceModel();
    const SModel = getServiceModel();

    // Stats
    const totalUsers = await UModel.countDocuments({ role: 'customer' });
    const totalProviders = await PModel.countDocuments({ isDeleted: false });
    const totalBookings = await Booking.countDocuments({ isDeleted: false });
    
    const revenueAggr = await Booking.aggregate([
      { $match: { status: 'completed', isDeleted: false } },
      { $group: { _id: null, totalRevenue: { $sum: "$payable_amount" } } }
    ]);
    const revenue = revenueAggr.length > 0 ? revenueAggr[0].totalRevenue : 0;

    const pendingApprovals = await PModel.countDocuments({ kyc_status: 'pending', isDeleted: false });
    const cancelledOrders = await Booking.countDocuments({ status: 'cancelled', isDeleted: false });

    // Recent Bookings (top 10)
    const recentBookingsRaw = await Booking.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(10).lean();
    
    const userIds = recentBookingsRaw.map(b => b.user_id).filter(Boolean);
    const subserviceIds = recentBookingsRaw.map(b => b.subservice_id).filter(Boolean);

    const [users, subservices] = await Promise.all([
      UModel.find({ _id: { $in: userIds } }).select('name profile_image').lean(),
      SubSModel.find({ _id: { $in: subserviceIds } }).lean()
    ]);

    const userMap = new Map(users.map((u: any) => [String(u._id), u]));
    
    const serviceIds = subservices.map((s: any) => s.service_id).filter(Boolean);
    const services = await SModel.find({ _id: { $in: serviceIds } }).lean();
    const serviceMap = new Map(services.map((s: any) => [String(s._id), s]));

    const subserviceMap = new Map(subservices.map((s: any) => [
      String(s._id), 
      { ...s, service_id: serviceMap.get(String(s.service_id)) }
    ]));

    const recentBookings = recentBookingsRaw.map(b => {
      const user: any = userMap.get(String(b.user_id));
      const subservice: any = subserviceMap.get(String(b.subservice_id));
      
      return {
        id: b.booking_id,
        _id: b._id,
        client: user ? user.name : 'Unknown User',
        service: subservice?.service_id?.service_name || subservice?.subservice_name || 'Service',
        status: b.status.charAt(0).toUpperCase() + b.status.slice(1).replace(/_/g, ' '),
        price: b.payable_amount,
        color: ['completed'].includes(b.status) ? 'green' : ['cancelled', 'rejected'].includes(b.status) ? 'red' : 'blue',
      };
    });

    res.json({
      stats: [
        { title: 'Total Users', value: totalUsers.toLocaleString() },
        { title: 'Service Providers', value: totalProviders.toLocaleString() },
        { title: 'Total Bookings', value: totalBookings.toLocaleString() },
        { title: 'Revenue', value: `₹${(revenue/100000).toFixed(2)}L` },
        { title: 'Pending Approvals', value: pendingApprovals.toLocaleString() },
        { title: 'Cancelled Orders', value: cancelledOrders.toLocaleString() },
      ],
      recentBookings
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
