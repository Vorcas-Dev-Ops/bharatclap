import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../../models/User';
import { CustomerReferral } from '../../models/CustomerReferral';
import { ReferralReward } from '../../models/ReferralReward';
import { AuthRequest } from '../../middleware/authMiddleware';

// @desc    Get user referral code and earnings
// @route   GET /api/referrals/my-code
// @access  Private/Customer
export const getMyReferralCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Calculate total completed earnings
    const rewards = await ReferralReward.find({
      referrerId: user._id,
      status: 'completed'
    });
    const rewardsEarned = rewards.reduce((sum, r) => sum + r.rewardValue, 0);

    res.json({
      code: user.referralCode || '',
      rewardsEarned
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify customer referral code (returns name of referrer)
// @route   POST /api/referrals/verify
// @access  Public
export const verifyReferralCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ message: 'Referral code is required' });
      return;
    }

    const referrer = await User.findOne({
      referralCode: code.toUpperCase(),
      role: 'customer',
      status: 'active',
      isDeleted: false
    });

    if (!referrer) {
      res.json({ isValid: false, message: 'Invalid or inactive referral code.' });
      return;
    }

    res.json({ isValid: true, referrerName: referrer.name || 'BharatClap Customer' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user referral history (invite list)
// @route   GET /api/referrals/history
// @access  Private/Customer
export const getReferralHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const referrals = await CustomerReferral.find({ referrerId: req.user?._id })
      .sort({ createdAt: -1 })
      .lean();

    const refereeIds = referrals.map(r => r.refereeId);
    const referees = await User.find({ _id: { $in: refereeIds } }).select('name phone createdAt').lean();
    const refereeMap = new Map(referees.map(u => [u._id.toString(), u]));

    const history = referrals.map(ref => {
      const user = refereeMap.get(ref.refereeId.toString());
      // Mask phone number for privacy
      const phone = user?.phone ? user.phone.replace(/.(?=.{4})/g, '*') : 'Unknown';
      return {
        _id: ref._id,
        name: user?.name || 'Referred User',
        phone,
        status: ref.status,
        date: ref.createdAt
      };
    });

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Internal endpoint called by booking-service when a booking completes
// @route   POST /api/referrals/internal/on-booking-completed
// @access  Public (Internal Auth Key)
export const onBookingCompletedInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, bookingId } = req.body;
    if (!userId || !bookingId) {
      res.status(400).json({ message: 'userId and bookingId are required' });
      return;
    }

    const refereeObjId = new mongoose.Types.ObjectId(userId as string);
    const referral = await CustomerReferral.findOne({
      refereeId: refereeObjId,
      status: { $in: ['invited', 'booked'] }
    });

    if (!referral) {
      // No active referral pending for this user, skip open/finish
      res.json({ status: 'ignored', message: 'No pending referral found for this user' });
      return;
    }

    const referrer = await User.findById(referral.referrerId);
    const referee = await User.findById(referral.refereeId);

    if (!referrer || !referee) {
      res.status(404).json({ message: 'Referrer or Referee not found' });
      return;
    }

    // --- FRAUD pipeline checks ---
    let isFlagged = false;
    let holdReason = '';

    // Check 1: Same phone check
    if (referrer.phone && referee.phone && referrer.phone === referee.phone) {
      isFlagged = true;
      holdReason = 'Self-referral phone check: identical phone numbers detected.';
    }

    // Check 2: Same device fingerprint
    if (referral.deviceFingerprint && referral.deviceFingerprint !== 'Unknown FP') {
      const duplicateFpCount = await CustomerReferral.countDocuments({
        deviceFingerprint: referral.deviceFingerprint,
        _id: { $ne: referral._id }
      });
      if (duplicateFpCount > 0) {
        isFlagged = true;
        holdReason = 'Device fingerprint check: this device has already claimed a welcome/referral reward.';
      }
    }

    // Check 3: IP Rate limit (Max 3 referrals from same IP in 24 hours)
    if (referral.ipAddress && referral.ipAddress !== 'Unknown IP') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const ipReferralsCount = await CustomerReferral.countDocuments({
        ipAddress: referral.ipAddress,
        createdAt: { $gte: oneDayAgo }
      });
      if (ipReferralsCount > 3) {
        isFlagged = true;
        holdReason = 'IP velocity check: exceeded 3 referral signups from same IP within 24 hours.';
      }
    }

    // Initialize ledger record
    const ledger = await ReferralReward.create({
      referralId: referral._id,
      referrerId: referrer._id,
      refereeId: referee._id,
      rewardType: 'wallet_credit',
      rewardValue: 100, // ₹100 reward
      status: isFlagged ? 'fraud_hold' : 'pending',
      reversalReason: isFlagged ? holdReason : undefined
    });

    if (isFlagged) {
      referral.status = 'flagged';
      await referral.save();
      res.json({ status: 'flagged', message: holdReason, ledger });
      return;
    }

    // ACID Wallet Credit operation
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Increment referrer wallet balance
        await User.findByIdAndUpdate(
          referrer._id,
          { $inc: { walletBalance: 100 } },
          { session }
        );

        // Update ledger status
        ledger.status = 'completed';
        await ledger.save({ session });

        // Update referral status
        referral.status = 'rewarded';
        await referral.save({ session });
      });
    } finally {
      await session.endSession();
    }

    res.json({ status: 'rewarded', ledger });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
