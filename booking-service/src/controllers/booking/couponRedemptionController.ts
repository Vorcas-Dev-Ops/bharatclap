import { Request, Response } from 'express';
import { CouponRedemptionRepository } from '../../repositories/couponRedemptionRepository';
import { BookingRepository } from '../../repositories/bookingRepository';
import { getDb } from '../../config/db';

// @desc    Internal endpoint to check coupon usage limit for a specific user and first order constraints
// @route   POST /api/bookings/internal/coupons/usage-check
// @access  Public (Internal Auth)
export const checkCouponUsageInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { couponId, userId, perUserLimit, isFirstOrderOnly } = req.body;
    if (!couponId || !userId) {
      res.status(400).json({ message: 'couponId and userId are required' });
      return;
    }

    // 1. Check user-specific limit
    const redemptionCount = await CouponRedemptionRepository.countUserRedemptions(String(couponId), String(userId));
    const limit = perUserLimit || 1;
    if (redemptionCount >= limit) {
      res.json({ allowed: false, message: 'You have reached the usage limit for this coupon.' });
      return;
    }

    // 2. Check first order only constraint
    if (isFirstOrderOnly) {
      const db = getDb();
      const resCount = await db.query(
        `SELECT COUNT(*)::int AS cnt FROM booking.bookings
         WHERE (user_id::text = $1 OR user_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1))
           AND status != 'cancelled'
           AND deleted_at IS NULL`,
        [String(userId)]
      );
      const activeBookingCount = resCount.rows[0]?.cnt || 0;
      if (activeBookingCount > 0) {
        res.json({ allowed: false, message: 'This coupon is only valid for first-time orders.' });
        return;
      }
    }

    res.json({ allowed: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Internal endpoint to lock coupon application on booking checkout
// @route   POST /api/bookings/internal/coupons/apply
// @access  Public (Internal Auth)
export const applyCouponInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { couponId, couponCode, userId, bookingId, discountApplied, idempotencyKey } = req.body;
    if (!couponId || !couponCode || !userId || !bookingId || !discountApplied) {
      res.status(400).json({ message: 'Missing required coupon apply fields' });
      return;
    }

    try {
      const redemption = await CouponRedemptionRepository.create({
        couponId: String(couponId),
        userId: String(userId),
        bookingId: String(bookingId),
        discountAmount: Number(discountApplied),
      });

      res.status(201).json({ message: 'Coupon applied and locked successfully', redemption });
    } catch (createErr: any) {
      if (createErr.code === '23505') { // unique violation
        res.status(409).json({ message: 'Coupon already locked or processing in another session for this user.' });
        return;
      }
      throw createErr;
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Internal endpoint to release locked coupon on booking cancellation
// @route   POST /api/bookings/internal/coupons/release
// @access  Public (Internal Auth)
export const releaseCouponInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      res.status(400).json({ message: 'bookingId is required' });
      return;
    }

    const released = await CouponRedemptionRepository.deleteByBookingId(String(bookingId));
    if (released) {
      res.json({ message: 'Coupon lock released successfully' });
    } else {
      res.json({ message: 'No active locked coupon redemption found for this booking' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
