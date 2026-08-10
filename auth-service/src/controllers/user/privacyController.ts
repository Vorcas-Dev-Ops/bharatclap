import { Request, Response, NextFunction } from 'express';
import { User } from '../../models/User';
import { sendSuccess, sendError, ErrorCodes, NotFoundError, BusinessError } from '@bharatclap/shared';

// Initiate 30-day account deletion cooling period (DPDPA Right to Erasure)
export const requestAccountDeletion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?._id || (req as any).user?.id;
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User account not found');
    }

    const now = new Date();
    const scheduledDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days cooling period

    user.deletion_requested_at = now;
    user.deletion_scheduled_at = scheduledDate;
    await user.save();

    sendSuccess(res, 200, 'Account deletion requested successfully. Your account will be permanently anonymized in 30 days. You can cancel anytime before then.', {
      deletion_requested_at: now,
      deletion_scheduled_at: scheduledDate
    });
  } catch (err) {
    next(err);
  }
};

// Cancel account deletion request
export const cancelAccountDeletion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?._id || (req as any).user?.id;
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User account not found');
    }

    if (!user.deletion_requested_at) {
      throw new BusinessError('No active deletion request found', ErrorCodes.DUPLICATE_REQUEST);
    }

    user.deletion_requested_at = undefined;
    user.deletion_scheduled_at = undefined;
    await user.save();

    sendSuccess(res, 200, 'Account deletion request cancelled successfully. Your account remains active.', {
      status: 'active'
    });
  } catch (err) {
    next(err);
  }
};

// User Data Export (DPDPA Data Portability)
export const exportUserData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?._id || (req as any).user?.id;
    const user = await User.findById(userId).select('-password -__v').lean();
    if (!user) {
      throw new NotFoundError('User profile not found');
    }

    const exportPayload = {
      profile: user,
      exportedAt: new Date().toISOString(),
      formatVersion: '1.0'
    };

    sendSuccess(res, 200, 'User data exported successfully', exportPayload);
  } catch (err) {
    next(err);
  }
};
