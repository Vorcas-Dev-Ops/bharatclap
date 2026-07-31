import mongoose, { Types } from 'mongoose';
import crypto from 'crypto';
import { Provider, IProvider } from '../models/Provider';
import { WalletTransaction } from '../models/WalletTransaction';
import { WalletAuditLog, WalletSource, ActorType } from '../models/WalletAuditLog';
import { WalletOutbox } from '../models/WalletOutbox';
import { emitToUser, redisClient, isRedisAvailable } from './socketService';
import { walletMetrics } from './walletMetrics';
import { sendProviderNotification } from '../utils/internalApi';

export interface WalletSummary {
  walletBalance: number;
  reservedBalance: number;
  creditLimit: number;
  availableBalance: number;
  availableCredit: number;
}

export const getWalletSummary = (provider: Pick<IProvider, 'walletBalance' | 'reservedBalance' | 'creditLimit'>): WalletSummary => {
  const walletBalance = provider.walletBalance || 0;
  const reservedBalance = provider.reservedBalance || 0;
  const creditLimit = provider.creditLimit || 0;
  return {
    walletBalance,
    reservedBalance,
    creditLimit,
    availableBalance: walletBalance - reservedBalance,
    availableCredit: walletBalance - reservedBalance + creditLimit,
  };
};

export interface RecordWalletOptions {
  providerId: string | Types.ObjectId;
  amount: number;
  type: 'recharge' | 'deduction' | 'refund' | 'hold' | 'release' | 'credit' | 'debit' | 'initial_credit' | 'adjustment';
  action: string;
  source: WalletSource | string;
  actorType?: ActorType;
  actorId?: string;
  reason: string;
  remarks?: string;
  adminUser?: { _id?: any; name?: string; role?: string; admin_role?: string };
  referenceId: string;
  bookingId?: string;
  paymentId?: string;
  deviceType?: string;
  appVersion?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  correlationId?: string;
  skipSocket?: boolean;
  session?: mongoose.ClientSession;
}

/**
 * Enterprise Wallet Mutation Entry Point
 * Enforces Cryptographic Hash Chaining, Fencing Tokens, Multi-Level Approval, Outbox v2 Events & Redis Locking.
 */
export const recordWalletChangeAndAudit = async (options: RecordWalletOptions) => {
  const startTime = Date.now();
  const {
    providerId,
    amount,
    type,
    action,
    source,
    actorType = 'system',
    actorId,
    reason,
    remarks,
    adminUser,
    referenceId,
    bookingId,
    paymentId,
    deviceType = 'web',
    appVersion = '1.0.0',
    ipAddress = '127.0.0.1',
    userAgent,
    requestId,
    correlationId,
    skipSocket,
    session: externalSession,
  } = options;

  let lockKey = '';
  let isLockedByUs = false;

  // 1. Redis Distributed Lock
  if (isRedisAvailable && redisClient) {
    lockKey = `lock:wallet:${providerId}`;
    try {
      const acquired = await redisClient.set(lockKey, 'locked', 'EX', 10, 'NX');
      if (acquired !== 'OK') {
        walletMetrics.incEventFailures();
        throw new Error('CONCURRENCY CONFLICT: Another wallet mutation is currently processing for this provider. Please retry.');
      }
      isLockedByUs = true;
    } catch (err: any) {
      if (err.message.includes('CONCURRENCY CONFLICT')) throw err;
    }
  }

  try {
    // 2. Idempotency Check
    const existingTx = await WalletTransaction.findOne({ referenceId, status: 'success' }).lean();
    if (existingTx) {
      walletMetrics.incIdempotencyHits();
      const existingProvider = await Provider.findById(providerId).lean();
      return {
        success: true,
        alreadyProcessed: true,
        provider: existingProvider,
        balanceAfter: existingTx.balanceAfter,
        summary: existingProvider ? getWalletSummary(existingProvider as any) : null,
      };
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      throw new Error('Provider not found for wallet update');
    }

    const previousBalance = provider.walletBalance || 0;
    const isCredit = ['recharge', 'refund', 'credit', 'initial_credit', 'release'].includes(type);
    const numericAmount = Math.abs(Number(amount) || 0);
    const newBalance = isCredit ? previousBalance + numericAmount : previousBalance - numericAmount;

    // 3. Multi-Level Approval Hierarchy Check for Adjustments
    let requiresApproval = false;
    let approvalStatus: 'approved' | 'pending_approval' = 'approved';

    if (type === 'adjustment' || action === 'ADMIN_RESET') {
      if (numericAmount > 5000) {
        requiresApproval = true;
        approvalStatus = 'pending_approval';
      }
    }

    // 4. Soft Freeze & Business Validation
    const wStatus = provider.walletStatus || 'active';
    if (!isCredit && (wStatus.startsWith('frozen') || wStatus === 'suspended' || provider.isWalletBlocked)) {
      walletMetrics.incNegativeBalanceAttempts();
      throw new Error(`Wallet debit rejected: provider wallet is currently ${wStatus.toUpperCase()} / blocked.`);
    }

    if (!isCredit) {
      const availableCredit = newBalance - (provider.reservedBalance || 0) + (provider.creditLimit || 0);
      if (availableCredit < 0) {
        walletMetrics.incNegativeBalanceAttempts();
        throw new Error(`Wallet debit rejected: balance would exceed credit limit of ₹${provider.creditLimit || 0}`);
      }
    }

    // 5. Cryptographic SHA-256 Hash Chain Calculation
    const lastTx = await WalletTransaction.findOne({ provider_id: provider._id }).sort({ createdAt: -1 }).lean();
    const previous_hash = lastTx?.current_hash || 'GENESIS_HASH';
    const timestampIso = new Date().toISOString();

    const hashInput = `${previous_hash}:${provider._id}:${type}:${numericAmount}:${newBalance}:${referenceId}:${timestampIso}`;
    const current_hash = crypto.createHash('sha256').update(hashInput).digest('hex');

    // Monotonic Fencing Token Calculation
    const fencing_token = (provider.fencing_token || 0) + 1;

    let createdOutboxId: Types.ObjectId | undefined;

    // 6. Transactional Write inside Mongo Session
    const runInTransaction = async (session: mongoose.ClientSession) => {
      // If requires multi-level approval, record pending audit log without mutating walletBalance
      if (requiresApproval) {
        await WalletAuditLog.create(
          [{
            provider_id: provider._id,
            providerId: provider._id,
            action,
            transaction_type: type,
            amount: numericAmount,
            balance_before: previousBalance,
            balance_after: previousBalance,
            previousBalance,
            newBalance: previousBalance,
            source: source || WalletSource.ADMIN_PANEL,
            actor_type: actorType,
            actor_id: actorId || (adminUser?._id ? String(adminUser._id) : String(provider.user_id)),
            adminId: adminUser?._id || undefined,
            adminName: adminUser?.name || 'Admin',
            adminRole: adminUser?.admin_role || adminUser?.role || 'super_admin',
            providerName: (provider as any).user_id?.name || (provider as any).name || 'Service Expert',
            reason,
            remarks: `[REQUIRES MULTI-LEVEL APPROVAL] ${remarks || reason}`,
            bookingId,
            paymentId,
            device_type: deviceType,
            app_version: appVersion,
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId || `REQ-${Date.now()}`,
            correlation_id: correlationId || `CORR-${Date.now()}`,
            reference_id: referenceId,
            transactionRefId: referenceId,
            status: 'Pending Approval',
            approvalStatus: 'pending_approval',
          }],
          { session }
        );
        return;
      }

      // Update Provider with Fencing Token & Optimistic Version
      const currentVersion = provider.walletVersion || 0;
      provider.$locals.walletLedgerAuthorized = true;
      provider.walletBalance = newBalance;
      provider.walletVersion = currentVersion + 1;
      provider.fencing_token = fencing_token;
      provider.wallet_dirty = true;
      if (type === 'initial_credit' || action === 'WALLET_INITIALIZED') {
        provider.wallet_initialized = true;
      }
      await provider.save({ session });

      // Create Cryptographic WalletTransaction
      const [newTx] = await WalletTransaction.create(
        [{
          provider_id: provider._id,
          type,
          amount: numericAmount,
          balanceBefore: previousBalance,
          balanceAfter: newBalance,
          referenceId,
          description: `${reason}${remarks ? ': ' + remarks : ''}`,
          status: 'success',
          previous_hash,
          current_hash,
          fencing_token,
          correlation_id: correlationId || `CORR-${Date.now()}`,
          request_id: requestId || `REQ-${Date.now()}`
        }],
        { session }
      );

      // Create Rich WalletAuditLog
      const adminName = adminUser?.name || (source === 'ADMIN_PANEL' ? 'Admin' : 'System');
      const adminRole = adminUser?.admin_role || adminUser?.role || (source === 'ADMIN_PANEL' ? 'super_admin' : 'system');

      await WalletAuditLog.create(
        [{
          provider_id: provider._id,
          providerId: provider._id,
          transaction_id: newTx._id,
          action,
          transaction_type: type,
          amount: numericAmount,
          balance_before: previousBalance,
          balance_after: newBalance,
          previousBalance,
          newBalance,
          source: source || WalletSource.SYSTEM_JOB,
          actor_type: actorType,
          actor_id: actorId || (adminUser?._id ? String(adminUser._id) : String(provider.user_id)),
          adminId: adminUser?._id || undefined,
          adminName,
          adminRole,
          providerName: (provider as any).user_id?.name || (provider as any).name || 'Service Expert',
          reason,
          remarks: remarks || reason,
          bookingId,
          paymentId,
          device_type: deviceType,
          app_version: appVersion,
          ip_address: ipAddress,
          user_agent: userAgent,
          request_id: requestId || `REQ-${Date.now()}`,
          correlation_id: correlationId || `CORR-${Date.now()}`,
          reference_id: referenceId,
          transactionRefId: referenceId,
          status: 'Active',
          approvalStatus: 'approved',
        }],
        { session }
      );

      // Create Versioned Outbox Event (v2)
      const summary = getWalletSummary({ walletBalance: newBalance, reservedBalance: provider.reservedBalance, creditLimit: provider.creditLimit });
      const [outboxRecord] = await WalletOutbox.create(
        [{
          provider_id: provider._id,
          event_type: 'WalletUpdated',
          payload: {
            event_name: 'WalletUpdated',
            event_version: 2,
            summary,
            referenceId,
            action,
            amount: numericAmount,
            balanceAfter: newBalance,
            fencing_token,
            current_hash,
            timestamp: timestampIso
          },
          status: 'pending',
          correlation_id: correlationId || `CORR-${Date.now()}`
        }],
        { session }
      );

      createdOutboxId = outboxRecord._id;
    };

    if (externalSession) {
      await runInTransaction(externalSession);
    } else {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(() => runInTransaction(session));
      } finally {
        await session.endSession();
      }
    }

    if (requiresApproval) {
      return {
        success: true,
        requiresApproval: true,
        message: `Adjustment of ₹${numericAmount} exceeds ₹5,000 threshold. Transaction submitted for Multi-Level Finance Approval.`
      };
    }

    // 7. Post-Commit Outbox Execution
    if (createdOutboxId && !skipSocket && provider.user_id) {
      processOutboxRecord(createdOutboxId, String(provider.user_id)).catch(console.error);
    }

    const summary = getWalletSummary({ walletBalance: newBalance, reservedBalance: provider.reservedBalance, creditLimit: provider.creditLimit });
    walletMetrics.incTransactionsTotal(type);
    walletMetrics.recordLatency(Date.now() - startTime);

    return {
      success: true,
      alreadyProcessed: false,
      provider,
      previousBalance,
      newBalance,
      summary,
    };
  } finally {
    if (isLockedByUs && lockKey && isRedisAvailable && redisClient) {
      await redisClient.del(lockKey).catch(() => {});
    }
  }
};

/**
 * Worker to process pending outbox events POST-COMMIT
 */
const processOutboxRecord = async (outboxId: Types.ObjectId, userId: string) => {
  try {
    const record = await WalletOutbox.findById(outboxId);
    if (!record || record.status === 'published') return;

    emitToUser(userId, record.event_type, record.payload);

    record.status = 'published';
    record.published_at = new Date();
    await record.save();
  } catch (err: any) {
    walletMetrics.incEventFailures();
    console.error('[OUTBOX WORKER] Failed to process outbox record:', err);
    await WalletOutbox.updateOne(
      { _id: outboxId },
      { $inc: { retry_count: 1 }, $set: { status: 'failed', error_message: err.message } }
    ).catch(() => {});
  }
  // Trigger Payment Credited provider notification
  if (isCredit && numericAmount > 0 && provider.user_id) {
    sendProviderNotification(
      provider.user_id.toString(),
      'Payment Credited',
      `₹${numericAmount} has been credited to your wallet. Reason: ${reason}.`,
      'payment_alert',
      { amount: numericAmount, referenceId }
    ).catch(err => console.error('[NOTIFICATION] Failed to send payment credited notification:', err));
  }
};

/**
 * Ensures initial wallet credit is applied EXACTLY ONCE per provider.
 */
export const initializeProviderWalletOnce = async (
  providerId: string | Types.ObjectId,
  initialBalance: number = 0,
  reason: string = 'Initial Registration Wallet Lifecycle'
) => {
  const provider = await Provider.findById(providerId);
  if (!provider) return null;

  if (provider.wallet_initialized) {
    return provider;
  }

  const referenceId = `INIT_PROVIDER_${provider._id.toString()}`;

  if (initialBalance <= 0) {
    provider.$locals.walletLedgerAuthorized = true;
    provider.wallet_initialized = true;
    await provider.save();

    await WalletAuditLog.create({
      provider_id: provider._id,
      providerId: provider._id,
      action: 'WALLET_INITIALIZED',
      transaction_type: 'initial_credit',
      amount: 0,
      balance_before: 0,
      balance_after: 0,
      previousBalance: 0,
      newBalance: 0,
      source: WalletSource.SYSTEM_JOB,
      actor_type: 'system',
      reason,
      remarks: 'Non-financial wallet initialization record',
      reference_id: referenceId,
      transactionRefId: referenceId,
      ip_address: '127.0.0.1',
      status: 'Active',
      approvalStatus: 'approved'
    }).catch(console.error);

    return provider;
  }

  const result = await recordWalletChangeAndAudit({
    providerId: provider._id,
    amount: initialBalance,
    type: 'initial_credit',
    action: 'WALLET_INITIALIZED',
    source: WalletSource.SYSTEM_JOB,
    reason,
    remarks: 'One-time initial registration balance credit',
    referenceId,
  });

  return result.provider;
};

/**
 * Administrative Reset Endpoint
 */
export const adminResetWalletBalance = async (
  providerId: string | Types.ObjectId,
  adminUser: { _id?: any; name?: string; role?: string; admin_role?: string },
  reason: string = 'Administrative Balance Reset'
) => {
  const provider = await Provider.findById(providerId);
  if (!provider) throw new Error('Provider not found');

  const currentBalance = provider.walletBalance || 0;
  if (currentBalance === 0) {
    return getWalletSummary(provider);
  }

  const refId = `ADMIN_RESET_${provider._id}_${Date.now()}`;

  const result = await recordWalletChangeAndAudit({
    providerId: provider._id,
    amount: Math.abs(currentBalance),
    type: currentBalance > 0 ? 'debit' : 'credit',
    action: 'ADMIN_RESET',
    source: WalletSource.ADMIN_PANEL,
    actorType: 'admin',
    actorId: adminUser?._id ? String(adminUser._id) : undefined,
    adminUser,
    reason,
    remarks: `Administrative balance adjustment from ₹${currentBalance} to ₹0`,
    referenceId: refId,
  });

  return result.summary;
};

/**
 * Authorised path to change a provider's creditLimit.
 */
export const setCreditLimit = async (
  providerId: string | Types.ObjectId,
  newLimit: number,
  adminUser: { _id?: any; name?: string; role?: string; admin_role?: string },
  reason: string
) => {
  const provider = await Provider.findById(providerId);
  if (!provider) throw new Error('Provider not found');

  const previousLimit = provider.creditLimit || 0;
  if (previousLimit === newLimit) return getWalletSummary(provider);

  const refId = `CREDIT_LIMIT_${provider._id}_${Date.now()}`;

  provider.$locals.walletLedgerAuthorized = true;
  provider.creditLimit = newLimit;
  await provider.save();

  await WalletAuditLog.create({
    provider_id: provider._id,
    providerId: provider._id,
    action: 'CREDIT_LIMIT_CHANGE',
    transaction_type: 'adjustment',
    amount: Math.abs(newLimit - previousLimit),
    balance_before: previousLimit,
    balance_after: newLimit,
    previousBalance: previousLimit,
    newBalance: newLimit,
    source: WalletSource.ADMIN_PANEL,
    actor_type: 'admin',
    actor_id: adminUser?._id ? String(adminUser._id) : undefined,
    adminId: adminUser?._id,
    adminName: adminUser?.name || 'Admin',
    adminRole: adminUser?.admin_role || adminUser?.role || 'super_admin',
    reason,
    remarks: `Credit limit updated from ₹${previousLimit} to ₹${newLimit}`,
    reference_id: refId,
    transactionRefId: refId,
    ip_address: '127.0.0.1',
    status: 'Active',
    approvalStatus: 'approved',
  });

  return getWalletSummary(provider);
};
