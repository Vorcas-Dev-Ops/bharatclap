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
