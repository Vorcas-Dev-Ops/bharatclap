import mongoose, { Types } from 'mongoose';
import { Provider } from '../models/Provider';
import { WalletTransaction } from '../models/WalletTransaction';
import { WalletAuditLog } from '../models/WalletAuditLog';
import { emitToUser } from './socketService';

export interface RecordWalletOptions {
  providerId: string | Types.ObjectId;
  amount: number;
  type: 'recharge' | 'deduction' | 'refund' | 'hold' | 'release' | 'credit' | 'debit' | 'initial_credit';
  action: string;
  source: 'System' | 'Admin' | 'Razorpay' | 'Booking' | 'Refund' | 'Subscription';
  reason: string;
  remarks?: string;
  adminUser?: { _id?: any; name?: string; role?: string; admin_role?: string };
  referenceId: string;
  bookingId?: string;
  paymentId?: string;
  ipAddress?: string;
  skipSocket?: boolean;
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

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Update Provider
      provider.walletBalance = newBalance;
      if (type === 'initial_credit' || action === 'Initial Credit') {
        provider.wallet_initialized = true;
      }
      await provider.save({ session });

      // Create WalletTransaction
      await WalletTransaction.create(
        [
          {
            provider_id: provider._id,
            type,
            amount: numericAmount,
            balanceAfter: newBalance,
            referenceId,
            description: `${reason}${remarks ? ': ' + remarks : ''}`,
            status: 'success',
          },
        ],
        { session }
      );

      // Create WalletAuditLog
      const adminName = adminUser?.name || (source === 'Admin' ? 'Admin' : 'System');
      const adminRole = adminUser?.admin_role || adminUser?.role || (source === 'Admin' ? 'super_admin' : 'system');

      await WalletAuditLog.create(
        [
          {
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
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  if (!skipSocket && provider.user_id) {
    try {
      emitToUser(String(provider.user_id), 'wallet_balance_updated', {
        walletBalance: newBalance,
        reservedBalance: provider.reservedBalance || 0,
        availableBalance: newBalance - (provider.reservedBalance || 0),
        referenceId,
        action,
      });
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
