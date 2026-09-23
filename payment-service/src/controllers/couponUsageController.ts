import { Request, Response } from 'express';
import { CouponUsageRepository } from '../repositories/couponUsageRepository';

// @desc    Get all usages for a coupon
// @route   GET /api/coupon-usages?couponId=xxx
// @access  Internal
export const getCouponUsages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { couponId } = req.query;
    if (!couponId) {
      res.json([]);
      return;
    }
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const usages = await CouponUsageRepository.getCouponUsages(String(couponId), page, limit);
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
    const stats = await CouponUsageRepository.getCouponUsageStats();
    res.json(stats);
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
    if (!couponId) {
      res.json([]);
      return;
    }
    const dailyUsage = await CouponUsageRepository.getCouponDailyUsage(String(couponId));
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
    await CouponUsageRepository.deleteCouponUsages(String(couponId));
    res.json({ message: 'Coupon usages deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
