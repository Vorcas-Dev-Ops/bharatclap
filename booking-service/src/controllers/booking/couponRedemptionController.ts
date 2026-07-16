import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CouponRedemption } from '../../models/CouponRedemption';
import { Booking } from '../../models/Booking';

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

    const userObjId = new mongoose.Types.ObjectId(userId as string);
    const couponObjId = new mongoose.Types.ObjectId(couponId as string);

    // 1. Check user-specific limit
    const redemptionCount = await CouponRedemption.countDocuments({
      couponId: couponObjId,
      userId: userObjId,
      status: { $in: ['locked', 'consumed'] }
    });

    const limit = perUserLimit || 1;
    if (redemptionCount >= limit) {
      res.json({ allowed: false, message: 'You have reached the usage limit for this coupon.' });
      return;
    }

    // 2. Check first order only constraint
    if (isFirstOrderOnly) {
      const activeBookingCount = await Booking.countDocuments({
        user_id: userObjId,
        status: { $ne: 'cancelled' }
      });
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

    const userObjId = new mongoose.Types.ObjectId(userId as string);
    const couponObjId = new mongoose.Types.ObjectId(couponId as string);
    const bookingObjId = new mongoose.Types.ObjectId(bookingId as string);

    // Idempotency: check if already exists for this idempotency key
    if (idempotencyKey) {
      const existing = await CouponRedemption.findOne({ idempotencyKey });
      if (existing) {
        res.status(200).json({ message: 'Coupon applied successfully (idempotent)', redemption: existing });
        return;
      }
    }

    try {
      const redemption = await CouponRedemption.create({
        couponId: couponObjId,
        couponCode,
        userId: userObjId,
        bookingId: bookingObjId,
        discountApplied: Number(discountApplied),
        status: 'locked',
        idempotencyKey
      });

      res.status(201).json({ message: 'Coupon applied and locked successfully', redemption });
    } catch (createErr: any) {
      // Handle concurrent duplicate key conflicts for unique indexes (code 11000)
      if (createErr.code === 11000) {
        if (idempotencyKey) {
          const retryExisting = await CouponRedemption.findOne({ idempotencyKey });
          if (retryExisting) {
            res.status(200).json({ message: 'Coupon applied successfully (idempotent)', redemption: retryExisting });
            return;
          }
        }
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

    const bookingObjId = new mongoose.Types.ObjectId(bookingId as string);
    const redemption = await CouponRedemption.findOne({ bookingId: bookingObjId, status: 'locked' });
    
    if (redemption) {
      redemption.status = 'released';
      await redemption.save();
      res.json({ message: 'Coupon lock released successfully', redemption });
    } else {
      res.json({ message: 'No active locked coupon redemption found for this booking' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
