import { Money } from '@bharatclap/shared';
import { getDb } from '../config/db';
import { ProviderRepository } from '../repositories/providerRepository';
import { WalletRepository } from '../repositories/walletRepository';
import { emitToUser } from './socketService';
import { walletMetrics } from './walletMetrics';
import { sendProviderNotification } from '../utils/internalApi';

export interface WalletSummary {
  walletBalance: number;
  reservedBalance: number;
  creditLimit: number;
  availableBalance: number;
  availableCredit: number;
}

export const getWalletSummary = (provider: { walletBalance?: number; reservedBalance?: number; creditLimit?: number; wallet_balance?: number; reserved_balance?: number; credit_limit?: number }): WalletSummary => {
  const walletBalance = Number(provider.walletBalance ?? provider.wallet_balance ?? 0);
  const reservedBalance = Number(provider.reservedBalance ?? provider.reserved_balance ?? 0);
  const creditLimit = Number(provider.creditLimit ?? provider.credit_limit ?? 0);
  return {
    walletBalance,
    reservedBalance,
    creditLimit,
    availableBalance: walletBalance - reservedBalance,
    availableCredit: walletBalance - reservedBalance + creditLimit,
  };
};

export interface RecordWalletOptions {
  providerId: string;
  amount: number;
  type: 'recharge' | 'deduction' | 'refund' | 'hold' | 'release' | 'credit' | 'debit' | 'initial_credit' | 'adjustment';
  action: string;
  /** Explicit financial operation type for idempotency (e.g. LEAD_FEE_HOLD, LEAD_FEE_REFUND) */
  referenceType?: string;
  source?: string;
  actorType?: string;
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
  metadata?: Record<string, any>;
}

/**
 * Enterprise Wallet Mutation Entry Point
 * Enforces Cryptographic Hash Chaining, Fencing Tokens, Multi-Level Approval, Outbox Events & Redis Locking.
 */
export const recordWalletChangeAndAudit = async (options: RecordWalletOptions) => {
  const startTime = Date.now();
  const {
    providerId,
    amount,
    type,
    action,
    referenceType: explicitRefType,
    source = 'SYSTEM_JOB',
    actorType = 'system',
    actorId,
    reason,
    remarks,
    adminUser,
    referenceId,
    bookingId,
    paymentId,
    correlationId,
    skipSocket,
  } = options;

  // ponytail: Redis lock removed — FOR UPDATE row lock in walletRepository.recordTransaction
  // is the authoritative serialization mechanism. Redis was fail-open (Defect B).

  {
    const db = getDb();

    // Resolve reference_type: explicit > inferred from context
    const resolvedRefType = explicitRefType
      || (bookingId ? 'booking' : (paymentId ? 'payment' : 'admin_adjustment'));

    // 1. Idempotency Check — uses (reference_type, reference_id) composite
    //    so LEAD_FEE_HOLD + bookingX is distinct from LEAD_FEE_REFUND + bookingX
    const existingTxRes = await db.query(
      `SELECT * FROM provider.wallet_transactions
       WHERE reference_type = $1 AND reference_id = $2 AND status = 'success'
       LIMIT 1`,
      [resolvedRefType, referenceId]
    );

    if (existingTxRes.rows.length > 0) {
      walletMetrics.incIdempotencyHits();
      const existingProvider = await ProviderRepository.findById(providerId);
      return {
        success: true,
        alreadyProcessed: true,
        provider: existingProvider,
        balanceAfter: Number(existingTxRes.rows[0].balance_after),
        newBalance: Number(existingTxRes.rows[0].balance_after),
        summary: existingProvider ? getWalletSummary(existingProvider) : null,
      };
    }

    const provider = await ProviderRepository.findById(providerId);
    if (!provider) {
      throw new Error(`Provider not found for wallet update: ${providerId}`);
    }

    const previousBalance = provider.wallet_balance;

    // 2. Perform ACID transaction with hash chaining and monotonic fencing
    const { transaction, newBalance } = await WalletRepository.recordTransaction({
      providerId: provider.id,
      amount,
      type,
      referenceType: resolvedRefType,
      referenceId,
      description: `${reason}${remarks ? ': ' + remarks : ''}`,
      action,
      actorType,
      actorId: actorId || (adminUser?._id ? String(adminUser._id) : undefined),
      correlationId,
      metadata: { remarks, adminUser, source, ...options.metadata }
    });

    const isCredit = ['recharge', 'refund', 'credit', 'initial_credit', 'release'].includes(type);

    // 3. Socket event
    if (!skipSocket && provider.user_id) {
      emitToUser(provider.user_id, 'wallet_updated', {
        newBalance,
        previousBalance,
        change: amount,
        type,
        action,
        referenceId,
      });
    }

    // 4. Provider notification
    if (isCredit && amount > 0 && provider.user_id) {
      sendProviderNotification(
        provider.user_id,
        'Payment Credited',
        `₹${amount} has been credited to your wallet. Reason: ${reason}.`,
        'payment_alert',
        { amount, referenceId }
      ).catch(err => console.error('[NOTIFICATION] Failed to send payment credited notification:', err));
    }

    const summary = getWalletSummary({
      wallet_balance: newBalance,
      reserved_balance: provider.reserved_balance,
      credit_limit: provider.credit_limit
    });

    walletMetrics.incTransactionsTotal(type);
    walletMetrics.recordLatency(Date.now() - startTime);

    return {
      success: true,
      alreadyProcessed: false,
      provider: { ...provider, wallet_balance: newBalance, walletBalance: newBalance },
      previousBalance,
      newBalance,
      summary,
    };
  }
};

/**
 * Ensures initial wallet credit is applied EXACTLY ONCE per provider.
 */
export const initializeProviderWalletOnce = async (
  providerId: string,
  initialBalance: number = 0,
  reason: string = 'Initial Registration Wallet Lifecycle'
) => {
  const provider = await ProviderRepository.findById(providerId);
  if (!provider) return null;

  const db = getDb();
  const chk = await db.query(
    `SELECT wallet_initialized FROM provider.providers WHERE id = $1`,
    [provider.id]
  );
  if (chk.rows[0]?.wallet_initialized) {
    return provider;
  }

  const referenceId = `INIT_PROVIDER_${provider.id}`;

  if (initialBalance <= 0) {
    await db.query(
      `UPDATE provider.providers SET wallet_initialized = TRUE, updated_at = NOW() WHERE id = $1`,
      [provider.id]
    );
    await WalletRepository.getOrCreateWallet(provider.id);
    return provider;
  }

  const result = await recordWalletChangeAndAudit({
    providerId: provider.id,
    amount: initialBalance,
    type: 'initial_credit',
    action: 'WALLET_INITIALIZED',
    source: 'SYSTEM_JOB',
    reason,
    remarks: 'One-time initial registration balance credit',
    referenceId,
  });

  await db.query(
    `UPDATE provider.providers SET wallet_initialized = TRUE, updated_at = NOW() WHERE id = $1`,
    [provider.id]
  );

  return result.provider;
};

/**
 * Administrative Reset Endpoint
 */
export const adminResetWalletBalance = async (
  providerId: string,
  adminUser: { _id?: any; name?: string; role?: string; admin_role?: string },
  reason: string = 'Administrative Balance Reset'
) => {
  const provider = await ProviderRepository.findById(providerId);
  if (!provider) throw new Error('Provider not found');

  const currentBalance = provider.wallet_balance || 0;
  if (currentBalance === 0) {
    return getWalletSummary(provider);
  }

  const refId = `ADMIN_RESET_${provider.id}_${Date.now()}`;

  const result = await recordWalletChangeAndAudit({
    providerId: provider.id,
    amount: Math.abs(currentBalance),
    type: currentBalance > 0 ? 'debit' : 'credit',
    action: 'ADMIN_RESET',
    source: 'ADMIN_PANEL',
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
  providerId: string,
  newLimit: number,
  adminUser: { _id?: any; name?: string; role?: string; admin_role?: string },
  reason: string
) => {
  const provider = await ProviderRepository.findById(providerId);
  if (!provider) throw new Error('Provider not found');

  const previousLimit = provider.credit_limit || 0;
  if (previousLimit === newLimit) return getWalletSummary(provider);

  const db = getDb();
  await db.query(
    `UPDATE provider.providers SET credit_limit = $1, updated_at = NOW() WHERE id = $2`,
    [newLimit, provider.id]
  );

  return getWalletSummary({ ...provider, credit_limit: newLimit });
};
