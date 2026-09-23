import { Request, Response } from 'express';
import { UserRepository } from '../../repositories/userRepository';
import { ReferralRepository } from '../../repositories/referralRepository';
import { AuthRequest } from '../../middleware/authMiddleware';
import { withTransaction } from '@bharatclap/shared';
import { getDb } from '../../config/db';

// @desc    Get user referral code and earnings
// @route   GET /api/referrals/my-code
// @access  Private/Customer
export const getMyReferralCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const user = await UserRepository.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const rewardsEarned = await ReferralRepository.getTotalRewardsForUser(userId);

    res.json({
      code: user.referral_code || user.referralCode || '',
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

    const referrer = await UserRepository.findByReferralCode(code);
    if (!referrer || referrer.status !== 'active' || referrer.deleted_at) {
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
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const rows = await ReferralRepository.getHistory(userId);

    const history = rows.map((ref: any) => {
      const phone = ref.phone ? ref.phone.replace(/.(?=.{4})/g, '*') : 'Unknown';
      return {
        _id: ref.id,
        id: ref.id,
        name: ref.name || 'Referred User',
        phone,
        status: ref.status,
        date: ref.created_at
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

    const referral = await ReferralRepository.findPendingByReferee(String(userId));
    if (!referral) {
      res.json({ status: 'ignored', message: 'No pending referral found for this user' });
      return;
    }

    const referrer = await UserRepository.findById(referral.referrer_id);
    const referee = await UserRepository.findById(referral.referred_id);

    if (!referrer || !referee) {
      res.status(404).json({ message: 'Referrer or Referee not found' });
      return;
    }

    // Fraud check 1: Same phone check
    if (referrer.phone && referee.phone && referrer.phone === referee.phone) {
      await ReferralRepository.flagReferral(referral.id, 'Self-referral phone check');
      res.json({ status: 'flagged', message: 'Self-referral phone check: identical phone numbers detected.' });
      return;
    }

    // ACID PostgreSQL Wallet Credit & Ledger operation
    const pool = getDb();
    const ledger = await withTransaction(pool, async (client) => {
      return ReferralRepository.completeReferralTx(client, referral.id, referrer.id, referee.id, 100);
    });

    res.json({ status: 'rewarded', ledger });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
