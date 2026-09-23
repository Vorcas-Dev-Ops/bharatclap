import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../../repositories/userRepository';
import { sendSuccess, ErrorCodes, NotFoundError, BusinessError } from '@bharatclap/shared';

// Initiate 30-day account deletion cooling period (DPDPA Right to Erasure)
export const requestAccountDeletion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User account not found');
    }

    const now = new Date();
    const scheduledDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days cooling period

    await UserRepository.update(user.id, {
      deletion_requested_at: now,
      deletion_scheduled_at: scheduledDate
    });

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
    const userId = (req as any).user?.id || (req as any).user?._id;
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User account not found');
    }

    if (!user.deletion_requested_at) {
      throw new BusinessError('No active deletion request found', ErrorCodes.DUPLICATE_REQUEST);
    }

    await UserRepository.update(user.id, {
      deletion_requested_at: null,
      deletion_scheduled_at: null
    });

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
    const userId = (req as any).user?.id || (req as any).user?._id;
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User profile not found');
    }

    const { password, password_hash, ...safeProfile } = user as any;

    const exportPayload = {
      profile: safeProfile,
      exportedAt: new Date().toISOString(),
      formatVersion: '1.0'
    };

    sendSuccess(res, 200, 'User data exported successfully', exportPayload);
  } catch (err) {
    next(err);
  }
};
