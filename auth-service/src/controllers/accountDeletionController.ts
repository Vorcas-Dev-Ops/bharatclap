import { Request, Response } from 'express';
import crypto from 'crypto';
import { UserRepository } from '../repositories/userRepository';
import { OtpRepository } from '../repositories/otpRepository';
import { AccountDeletionRepository } from '../repositories/accountDeletionRepository';
import { AuthRequest } from '../middleware/authMiddleware';
import { checkUserObligations } from '../utils/deletionWorker';
import { withTransaction } from '@bharatclap/shared';
import { getDb } from '../config/db';

const OTP_PEPPER = process.env.OTP_PEPPER || 'bharatclap_secure_otp_pepper_2026';

function hashOtp(otp: string, identifier: string): string {
  return crypto.createHmac('sha256', OTP_PEPPER).update(`${identifier}:${otp}`).digest('hex');
}

// 1. Anti-Enumeration Public Web OTP Request
export const requestWebDeletionOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier } = req.body;
    const safeIdentifier = String(identifier || '').trim();

    if (!safeIdentifier) {
      res.status(400).json({ message: 'Mobile number or Email is required' });
      return;
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtp(otpCode, safeIdentifier);

    await OtpRepository.createChallenge({
      identifier: safeIdentifier,
      purpose: 'ACCOUNT_DELETION',
      otpHash,
      role: 'customer',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    console.log(`[DELETION OTP] Verification code dispatched for ${safeIdentifier}`);

    // ANTI-ENUMERATION: Always return the exact same generic 200 message
    res.status(200).json({
      success: true,
      message: 'If an account exists for these details, a verification code has been sent.',
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to request verification code', error: error?.message });
  }
};

// 2. Web OTP Verification for Deletion
export const verifyWebDeletionOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, otp, useEmail } = req.body;
    const safeIdentifier = String(identifier || '').trim();
    const safeOtp = String(otp || '').trim();

    const otpRecord = await OtpRepository.findActive(safeIdentifier, 'ACCOUNT_DELETION');
    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired verification code' });
      return;
    }

    const expectedHash = otpRecord.otp_hash;
    const submittedHash = hashOtp(safeOtp, safeIdentifier);
    if (expectedHash !== submittedHash) {
      await OtpRepository.incrementAttempts(otpRecord.id);
      res.status(400).json({ message: 'Invalid or expired verification code' });
      return;
    }

    await OtpRepository.consume(otpRecord.id);

    const user = useEmail
      ? await UserRepository.findByEmail(safeIdentifier)
      : await UserRepository.findByPhone(safeIdentifier);

    if (!user) {
      res.status(200).json({
        success: true,
        verified: true,
        user_exists: false,
        message: 'Verification complete. No active obligations found.',
      });
      return;
    }

    const deletionToken = crypto.randomBytes(32).toString('hex');

    res.status(200).json({
      success: true,
      verified: true,
      user_exists: true,
      user_id: user.id,
      account_type: user.role === 'provider' ? 'PROVIDER' : 'CUSTOMER',
      deletion_token: deletionToken,
      message: 'Verification successful. Proceeding to deletion workflow.',
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Verification failed', error: error?.message });
  }
};

// 3. Initiate Account Deletion (In-App or Web)
export const initiateAccountDeletion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?._id || req.body.user_id;
    const reason = req.body.reason || 'User requested account deletion';

    if (!userId) {
      res.status(401).json({ message: 'Not authorized for account deletion' });
      return;
    }

    const user = await UserRepository.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'Account not found' });
      return;
    }

    const accountType: 'CUSTOMER' | 'PROVIDER' = user.role === 'provider' ? 'PROVIDER' : 'CUSTOMER';

    // 1. Fast-fail Obligation Pre-check
    const obligations = await checkUserObligations(user.id, accountType);

    if (obligations.length > 0) {
      // Invalidate session immediately
      await UserRepository.incrementTokenVersion(user.id);
      res.clearCookie('jwt');

      res.status(409).json({
        success: false,
        status: 'BLOCKED_PENDING_OBLIGATION',
        blocking_obligations: obligations,
        support_url: 'https://bharatclap.com/support',
        message: 'Account deletion cannot complete immediately due to pending obligations.',
      });
      return;
    }

    // 2. Clear obligations -> Create Request & Outbox atomically
    const pool = getDb();
    const eventId = `EVT-DEL-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const { request } = await withTransaction(pool, async (client) => {
      const scheduledDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const reqRecord = await AccountDeletionRepository.createRequest(user.id, reason, scheduledDate, client);

      await AccountDeletionRepository.createOutboxEvent(
        eventId,
        user.id,
        'ACCOUNT_DELETION_REQUESTED',
        {
          request_id: reqRecord.id,
          user_id: user.id,
          account_type: accountType,
          reason,
        },
        client
      );

      // Invalidate tokens
      await client.query(
        `UPDATE auth.users SET token_version = token_version + 1, updated_at = NOW() WHERE id::text = $1`,
        [user.id]
      );

      return { request: reqRecord };
    });

    res.clearCookie('jwt');

    res.status(200).json({
      success: true,
      status: 'PROCESSING',
      request_id: request.id,
      message: 'Account deletion workflow initiated successfully.',
    });
  } catch (error: any) {
    console.error('[INITIATE DELETION ERROR]', error);
    res.status(500).json({ message: 'Failed to initiate account deletion', error: error?.message });
  }
};

// 4. Get User Deletion Status
export const getDeletionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const request = await AccountDeletionRepository.findActiveRequest(userId);
    if (!request) {
      res.status(404).json({ message: 'No active account deletion request found' });
      return;
    }

    res.json({
      success: true,
      request_id: request.id,
      status: request.status,
      scheduled_at: request.scheduled_at,
      created_at: request.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// 5. Internal Status Check
export const getUserDeletionStatusInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId;
    const request = await AccountDeletionRepository.findActiveRequest(userId);
    res.json({
      hasActiveRequest: Boolean(request),
      status: request?.status || null,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// 6. Admin List Requests
export const getAdminDeletionRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { data, total } = await AccountDeletionRepository.listRequests(limit, offset);
    res.json({ success: true, data, total, page, limit });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// 7. Admin Clear Financial Action
export const adminClearFinancialAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await AccountDeletionRepository.updateStatus(id, 'completed', new Date());
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
