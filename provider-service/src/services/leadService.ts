import { getDb } from '../config/db';
import { recordWalletChangeAndAudit } from './walletLedgerService';
import { emitToUser } from './socketService';

export interface LeadBalanceInfo {
  leadBalance: number;
  hasPriorityDispatch: boolean;
  activePackages: any[];
  burnRate7d: number;
  burnRate30d: number;
  burnRateLifetime: number;
  estimatedDaysRemaining: number | null;
  walletFallbackAvailable: boolean;
}

export const reserveLead = async (
  providerId: string,
  bookingId: string
) => {
  const db = getDb();
  const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const res = await db.query(
      `INSERT INTO provider.lead_reservations (
         provider_id, booking_id, amount, status
       ) VALUES ($1, $2, 1, 'reserved')
       RETURNING *`,
      [providerId, bookingId]
    );
    return { ...res.rows[0], reservation_id: reservationId };
  } catch (_) {
    return null;
  }
};

export const broadcastLeadBalanceUpdate = async (providerId: string) => {
  try {
    const db = getDb();
    const provRes = await db.query(
      `SELECT user_id, wallet_balance, reserved_balance, credit_limit FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [providerId]
    );
    const provider = provRes.rows[0];
    if (!provider) return;

    const balanceInfo = await getLeadBalance(providerId);
    emitToUser(String(provider.user_id), 'LEAD_BALANCE_UPDATED', {
      leadBalance: balanceInfo.leadBalance,
      remainingLeads: balanceInfo.leadBalance,
      activePackage: balanceInfo.activePackages[0]?.packageName || null,
      packageStatus: balanceInfo.activePackages[0]?.status || (balanceInfo.leadBalance > 0 ? 'ACTIVE' : 'LEADS_EXHAUSTED'),
      walletFallback: balanceInfo.leadBalance === 0,
      burnRate7d: balanceInfo.burnRate7d,
      estimatedDaysRemaining: balanceInfo.estimatedDaysRemaining,
    });
  } catch (err: any) {
    console.error('[LEAD_SERVICE] WebSocket broadcast failed:', err.message);
  }
};

export const commitDeduction = async (
  reservationId: string,
  bookingId: string
) => {
  const db = getDb();
  await db.query(
    `UPDATE provider.lead_reservations
     SET status = 'committed',
         updated_at = NOW()
     WHERE (booking_id::text = $1 OR id::text = $1)
       AND status = 'reserved'`,
    [bookingId]
  );
  return { success: true };
};

export const deductLeadOrWallet = async (
  providerId: string,
  bookingId: string,
  subserviceId?: string,
  reservationId?: string
) => {
  const db = getDb();
  // Get fee config
  let fee = 100;
  if (subserviceId) {
    const feeRes = await db.query(
      `SELECT fee_amount FROM provider.lead_fee_configs WHERE category_id::text = $1 LIMIT 1`,
      [subserviceId]
    );
    if (feeRes.rows[0]) fee = Number(feeRes.rows[0].fee_amount);
  }

  // Deduct from wallet via ledger
  await recordWalletChangeAndAudit({
    providerId,
    amount: fee,
    type: 'deduction',
    action: 'Lead Fee Deduction',
    referenceType: 'LEAD_FEE_HOLD',
    source: 'System',
    reason: `Lead fee deduction for booking #${bookingId}`,
    referenceId: String(bookingId)
  });

  return { success: true, method: 'wallet', amount: fee };
};

export const refundLead = async (
  providerId: string,
  bookingId: string,
  reason: string = 'Provider Reassignment',
  bookingStage?: string,
  cancelledBy?: string,
  correlationId?: string,
  idempotencyKey?: string
) => {
  const db = getDb();
  const bkRef = String(bookingId);

  // Guard 1: Must have a prior deduction for this booking
  const txRes = await db.query(
    `SELECT amount FROM provider.wallet_transactions
     WHERE provider_id::text = $1 AND type = 'deduction' AND reference_id = $2
     LIMIT 1`,
    [providerId, bkRef]
  );
  const tx = txRes.rows[0];
  if (!tx) {
    // ponytail: no deduction → no refund. Don't create money from nothing.
    console.warn(`[LEAD_SERVICE] refundLead rejected: no deduction for provider=${providerId} booking=${bkRef}`);
    return { success: false, refundedAmount: 0, reason: 'no_prior_deduction' };
  }

  // Guard 2: Already refunded? (explicit check before hitting uniqueness constraint)
  const existingRefund = await db.query(
    `SELECT id FROM provider.wallet_transactions
     WHERE provider_id::text = $1 AND reference_type = 'LEAD_FEE_REFUND' AND reference_id = $2
     LIMIT 1`,
    [providerId, bkRef]
  );
  if (existingRefund.rows[0]) {
    console.warn(`[LEAD_SERVICE] refundLead idempotent: already refunded for provider=${providerId} booking=${bkRef}`);
    return { success: true, refundedAmount: 0, reason: 'already_refunded' };
  }

  const refundAmount = Number(tx.amount);

  // Guard 3: Sanity — refund amount must be positive and match original deduction
  if (!refundAmount || refundAmount <= 0) {
    console.warn(`[LEAD_SERVICE] refundLead rejected: invalid amount=${refundAmount} for provider=${providerId} booking=${bkRef}`);
    return { success: false, refundedAmount: 0, reason: 'invalid_amount' };
  }

  // recordWalletChangeAndAudit has composite uniqueness (LEAD_FEE_REFUND, bookingId) as DB backstop
  await recordWalletChangeAndAudit({
    providerId,
    amount: refundAmount,
    type: 'refund',
    action: 'Lead Fee Refund',
    referenceType: 'LEAD_FEE_REFUND',
    source: 'System',
    reason: `Refund lead fee: ${reason}`,
    referenceId: bkRef
  });

  return { success: true, refundedAmount: refundAmount };
};

export const expirePackages = async () => {
  const db = getDb();
  const res = await db.query(
    `UPDATE provider.lead_package_orders
     SET status = 'expired',
         updated_at = NOW()
     WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 days'`
  );
  return { expiredCount: res.rowCount || 0 };
};

export const releaseExpiredReservations = async () => {
  const db = getDb();
  const res = await db.query(
    `UPDATE provider.lead_reservations
     SET status = 'expired',
         updated_at = NOW()
     WHERE status = 'reserved' AND created_at < NOW() - INTERVAL '5 minutes'`
  );
  return { releasedCount: res.rowCount || 0 };
};

export const getLeadBalance = async (providerId: string): Promise<LeadBalanceInfo> => {
  const db = getDb();
  const pRes = await db.query(
    `SELECT wallet_balance, reserved_balance, credit_limit, is_wallet_blocked FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1`,
    [providerId]
  );
  const p = pRes.rows[0] || {};
  const walletBal = (Number(p.wallet_balance) || 0) - (Number(p.reserved_balance) || 0) + (Number(p.credit_limit) || 0);

  return {
    leadBalance: Math.max(0, Math.floor(walletBal / 100)),
    hasPriorityDispatch: false,
    activePackages: [],
    burnRate7d: 1,
    burnRate30d: 5,
    burnRateLifetime: 20,
    estimatedDaysRemaining: 30,
    walletFallbackAvailable: !p.is_wallet_blocked && walletBal >= 100,
  };
};
