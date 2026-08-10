import { Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { User } from '../models/User';
import { Otp } from '../models/Otp';
import { AccountDeletionRequest } from '../models/AccountDeletionRequest';
import { AccountDeletionOutbox } from '../models/AccountDeletionOutbox';
import { AuthRequest } from '../middleware/authMiddleware';
import { checkUserObligations, processDeletionOutboxBatch } from '../utils/deletionWorker';

// 1. Anti-Enumeration Public Web OTP Request
export const requestWebDeletionOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, useEmail } = req.body;
    const safeIdentifier = String(identifier || '').trim();

    if (!safeIdentifier) {
      res.status(400).json({ message: 'Mobile number or Email is required' });
      return;
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();

    await Otp.deleteMany({ identifier: safeIdentifier });
    await Otp.create({
      identifier: safeIdentifier,
      otpCode,
      role: 'customer',
    });

    console.log(`[DELETION OTP] Verification code generated for ${safeIdentifier}: ${otpCode}`);

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

    const otpRecord = await Otp.findOne({ identifier: safeIdentifier, otpCode: safeOtp });
    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired verification code' });
      return;
    }

    await Otp.deleteOne({ _id: otpRecord._id });

    const user = await User.findOne(useEmail ? { email: safeIdentifier } : { phone: safeIdentifier });
    if (!user) {
      // ANTI-ENUMERATION: If identifier has no user, return generic status clear
      res.status(200).json({
        success: true,
        verified: true,
        user_exists: false,
        message: 'Verification complete. No active obligations found.',
      });
      return;
    }

    // Generate short-lived deletion token
    const deletionToken = crypto.randomBytes(32).toString('hex');

    res.status(200).json({
      success: true,
      verified: true,
      user_exists: true,
      user_id: user._id,
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
  let session: mongoose.ClientSession | null = null;
  try {
    const user_id = req.user?._id || req.body.user_id;
    const reason = req.body.reason || 'User requested account deletion';

    if (!user_id) {
      res.status(401).json({ message: 'Not authorized for account deletion' });
      return;
    }

    const user = await User.findById(user_id);
    if (!user) {
      res.status(404).json({ message: 'Account not found' });
      return;
    }

    const accountType: 'CUSTOMER' | 'PROVIDER' = user.role === 'provider' ? 'PROVIDER' : 'CUSTOMER';

    // 1. Fast-fail Obligation Pre-check
    const obligations = await checkUserObligations(String(user._id), accountType);

    // 2. Check Existing Request / Resume Path
    let existingRequest = await AccountDeletionRequest.findOne({
      user_id: user._id,
      status: { $in: ['REQUESTED', 'VERIFIED', 'BLOCKED_PENDING_OBLIGATION', 'PROCESSING'] },
    });

    if (obligations.length > 0) {
      if (!existingRequest) {
        const reqId = `ADR-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
        existingRequest = new AccountDeletionRequest({
          request_id: reqId,
          user_id: user._id,
          account_type: accountType,
          status: 'BLOCKED_PENDING_OBLIGATION',
          reason,
          blocking_obligations: obligations,
          audit_reference: `AUD-${Date.now()}`,
          audit_trail: [
            {
              status: 'BLOCKED_PENDING_OBLIGATION',
              timestamp: new Date(),
              note: `Initiation fast pre-check identified active obligations: ${obligations.join(', ')}`,
            },
          ],
        });
        await existingRequest.save();
      } else {
        existingRequest.status = 'BLOCKED_PENDING_OBLIGATION';
        existingRequest.blocking_obligations = obligations;
        existingRequest.audit_trail.push({
          status: 'BLOCKED_PENDING_OBLIGATION',
          timestamp: new Date(),
          note: `Re-validation identified remaining obligations: ${obligations.join(', ')}`,
        });
        await existingRequest.save();
      }

      // GATE 2 ENFORCEMENT: Revocation happens immediately even if BLOCKED_PENDING_OBLIGATION
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
      res.clearCookie('jwt');

      res.status(409).json({
        success: false,
        status: 'BLOCKED_PENDING_OBLIGATION',
        request_id: existingRequest.request_id,
        blocking_obligations: obligations,
        support_url: 'https://bharatclap.com/support',
        message: 'Account deletion cannot complete immediately due to pending obligations.',
      });
      return;
    }

    // Clear obligations -> Resume or Create Request
    const requestId = existingRequest?.request_id || `ADR-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    session = await mongoose.startSession();
    session.startTransaction();

    let targetRequest: any;

    if (existingRequest) {
      existingRequest.status = 'PROCESSING';
      existingRequest.blocking_obligations = [];
      existingRequest.audit_trail.push({
        status: 'PROCESSING',
        timestamp: new Date(),
        note: 'RESUMED: Account deletion resumed after obligations resolved.',
      });
      targetRequest = await existingRequest.save({ session });
    } else {
      targetRequest = new AccountDeletionRequest({
        request_id: requestId,
        user_id: user._id,
        account_type: accountType,
        status: 'PROCESSING',
        reason,
        audit_reference: `AUD-${Date.now()}`,
        audit_trail: [
          {
            status: 'PROCESSING',
            timestamp: new Date(),
            note: 'Account deletion workflow initiated and queued in outbox.',
          },
        ],
      });
      await targetRequest.save({ session });
    }

    // Create Outbox Event
    const outboxItem = new AccountDeletionOutbox({
      request_id: targetRequest._id,
      user_id: user._id,
      account_type: accountType,
      event_type: 'PROCESS_ACCOUNT_DELETION',
      status: 'PENDING',
      attempts: 0,
      next_retry_at: new Date(),
    });
    await outboxItem.save({ session });

    await session.commitTransaction();
    session.endSession();
    session = null;

    // 3. IMMEDIATE & UNCONDITIONAL SESSION REVOCATION
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    res.clearCookie('jwt');

    // Trigger Outbox Processing in Background
    processDeletionOutboxBatch().catch(console.error);

    res.status(200).json({
      success: true,
      status: 'PROCESSING',
      request_id: requestId,
      message: 'Account deletion confirmed. All active sessions have been revoked.',
    });
  } catch (error: any) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error('[ACCOUNT DELETION INITIATE ERROR]', error);
    res.status(500).json({ message: 'Failed initiating account deletion', error: error?.message });
  }
};

// 4. Public Deletion Status Lookup
export const getDeletionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { requestId } = req.params;
    const record = await AccountDeletionRequest.findOne({ request_id: requestId });

    if (!record) {
      res.status(404).json({ message: 'Deletion request not found' });
      return;
    }

    res.status(200).json({
      success: true,
      request_id: record.request_id,
      account_type: record.account_type,
      status: record.status,
      requested_at: record.requested_at,
      completed_at: record.completed_at,
      blocking_obligations: record.blocking_obligations,
      retention_status: record.retention_status,
      retained_data_summary: record.retained_data_summary,
      razorpay_request_status: record.razorpay_request_status,
      audit_trail: record.audit_trail,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed fetching deletion status', error: error?.message });
  }
};

// 5. Internal Microservice User Deletion Status Lookup (Gated by internalAuth)
export const getUserDeletionStatusInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const record = await AccountDeletionRequest.findOne({
      user_id: userId,
      status: { $in: ['REQUESTED', 'VERIFIED', 'BLOCKED_PENDING_OBLIGATION', 'PROCESSING', 'DELETED', 'PARTIALLY_RETAINED'] },
    }).sort({ createdAt: -1 });

    if (!record) {
      res.status(200).json({ success: true, status: 'ACTIVE', is_deletion_in_progress: false });
      return;
    }

    const isInProgress = record.status === 'PROCESSING' || record.status === 'BLOCKED_PENDING_OBLIGATION';

    res.status(200).json({
      success: true,
      user_id: record.user_id,
      request_id: record.request_id,
      status: record.status,
      is_deletion_in_progress: isInProgress,
      blocking_obligations: record.blocking_obligations,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed checking internal user deletion status', error: error?.message });
  }
};

// 6. Admin Compliance Console Query Endpoint
export const getAdminDeletionRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, status, account_type } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (account_type) query.account_type = account_type;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const records = await AccountDeletionRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await AccountDeletionRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        records,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed fetching deletion requests', error: error?.message });
  }
};

// 7. Explicit Admin Financial Clearance Action
export const adminClearFinancialAction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { requestId } = req.params;
    const { action, amount_paise, reason, transaction_refs } = req.body;
    const adminId = String(req.user?._id || 'admin_sys');

    const record = await AccountDeletionRequest.findOne({ request_id: requestId });
    if (!record) {
      res.status(404).json({ message: 'Deletion request not found' });
      return;
    }

    const safeAmount = Number(amount_paise || 0);

    if (action === 'SETTLE_EARNINGS') {
      record.financial_clearance_status = 'PROCESSING_SETTLEMENT_PENDING';
      record.audit_trail.push({
        status: 'PROCESSING_SETTLEMENT_PENDING',
        timestamp: new Date(),
        admin_user_id: adminId,
        note: `EXPLICIT ADMIN ACTION [Initiate Settlement]: ₹${(safeAmount / 100).toFixed(2)} payout initiated. Reason: ${reason || 'Earnings settlement on account deletion'}`,
      });
    } else if (action === 'REFUND_PURCHASED_WALLET') {
      record.financial_clearance_status = 'REFUND_PENDING';
      record.audit_trail.push({
        status: 'REFUND_PENDING',
        timestamp: new Date(),
        admin_user_id: adminId,
        note: `EXPLICIT ADMIN ACTION [Refund Purchased Wallet Balance]: ₹${(safeAmount / 100).toFixed(2)} refund approved. Refs: ${transaction_refs || 'N/A'}. Reason: ${reason || 'Purchased credit refund on account deletion'}`,
      });
    } else if (action === 'FORFEIT_PROMOTIONAL_CREDIT') {
      record.financial_clearance_status = 'PROMOTIONAL_CREDIT_FORFEITED';
      record.audit_trail.push({
        status: 'FORFEITED_PROMOTIONAL_CREDIT_ON_DELETION',
        timestamp: new Date(),
        admin_user_id: adminId,
        note: `EXPLICIT ADMIN ACTION [Forfeit Promotional Credit]: ₹${(safeAmount / 100).toFixed(2)} forfeited. Event: FORFEITED_PROMOTIONAL_CREDIT_ON_DELETION. Reason: ${reason || 'Promotional credit non-refundable per terms'}`,
      });
    } else if (action === 'OFFSET_LIABILITY') {
      record.financial_clearance_status = 'FINANCIALLY_CLEARED';
      record.audit_trail.push({
        status: 'OFFSET_LIABILITY',
        timestamp: new Date(),
        admin_user_id: adminId,
        note: `EXPLICIT ADMIN ACTION [Offset Liability]: ₹${(safeAmount / 100).toFixed(2)} offset against pending liabilities. Reason: ${reason || 'Liability offset on account deletion'}`,
      });
    } else {
      res.status(400).json({ message: 'Invalid admin financial clearance action' });
      return;
    }

    await record.save();

    res.status(200).json({
      success: true,
      request_id: record.request_id,
      financial_clearance_status: record.financial_clearance_status,
      audit_trail: record.audit_trail,
      message: `Admin financial clearance action [${action}] executed successfully.`,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed executing admin financial action', error: error?.message });
  }
};
