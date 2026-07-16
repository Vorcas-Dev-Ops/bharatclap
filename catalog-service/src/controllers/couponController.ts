import { Request, Response } from 'express';
import { Coupon } from '../models/Coupon';
import mongoose from 'mongoose';
import axios from 'axios';
import { getUsersBatch, getBookingsBatch } from '../utils/internalApi';

const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5005';


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
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    
    const coupons = await Coupon.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
      
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

    // Delegate coupon-usage cleanup to payment-service (data owner)
    await axios.delete(`${PAYMENT_URL}/api/coupon-usages?couponId=${id}`).catch(() => {});

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

    // Delegate usage stats to payment-service (data owner)
    const statsRes = await axios.get(`${PAYMENT_URL}/api/coupon-usages/stats`).catch(() => ({ data: { totalRedemptions: 0, totalDiscountGiven: 0 } }));
    const { totalRedemptions, totalDiscountGiven } = statsRes.data;

    res.status(200).json({ totalCoupons, activeOffers, totalRedemptions, totalDiscountGiven });
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

    // Fetch raw usages from payment-service
    const usageRes = await axios.get(`${PAYMENT_URL}/api/coupon-usages?couponId=${id}`).catch(() => ({ data: [] }));
    const rawRedemptions: any[] = usageRes.data;

    const userIds = rawRedemptions.map((r: any) => r.userId).filter(Boolean).map(String);
    const bookingIds = rawRedemptions.map((r: any) => r.bookingId).filter(Boolean).map(String);

    const users = await getUsersBatch(userIds).catch(() => []);
    const userMap = new Map(users.map((u: any) => [String(u._id), u]));

    const bookings = await getBookingsBatch(bookingIds).catch(() => []);
    const bookingMap = new Map(bookings.map((b: any) => [String(b._id), b]));

    const redemptions = rawRedemptions.map((r: any) => ({
      ...r,
      userId:    userMap.get(String(r.userId))    || r.userId,
      bookingId: bookingMap.get(String(r.bookingId)) || r.bookingId
    }));

    const totalRedemptions  = redemptions.length;
    const totalDiscount     = redemptions.reduce((sum: number, r: any) => sum + (r.discountApplied || 0), 0);
    const revenueGenerated  = redemptions.reduce((sum: number, r: any) => sum + (r.bookingId?.total_amount || 0), 0);

    // Fetch daily chart from payment-service
    const dailyRes = await axios.get(`${PAYMENT_URL}/api/coupon-usages/daily?couponId=${id}`).catch(() => ({ data: [] }));
    const dailyUsage = dailyRes.data;

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

    // Fetch raw usages from payment-service
    const usageRes = await axios.get(`${PAYMENT_URL}/api/coupon-usages?couponId=${id}`).catch(() => ({ data: [] }));
    const rawUsage: any[] = usageRes.data;

    const userIds    = rawUsage.map((r: any) => r.userId).filter(Boolean).map(String);
    const bookingIds = rawUsage.map((r: any) => r.bookingId).filter(Boolean).map(String);

    const users = await getUsersBatch(userIds).catch(() => []);
    const userMap = new Map(users.map((u: any) => [String(u._id), u]));

    const bookings = await getBookingsBatch(bookingIds).catch(() => []);
    const bookingMap = new Map(bookings.map((b: any) => [String(b._id), b]));

    const usage = rawUsage.map((r: any) => ({
      ...r,
      userId:    userMap.get(String(r.userId))    || r.userId,
      bookingId: bookingMap.get(String(r.bookingId)) || r.bookingId
    }));

    res.status(200).json(usage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Validate coupon
// @route   POST /api/coupons/validate
// @access  Public/Private
export const validateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, userId, cartAmount } = req.body;
    if (!code || !userId || !cartAmount) {
      res.status(400).json({ message: 'code, userId, and cartAmount are required' });
      return;
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isDeleted: false });
    if (!coupon) {
      res.status(404).json({ message: 'Coupon not found' });
      return;
    }

    if (coupon.status !== 'active') {
      res.status(400).json({ message: 'Coupon is inactive or expired' });
      return;
    }

    const now = new Date();
    if (now < new Date(coupon.startDate) || now > new Date(coupon.expiryDate)) {
      res.status(400).json({ message: 'Coupon is out of validity date range' });
      return;
    }

    if (cartAmount < coupon.minOrderAmount) {
      res.status(400).json({ message: `Minimum order value of ₹${coupon.minOrderAmount} required` });
      return;
    }

    // Budget Protection Check
    const discount = coupon.discountType === 'percentage' 
      ? Math.min((cartAmount * coupon.discountValue) / 100, coupon.maxDiscountLimit || Infinity)
      : coupon.discountValue;

    if ((coupon.currentBudgetSpent || 0) + discount > coupon.totalBudget) {
      res.status(400).json({ message: 'Coupon campaign budget limit reached' });
      return;
    }

    if ((coupon.currentGlobalUsage || 0) >= coupon.usageLimit) {
      res.status(400).json({ message: 'Coupon usage limit reached' });
      return;
    }

    // Usage Cap Check & First-Order check (by calling booking-service internal API)
    const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:5004';
    try {
      const response = await axios.post(`${BOOKING_URL}/api/bookings/internal/coupons/usage-check`, {
        couponId: coupon._id,
        userId,
        perUserLimit: coupon.perUserLimit,
        isFirstOrderOnly: coupon.isFirstOrderOnly
      }, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
      });

      if (!response.data.allowed) {
        res.status(400).json({ message: response.data.message || 'Coupon usage limit exceeded for this user' });
        return;
      }
    } catch (err: any) {
      console.error('[COUPON VALIDATION] Failed to check usage with booking-service:', err.message);
      res.status(500).json({ message: 'Failed to verify coupon usage limits' });
      return;
    }

    res.status(200).json({
      isValid: true,
      couponId: coupon._id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountApplied: discount
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
