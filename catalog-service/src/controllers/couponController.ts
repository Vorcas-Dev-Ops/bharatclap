import { Request, Response } from 'express';
import { Coupon } from '../models/Coupon';
import mongoose, { Schema } from 'mongoose';

// Lazy loading connections for cross-db joins
let paymentConnection: mongoose.Connection | null = null;
let CouponUsageModel: any = null;

let authConnection: mongoose.Connection | null = null;
let UserModel: any = null;

let bookingConnection: mongoose.Connection | null = null;
let BookingModel: any = null;

const getPaymentConnection = () => {
  if (!paymentConnection) {
    const paymentDbURI = process.env.PAYMENT_DB_URI || 'mongodb://localhost:27017/payment_db';
    paymentConnection = mongoose.createConnection(paymentDbURI);
  }
  return paymentConnection;
};

const getCouponUsageModel = () => {
  if (!CouponUsageModel) {
    CouponUsageModel = getPaymentConnection().model('CouponUsage', new Schema({}, { strict: false }), 'couponusages');
  }
  return CouponUsageModel;
};

const getAuthConnection = () => {
  if (!authConnection) {
    const authDbURI = process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db';
    authConnection = mongoose.createConnection(authDbURI);
  }
  return authConnection;
};

const getUserModel = () => {
  if (!UserModel) {
    UserModel = getAuthConnection().model('User', new Schema({}, { strict: false }), 'users');
  }
  return UserModel;
};

const getBookingConnection = () => {
  if (!bookingConnection) {
    const bookingDbURI = process.env.BOOKING_DB_URI || 'mongodb://localhost:27017/booking_db';
    bookingConnection = mongoose.createConnection(bookingDbURI);
  }
  return bookingConnection;
};

const getBookingModel = () => {
  if (!BookingModel) {
    BookingModel = getBookingConnection().model('Booking', new Schema({}, { strict: false }), 'bookings');
  }
  return BookingModel;
};

// @desc    Create coupon
// @route   POST /api/coupons
// @access  Private/Admin
export const createCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const coupon = new Coupon(req.body);
    await coupon.save();
    res.status(201).json({ message: 'Coupon created successfully', coupon });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all coupons
// @route   GET /api/coupons
// @access  Public
export const getAllCoupons = async (req: Request, res: Response): Promise<void> => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.status(200).json(coupons);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update coupon
// @route   PUT /api/coupons/:id
// @access  Private/Admin
export const updateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndUpdate(id, req.body, { new: true });
    if (!coupon) {
      res.status(404).json({ message: 'Coupon not found' });
      return;
    }
    res.status(200).json({ message: 'Coupon updated successfully', coupon });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete coupon
// @route   DELETE /api/coupons/:id
// @access  Private/Admin
export const deleteCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await Coupon.findByIdAndDelete(id);

    // Dynamic deletion on the payment db for coupon usages
    const CUsage = getCouponUsageModel();
    await CUsage.deleteMany({ couponId: new mongoose.Types.ObjectId(id) });

    res.status(200).json({ message: 'Coupon deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get coupon statistics
// @route   GET /api/coupons/stats
// @access  Private/Admin
export const getCouponStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalCoupons = await Coupon.countDocuments();
    const activeOffers = await Coupon.countDocuments({ status: 'active' });
    
    const CUsage = getCouponUsageModel();
    const totalRedemptions = await CUsage.countDocuments();
    
    const usageData = await CUsage.aggregate([
      { $group: { _id: null, totalDiscount: { $sum: '$discountApplied' } } }
    ]);
    const totalDiscountGiven = usageData.length > 0 ? usageData[0].totalDiscount : 0;

    res.status(200).json({
      totalCoupons,
      activeOffers,
      totalRedemptions,
      totalDiscountGiven
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get coupon analytics
// @route   GET /api/coupons/:id/analytics
// @access  Private/Admin
export const getCouponAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const couponId = new mongoose.Types.ObjectId(id);

    const CUsage = getCouponUsageModel();
    const rawRedemptions = await CUsage.find({ couponId }).sort({ usedAt: -1 }).lean();

    // Map/batch queries to avoid populated issues across physical servers
    const userIds = rawRedemptions.map((r: any) => r.userId).filter(Boolean);
    const bookingIds = rawRedemptions.map((r: any) => r.bookingId).filter(Boolean);

    const UModel = getUserModel();
    const users = await UModel.find({ _id: { $in: userIds } }).select('name email profile_image').lean();
    const userMap = new Map(users.map((u: any) => [String(u._id), u]));

    const BModel = getBookingModel();
    const bookings = await BModel.find({ _id: { $in: bookingIds } }).select('booking_id total_amount status').lean();
    const bookingMap = new Map(bookings.map((b: any) => [String(b._id), b]));

    const redemptions = rawRedemptions.map((r: any) => ({
      ...r,
      userId: userMap.get(String(r.userId)) || r.userId,
      bookingId: bookingMap.get(String(r.bookingId)) || r.bookingId
    }));

    const totalRedemptions = redemptions.length;
    const totalDiscount = redemptions.reduce((sum: number, r: any) => sum + (r.discountApplied || 0), 0);
    const revenueGenerated = redemptions.reduce((sum: number, r: any) => sum + (r.bookingId?.total_amount || 0), 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailyUsage = await CUsage.aggregate([
      { $match: { couponId, usedAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$usedAt" } },
          count: { $sum: 1 },
          discount: { $sum: "$discountApplied" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    res.status(200).json({
      summary: {
        totalRedemptions,
        totalDiscount,
        revenueGenerated,
        conversionRate: totalRedemptions > 0 ? (totalRedemptions / 100).toFixed(2) : 0
      },
      dailyUsage,
      redemptions
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get coupon usage
// @route   GET /api/coupons/:id/usage
// @access  Private/Admin
export const getCouponUsage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const couponId = new mongoose.Types.ObjectId(id);

    const CUsage = getCouponUsageModel();
    const rawUsage = await CUsage.find({ couponId }).sort({ usedAt: -1 }).lean();

    const userIds = rawUsage.map((r: any) => r.userId).filter(Boolean);
    const bookingIds = rawUsage.map((r: any) => r.bookingId).filter(Boolean);

    const UModel = getUserModel();
    const users = await UModel.find({ _id: { $in: userIds } }).select('name email profile_image').lean();
    const userMap = new Map(users.map((u: any) => [String(u._id), u]));

    const BModel = getBookingModel();
    const bookings = await BModel.find({ _id: { $in: bookingIds } }).select('booking_id total_amount createdAt').lean();
    const bookingMap = new Map(bookings.map((b: any) => [String(b._id), b]));

    const usage = rawUsage.map((r: any) => ({
      ...r,
      userId: userMap.get(String(r.userId)) || r.userId,
      bookingId: bookingMap.get(String(r.bookingId)) || r.bookingId
    }));

    res.status(200).json(usage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
