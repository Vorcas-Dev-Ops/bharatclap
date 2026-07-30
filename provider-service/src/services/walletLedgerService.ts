import mongoose, { Types } from 'mongoose';
import { Provider, IProvider } from '../models/Provider';
import { WalletTransaction } from '../models/WalletTransaction';
import { WalletAuditLog } from '../models/WalletAuditLog';
import { emitToUser } from './socketService';

// ─────────────────────────────────────────────────────────────────────────────
// Single canonical wallet summary type.
// Every controller/API/socket event MUST return this shape — never recompute.
// ─────────────────────────────────────────────────────────────────────────────
export interface WalletSummary {
  walletBalance: number;
  reservedBalance: number;
  creditLimit: number;
  availableBalance: number;  // walletBalance - reservedBalance
  availableCredit: number;   // availableBalance + creditLimit
}

export const getWalletSummary = (provider: Pick<IProvider, 'walletBalance' | 'reservedBalance' | 'creditLimit'>): WalletSummary => {
  const walletBalance   = provider.walletBalance   || 0;
  const reservedBalance = provider.reservedBalance || 0;
  const creditLimit     = provider.creditLimit     || 0;
  return {
    walletBalance,
    reservedBalance,
    creditLimit,
    availableBalance: walletBalance - reservedBalance,
    availableCredit:  walletBalance - reservedBalance + creditLimit,
  };
};

export interface RecordWalletOptions {
  providerId: string | Types.ObjectId;
  amount: number;
  type: 'recharge' | 'deduction' | 'refund' | 'hold' | 'release' | 'credit' | 'debit' | 'initial_credit';
  action: string;
  source: 'System' | 'Admin' | 'Razorpay' | 'Booking' | 'Refund' | 'Subscription' | 'Referral';
  reason: string;
  remarks?: string;
  adminUser?: { _id?: any; name?: string; role?: string; admin_role?: string };
  referenceId: string;
  bookingId?: string;
  paymentId?: string;
  ipAddress?: string;
  skipSocket?: boolean;
  /** Optional Mongoose session — used when called inside an existing transaction */
  session?: mongoose.ClientSession;
}

export const recordWalletChangeAndAudit = async (options: RecordWalletOptions) => {
  const {
    providerId,
    amount,
    type,
    action,
    source,
    reason,
    remarks,
    adminUser,
    referenceId,
    bookingId,
    paymentId,
    ipAddress,
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

  const runInTransaction = async (session: mongoose.ClientSession) => {
    // walletLedgerService is the ONLY authorised writer of walletBalance/creditLimit.
    // The $locals flag tells the Provider pre-save guard this write is legitimate.
    provider.$locals.walletLedgerAuthorized = true;
    provider.walletBalance = newBalance;
    if (type === 'initial_credit' || action === 'Initial Credit') {
      provider.wallet_initialized = true;
    }
    await provider.save({ session });

    // Create WalletTransaction
    await WalletTransaction.create(
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

    // Create WalletAuditLog
    const adminName = adminUser?.name || (source === 'Admin' ? 'Admin' : 'System');
    const adminRole = adminUser?.admin_role || adminUser?.role || (source === 'Admin' ? 'super_admin' : 'system');

    await WalletAuditLog.create(
      [{
        transactionRefId: referenceId,
        date: new Date(),
        source,
        adminId: adminUser?._id || undefined,
        adminName,
        adminRole,
        providerId: provider._id,
        providerName: (provider as any).user_id?.name || (provider as any).name || 'Service Expert',
        action,
        amount: numericAmount,
        previousBalance,
        newBalance,
        reason,
        remarks: remarks || reason,
        bookingId,
        paymentId,
        ipAddress: ipAddress || '127.0.0.1',
        status: 'Active',
        approvalStatus: 'approved',
      }],
      { session }
    );
  };

  if (externalSession) {
    // Caller already owns a transaction — run inside it
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

  if (!skipSocket && provider.user_id) {
    try {
      emitToUser(String(provider.user_id), 'wallet_balance_updated', { ...summary, referenceId, action });
    } catch (err) {
      console.error('[SOCKET] Failed to emit wallet_balance_updated:', err);
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
 */
export const initializeProviderWalletOnce = async (
  providerId: string | Types.ObjectId,
  initialBalance: number = 0,
  reason: string = 'Initial Registration Wallet Balance'
) => {
  const provider = await Provider.findById(providerId);
  if (!provider) return null;

  if (provider.wallet_initialized) {
    return provider;
  }

  const referenceId = `INIT_PROVIDER_${provider._id.toString()}`;

  // If initial balance is 0, simply mark as initialized without creating a ₹0 transaction entry
  if (initialBalance <= 0) {
    provider.wallet_initialized = true;
    await provider.save();
    return provider;
  }

  const result = await recordWalletChangeAndAudit({
    providerId: provider._id,
    amount: initialBalance,
    type: 'initial_credit',
    action: 'Initial Credit',
    source: 'System',
    reason,
    remarks: 'One-time initial registration credit',
    referenceId,
  });

  return result.provider;
};

/**
 * The ONLY authorised path to change a provider's creditLimit.
 * Creates a WalletAuditLog entry for every change.
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

  // Authorise this write via the $locals flag
  provider.$locals.walletLedgerAuthorized = true;
  provider.creditLimit = newLimit;
  await provider.save();

  // Audit log (no WalletTransaction — this is a limit change, not a balance change)
  await WalletAuditLog.create({
    transactionRefId: refId,
    date: new Date(),
    source: 'Admin',
    adminId: adminUser?._id,
    adminName: adminUser?.name || 'Admin',
    adminRole: adminUser?.admin_role || adminUser?.role || 'super_admin',
    providerId: provider._id,
    providerName: 'Service Expert',
    action: 'Credit Limit Change',
    amount: Math.abs(newLimit - previousLimit),
    previousBalance: previousLimit,
    newBalance: newLimit,
    reason,
    remarks: `Credit limit changed from ₹${previousLimit} to ₹${newLimit}`,
    ipAddress: '127.0.0.1',
    status: 'Active',
    approvalStatus: 'approved',
  });

  return getWalletSummary(provider);
};
