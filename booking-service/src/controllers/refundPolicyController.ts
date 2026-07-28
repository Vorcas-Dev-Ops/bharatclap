import { Request, Response } from 'express';
import { RefundPolicy } from '../models/RefundPolicy';
import { getCache, setCache, deleteCache } from '../config/redis';

export const getRefundPolicy = async (req: Request, res: Response) => {
  try {
    const cacheKey = 'bookings:refund-policy';
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    let policy = await RefundPolicy.findOne();
    if (!policy) {
      policy = await RefundPolicy.create({});
    }
    
    await setCache(cacheKey, policy, 3600); // 1 hour TTL
    res.json(policy);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching refund policy' });
  }
};

export const updateRefundPolicy = async (req: Request, res: Response) => {
  try {
    const {
      cancelWithinBookingHours,
      bookingCancellationFee,
      lastMinuteHours,
      lastMinuteCancellationFee,
      allowCancellationAfterProviderAssigned,
      allowCancellationAfterServiceStarted
    } = req.body;

    let policy = await RefundPolicy.findOne();
    if (!policy) {
      policy = new RefundPolicy();
    }

    policy.cancelWithinBookingHours = cancelWithinBookingHours;
    policy.bookingCancellationFee = bookingCancellationFee;
    policy.lastMinuteHours = lastMinuteHours;
    policy.lastMinuteCancellationFee = lastMinuteCancellationFee;
    policy.allowCancellationAfterProviderAssigned = allowCancellationAfterProviderAssigned;
    policy.allowCancellationAfterServiceStarted = allowCancellationAfterServiceStarted;
    policy.updatedBy = (req as any).user?.userId || 'admin';

    await policy.save();

    // Invalidate refund policy cache
    await deleteCache('bookings:refund-policy');

    res.json(policy);
  } catch (err) {
    res.status(500).json({ message: 'Error updating refund policy' });
  }
};
