import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CouponUsage } from '../models/CouponUsage';

// @desc    Get all usages for a coupon
// @route   GET /api/coupon-usages?couponId=xxx
// @access  Internal
export const getCouponUsages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { couponId } = req.query;
    if (!couponId || !mongoose.Types.ObjectId.isValid(couponId as string)) {
      res.json([]);
      return;
    }
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const usages = await CouponUsage.find({ couponId: new mongoose.Types.ObjectId(couponId as string) })
      .sort({ usedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    res.json(usages);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get aggregate stats for all coupons
// @route   GET /api/coupon-usages/stats
// @access  Internal
export const getCouponUsageStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalRedemptions = await CouponUsage.countDocuments();
    const usageData = await CouponUsage.aggregate([
      { $group: { _id: null, totalDiscount: { $sum: '$discountApplied' } } }
    ]);
    const totalDiscountGiven = usageData.length > 0 ? usageData[0].totalDiscount : 0;
    res.json({ totalRedemptions, totalDiscountGiven });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get daily usage chart for a coupon (last 30 days)
// @route   GET /api/coupon-usages/daily?couponId=xxx
// @access  Internal
export const getCouponDailyUsage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { couponId } = req.query;
    if (!couponId || !mongoose.Types.ObjectId.isValid(couponId as string)) {
      res.json([]);
      return;
    }
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const couponObjId = new mongoose.Types.ObjectId(couponId as string);
    const dailyUsage = await CouponUsage.aggregate([
      { $match: { couponId: couponObjId, usedAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$usedAt' } },
          count: { $sum: 1 },
          discount: { $sum: '$discountApplied' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(dailyUsage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete all usages for a coupon (called when coupon is deleted)
// @route   DELETE /api/coupon-usages?couponId=xxx
// @access  Internal
export const deleteCouponUsages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { couponId } = req.query;
    if (!couponId) {
      res.status(400).json({ message: 'couponId is required' });
      return;
    }
    await CouponUsage.deleteMany({ couponId: new mongoose.Types.ObjectId(couponId as string) });
    res.json({ message: 'Coupon usages deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
