import mongoose, { Types } from 'mongoose';
import { Provider, IProvider } from '../models/Provider';
import { WalletTransaction } from '../models/WalletTransaction';
import { WalletAuditLog, WalletSource, ActorType } from '../models/WalletAuditLog';
import { emitToUser } from './socketService';

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

export const recordWalletChangeAndAudit = async (options: RecordWalletOptions) => {
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

  // 1. Idempotency Check: Prevent duplicate credits/debits for the same reference ID
  const existingTx = await WalletTransaction.findOne({ referenceId, status: 'success' }).lean();
  if (existingTx) {
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

  // 2. Wallet Validation: Business Rules Check
  if (!isCredit) {
    const availableCredit = newBalance - (provider.reservedBalance || 0) + (provider.creditLimit || 0);
    if (availableCredit < 0) {
      throw new Error(`Wallet debit rejected: balance would exceed credit limit of ₹${provider.creditLimit || 0}`);
    }
  }

  let createdTxId: Types.ObjectId | undefined;

  const runInTransaction = async (session: mongoose.ClientSession) => {
    // Authorize wallet update in pre-save guard
    provider.$locals.walletLedgerAuthorized = true;
    provider.walletBalance = newBalance;
    if (type === 'initial_credit' || action === 'WALLET_INITIALIZED') {
      provider.wallet_initialized = true;
    }
    await provider.save({ session });

    // 3. Create Immutable WalletTransaction
    const [newTx] = await WalletTransaction.create(
      [{
        provider_id: provider._id,
        type,
        amount: numericAmount,
        balanceAfter: newBalance,
        referenceId,
        description: `${reason}${remarks ? ': ' + remarks : ''}`,
        status: 'success',
      }],
      { session }
    );

    createdTxId = newTx._id;

    // 4. Create Immutable WalletAuditLog with full Metadata
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

  const summary = getWalletSummary({ walletBalance: newBalance, reservedBalance: provider.reservedBalance, creditLimit: provider.creditLimit });

  // 5. Publish WalletUpdated Domain Event
  if (!skipSocket && provider.user_id) {
    try {
      emitToUser(String(provider.user_id), 'wallet_updated', {
        ...summary,
        referenceId,
        action,
        amount: numericAmount,
        balanceAfter: newBalance,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[SOCKET] Failed to emit wallet_updated event:', err);
    }
  }

  return {
    success: true,
    alreadyProcessed: false,
    provider,
    previousBalance,
    newBalance,
    summary,
  };
};

/**
 * Ensures initial wallet credit is applied EXACTLY ONCE per provider.
 * Does NOT create a ₹0 WalletTransaction, but logs a non-financial WalletAuditLog entry.
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

    // Create non-financial immutable audit log for wallet lifecycle tracking
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
 * Administrative Reset Endpoint to set provider wallet to ₹0 with explicit adjustment transaction.
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
 * The ONLY authorised path to change a provider's creditLimit.
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
