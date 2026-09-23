import { Request, Response } from 'express';
import { RefundPolicyRepository } from '../repositories/refundPolicyRepository';
import { getCache, setCache, deleteCache } from '../config/redis';

export const getRefundPolicy = async (req: Request, res: Response) => {
  try {
    const cacheKey = 'bookings:refund-policy';
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const policy = await RefundPolicyRepository.getPolicy();
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

    const policy = await RefundPolicyRepository.updatePolicy({
      cancelWithinBookingHours,
      bookingCancellationFee,
      lastMinuteHours,
      lastMinuteCancellationFee,
      allowCancellationAfterProviderAssigned,
      allowCancellationAfterServiceStarted,
    });

    // Invalidate refund policy cache
    await deleteCache('bookings:refund-policy');

    res.json(policy);
  } catch (err) {
    res.status(500).json({ message: 'Error updating refund policy' });
  }
};
