import mongoose, { ClientSession, Types } from 'mongoose';
import { LeadPackageOrder, ILeadPackageOrder } from '../models/LeadPackageOrder';
import { LeadTransaction } from '../models/LeadTransaction';
import { LeadReservation } from '../models/LeadReservation';
import { Provider } from '../models/Provider';
import { LeadFeeConfig } from '../models/LeadFeeConfig';
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

/**
 * Migration-on-read query filter for active lead packages.
 * Matches orders explicitly marked as ACTIVE or legacy success orders without status.
 */
const getActivePackagesQuery = (providerId: Types.ObjectId | string, now: Date = new Date()) => ({
  provider_id: providerId,
  leadsRemaining: { $gt: 0 },
  $or: [
    { status: 'ACTIVE' },
    { status: { $exists: false }, paymentStatus: 'success' },
    { status: null, paymentStatus: 'success' },
  ],
  $and: [
    { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] }
  ]
});

/**
 * 1. Reserve Lead — Two-Phase Commit Phase 1
 */
export const reserveLead = async (
  providerId: Types.ObjectId | string,
  bookingId: string
) => {
  const now = new Date();
  const activeOrder = await LeadPackageOrder.findOne(getActivePackagesQuery(providerId, now))
    .sort({ expiresAt: 1, createdAt: 1, _id: 1 });

  if (!activeOrder) {
    return null;
  }

  const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const expiresAt = new Date(now.getTime() + 60 * 1000); // 60 seconds TTL

  const reservation = await LeadReservation.create({
    reservation_id: reservationId,
    provider_id: providerId,
    package_order_id: activeOrder._id,
    booking_id: bookingId,
    status: 'RESERVED',
    expires_at: expiresAt,
  });

  return reservation;
};

/**
 * Helper to emit WebSocket lead balance update payload
 */
export const broadcastLeadBalanceUpdate = async (providerId: Types.ObjectId | string) => {
  try {
    const provider = await Provider.findById(providerId);
    if (!provider) return;

    const balanceInfo = await getLeadBalance(provider._id);
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

/**
 * 2. Commit Deduction — Two-Phase Commit Phase 2
 */
export const commitDeduction = async (
  reservationId: string,
  bookingId: string,
  session?: ClientSession
) => {
  const reservation = await LeadReservation.findOne({ reservation_id: reservationId, status: 'RESERVED' });
  if (!reservation) {
    throw new Error('Valid lead reservation not found or expired');
  }

  // FEFO optimistic concurrency deduction ($inc: -1)
  const updatedOrder = await LeadPackageOrder.findOneAndUpdate(
    {
      _id: reservation.package_order_id,
      leadsRemaining: { $gte: 1 },
    },
    {
      $inc: { leadsRemaining: -1 },
    },
    { new: true, session }
  );

  if (!updatedOrder) {
    reservation.status = 'RELEASED';
    await reservation.save({ session });
    throw new Error('Lead package has no remaining leads available');
  }

  // Update status to LEADS_EXHAUSTED if 0 remaining
  if (updatedOrder.leadsRemaining === 0) {
    updatedOrder.status = 'LEADS_EXHAUSTED';
    await updatedOrder.save({ session });
  } else if (!updatedOrder.status || updatedOrder.status === 'PENDING_ACTIVATION') {
    updatedOrder.status = 'ACTIVE';
    await updatedOrder.save({ session });
  }

  reservation.status = 'COMMITTED';
  await reservation.save({ session });

  // Calculate current total balance after deduction
  const now = new Date();
  const activeOrders = await LeadPackageOrder.find(getActivePackagesQuery(reservation.provider_id, now)).session(session || null);
  const balanceAfter = activeOrders.reduce((sum, o) => sum + o.leadsRemaining, 0);
  const balanceBefore = balanceAfter + 1;

  const idempotencyKey = `deduct_${bookingId}_${reservation.provider_id}`;
  
  await LeadTransaction.create(
    [
      {
        provider_id: reservation.provider_id,
        package_order_id: updatedOrder._id,
        type: 'deduction',
        leadAmount: 1,
        balance_before: balanceBefore,
        balanceAfter: balanceAfter,
        idempotency_key: idempotencyKey,
        referenceId: bookingId,
        description: `1 Lead deducted for booking acceptance #${bookingId}`,
      },
    ],
    { session }
  );

  // Trigger Low Lead Balance / Exhaustion Alerts
  const provider = await Provider.findById(reservation.provider_id).session(session || null);
  if (provider) {
    if (balanceAfter === 0) {
      emitToUser(String(provider.user_id), 'PACKAGE_EXHAUSTED', {
        title: 'Lead Package Exhausted',
        message: 'Your lead balance has reached 0. Recharge a lead package to continue receiving new customer bookings.',
        remainingLeads: 0,
      });
    } else {
      const thresholds = [20, 10, 5, 1];
      if (thresholds.includes(balanceAfter) && provider.lastLeadNotificationThreshold !== balanceAfter) {
        provider.lastLeadNotificationThreshold = balanceAfter;
        await provider.save({ session });
        emitToUser(String(provider.user_id), 'provider_notification', {
          title: 'Low Lead Balance Alert',
          message: `Your lead balance is low. Only ${balanceAfter} lead${balanceAfter > 1 ? 's are' : ' is'} remaining.`,
          remainingLeads: balanceAfter,
        });
      }
    }
  }

  // Broadcast WebSocket update
  broadcastLeadBalanceUpdate(reservation.provider_id);

  return { success: true, balanceAfter, packageId: updatedOrder._id };
};

/**
 * 3. Atomic Lead Deduction or Hybrid Wallet Fallback
 */
export const deductLeadOrWallet = async (
  providerId: Types.ObjectId | string,
  bookingId: string,
  subserviceId?: string,
  session?: ClientSession
) => {
  const now = new Date();
  
  // Try FEFO lead package deduction first
  const reservation = await reserveLead(providerId, bookingId);
  if (reservation) {
    try {
      const result = await commitDeduction(reservation.reservation_id, bookingId, session);
      return { type: 'lead_package', ...result };
    } catch (err: any) {
      console.warn(`[LEAD_SERVICE] Reservation commit failed, falling back: ${err.message}`);
    }
  }

  // No active lead package -> Hybrid Wallet Fallback
  const provider = await Provider.findById(providerId).session(session || null);
  if (!provider) {
    throw new Error('Provider profile not found');
  }

  // Check free access
  const isFreeAccessActive =
    provider.isFreeAccessEnabled ||
    provider.subscriptionStatus === 'active' ||
    (provider.freeAccessEndDate && new Date(provider.freeAccessEndDate) >= now) ||
    (provider.gracePeriodEndDate && new Date(provider.gracePeriodEndDate) >= now);

  if (isFreeAccessActive) {
    return { type: 'free_access', success: true };
  }

  // Determine cash lead fee
  let leadFee = 100;
  if (subserviceId && mongoose.Types.ObjectId.isValid(subserviceId)) {
    const feeConfig = await LeadFeeConfig.findOne({ subservice_id: subserviceId }).session(session || null);
    if (feeConfig) leadFee = feeConfig.lead_fee;
  }

  const availableCredit = (provider.walletBalance || 0) - (provider.reservedBalance || 0) + (provider.creditLimit || 0);
  if (availableCredit < leadFee) {
    throw new Error(`Deduction rejected: insufficient balance/credit to cover ₹${leadFee} lead fee.`);
  }

  // 1. Write to Wallet Ledger (Cash deduction)
  await recordWalletChangeAndAudit({
    providerId: provider._id,
    amount: leadFee,
    type: 'deduction',
    action: 'Lead Fee Deduction',
    source: 'Booking',
    reason: `Lead fee deduction (wallet fallback) for booking #${bookingId}`,
    referenceId: String(bookingId),
    bookingId: String(bookingId),
    session,
    skipSocket: true,
  });

  // 2. Write to Lead Ledger (Hybrid wallet record)
  const activeOrders = await LeadPackageOrder.find(getActivePackagesQuery(provider._id, now)).session(session || null);
  const currentLeadBalance = activeOrders.reduce((sum, o) => sum + o.leadsRemaining, 0);

  const idempotencyKey = `deduct_wallet_${bookingId}_${provider._id}`;
  await LeadTransaction.create(
    [
      {
        provider_id: provider._id,
        type: 'hybrid_wallet',
        leadAmount: 0,
        balance_before: currentLeadBalance,
        balanceAfter: currentLeadBalance,
        idempotency_key: idempotencyKey,
        referenceId: bookingId,
        description: `₹${leadFee} deducted from cash wallet (No active lead package available)`,
        metadata: { leadFeeDeducted: leadFee, subserviceId },
      },
    ],
    { session }
  );

  broadcastLeadBalanceUpdate(provider._id);

  return { type: 'hybrid_wallet', leadFee, success: true };
};

/**
 * 4. Stage-Based Lead Refund Matrix Enforcer
 */
export const refundLead = async (
  providerId: Types.ObjectId | string,
  bookingId: string,
  bookingStage: string,
  cancelledBy: 'customer' | 'provider' | 'admin',
  correlationId?: string,
  idempotencyKey?: string
) => {
  const idKey = idempotencyKey || `refund_${bookingId}`;

  // Idempotency check
  const existingTx = await LeadTransaction.findOne({ idempotency_key: idKey });
  if (existingTx) {
    return { success: true, duplicate: true, transaction: existingTx };
  }

  // Determine stage-based eligibility
  // Stage Matrix:
  // - Customer cancels before start traveling ('pending', 'provider_searching', 'confirmed', 'accepted') -> ✅ Refund
  // - Customer cancels after provider traveling/arrived ('on_the_way', 'arrived', 'reached', 'in_progress', 'waiting_start_otp') -> ❌ No refund
  // - Admin cancels before service started -> ✅ Refund
  // - Provider cancels -> ❌ No refund (provider penalty)
  let eligible = false;
  let reason = '';

  const preTravelStages = ['pending', 'provider_searching', 'confirmed', 'accepted'];

  if (cancelledBy === 'admin' && bookingStage !== 'in_progress' && bookingStage !== 'completed') {
    eligible = true;
    reason = 'Admin cancellation prior to service start';
  } else if (cancelledBy === 'customer') {
    if (preTravelStages.includes(bookingStage)) {
      eligible = true;
      reason = 'Customer cancelled before provider travel';
    } else {
      eligible = false;
      reason = `Customer cancelled at stage '${bookingStage}' (travel/arrival already committed)`;
    }
  } else {
    eligible = false;
    reason = `Cancelled by ${cancelledBy} — lead refund forfeited`;
  }

  if (!eligible) {
    return { success: false, refunded: false, reason };
  }

  // Find original deduction transaction
  const origDeduction = await LeadTransaction.findOne({
    referenceId: String(bookingId),
    type: { $in: ['deduction', 'hybrid_wallet'] },
  });

  if (!origDeduction) {
    return { success: false, refunded: false, reason: 'Original deduction record not found' };
  }

  // If original was hybrid wallet cash deduction, refund to wallet
  if (origDeduction.type === 'hybrid_wallet') {
    const feeAmount = origDeduction.metadata?.leadFeeDeducted || 100;
    await recordWalletChangeAndAudit({
      providerId: providerId,
      amount: feeAmount,
      type: 'recharge',
      action: 'Lead Fee Refund',
      source: 'Booking Cancellation',
      reason: `Lead fee refund for cancelled booking #${bookingId}`,
      referenceId: String(bookingId),
      bookingId: String(bookingId),
    });

    const now = new Date();
    const activeOrders = await LeadPackageOrder.find(getActivePackagesQuery(providerId, now));
    const currentLeadBalance = activeOrders.reduce((sum, o) => sum + o.leadsRemaining, 0);

    const tx = await LeadTransaction.create({
      provider_id: providerId,
      type: 'refund',
      leadAmount: 0,
      balance_before: currentLeadBalance,
      balanceAfter: currentLeadBalance,
      idempotency_key: idKey,
      correlation_id: correlationId,
      referenceId: String(bookingId),
      description: `₹${feeAmount} refunded to cash wallet for cancelled booking #${bookingId}`,
      metadata: { bookingStage, cancelledBy, refundType: 'cash_wallet' },
    });

    broadcastLeadBalanceUpdate(providerId);
    return { success: true, refunded: true, type: 'cash_wallet', transaction: tx };
  }

  // Original was lead package deduction -> refund 1 lead to the same package if active/exhausted
  const targetPackage = await LeadPackageOrder.findById(origDeduction.package_order_id);
  if (!targetPackage) {
    return { success: false, refunded: false, reason: 'Target lead package order no longer exists' };
  }

  // If package is expired, leads lapse (no refund to expired packages per spec)
  if (targetPackage.status === 'EXPIRED' || (targetPackage.expiresAt && targetPackage.expiresAt < new Date())) {
    return { success: false, refunded: false, reason: 'Target package has expired — refunded leads lapsed' };
  }

  // Credit 1 lead back via findOneAndUpdate
  const updatedPackage = await LeadPackageOrder.findOneAndUpdate(
    { _id: targetPackage._id },
    {
      $inc: { leadsRemaining: 1 },
      $set: { status: 'ACTIVE' }, // Restore ACTIVE status if it was LEADS_EXHAUSTED
    },
    { new: true }
  );

  const now = new Date();
  const activeOrders = await LeadPackageOrder.find(getActivePackagesQuery(providerId, now));
  const balanceAfter = activeOrders.reduce((sum, o) => sum + o.leadsRemaining, 0);
  const balanceBefore = balanceAfter - 1;

  const tx = await LeadTransaction.create({
    provider_id: providerId,
    package_order_id: updatedPackage?._id,
    type: 'refund',
    leadAmount: 1,
    balance_before: balanceBefore,
    balanceAfter: balanceAfter,
    idempotency_key: idKey,
    correlation_id: correlationId,
    referenceId: String(bookingId),
    description: `1 Lead refunded to package "${updatedPackage?.packageName}" for cancelled booking #${bookingId}`,
    metadata: { bookingStage, cancelledBy, refundType: 'lead_package' },
  });

  broadcastLeadBalanceUpdate(providerId);

  return { success: true, refunded: true, type: 'lead_package', transaction: tx };
};

/**
 * 5. Expire Lapsed Packages (Cron Job Handler)
 */
export const expirePackages = async () => {
  try {
    const now = new Date();
    const expiredOrders = await LeadPackageOrder.find({
      expiresAt: { $ne: null, $lte: now },
      status: { $in: ['ACTIVE', 'PENDING_ACTIVATION'] },
      leadsRemaining: { $gt: 0 },
    });

    for (const order of expiredOrders) {
      const lapsedLeads = order.leadsRemaining;
      order.status = 'EXPIRED';
      await order.save();

      const activeOrders = await LeadPackageOrder.find(getActivePackagesQuery(order.provider_id, now));
      const balanceAfter = activeOrders.reduce((sum, o) => sum + o.leadsRemaining, 0);
      const balanceBefore = balanceAfter + lapsedLeads;

      await LeadTransaction.create({
        provider_id: order.provider_id,
        package_order_id: order._id,
        type: 'expiry',
        leadAmount: -lapsedLeads,
        balance_before: balanceBefore,
        balanceAfter: balanceAfter,
        idempotency_key: `expiry_${order._id}_${Date.now()}`,
        description: `Package "${order.packageName}" expired (${lapsedLeads} unused leads lapsed)`,
      });

      const provider = await Provider.findById(order.provider_id);
      if (provider) {
        emitToUser(String(provider.user_id), 'PACKAGE_EXPIRED', {
          title: 'Lead Package Expired',
          message: `Your lead package "${order.packageName}" has expired. ${lapsedLeads} leads have lapsed.`,
          expiredPackage: order.packageName,
        });
      }

      broadcastLeadBalanceUpdate(order.provider_id);
    }
  } catch (err: any) {
    console.error('[LEAD_SERVICE] Package expiry cron error:', err.message);
  }
};

/**
 * 6. Release Expired Stale Lead Reservations
 */
export const releaseExpiredReservations = async () => {
  try {
    const now = new Date();
    await LeadReservation.updateMany(
      { status: 'RESERVED', expires_at: { $lte: now } },
      { $set: { status: 'RELEASED' } }
    );
  } catch (err: any) {
    console.error('[LEAD_SERVICE] Reservation cleanup error:', err.message);
  }
};

/**
 * 7. Get Lead Balance & Multi-Window Burn Rate Summary
 */
export const getLeadBalance = async (providerId: Types.ObjectId | string): Promise<LeadBalanceInfo> => {
  const now = new Date();
  const activeOrders = await LeadPackageOrder.find(getActivePackagesQuery(providerId, now))
    .sort({ expiresAt: 1, createdAt: 1 })
    .lean();

  const totalLeadsRemaining = activeOrders.reduce((sum, o) => sum + o.leadsRemaining, 0);
  const hasPriorityDispatch = activeOrders.some((o) => o.hasPriorityDispatch);

  // Multi-window burn rates (deductions count / days)
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [count7d, count30d, countLifetime, oldestTx] = await Promise.all([
    LeadTransaction.countDocuments({ provider_id: providerId, type: 'deduction', createdAt: { $gte: d7 } }),
    LeadTransaction.countDocuments({ provider_id: providerId, type: 'deduction', createdAt: { $gte: d30 } }),
    LeadTransaction.countDocuments({ provider_id: providerId, type: 'deduction' }),
    LeadTransaction.findOne({ provider_id: providerId, type: 'deduction' }).sort({ createdAt: 1 }).lean(),
  ]);

  const burnRate7d = Math.round((count7d / 7) * 100) / 100;
  const burnRate30d = Math.round((count30d / 30) * 100) / 100;

  let lifetimeDays = 1;
  if (oldestTx && oldestTx.createdAt) {
    const diffMs = now.getTime() - new Date(oldestTx.createdAt).getTime();
    lifetimeDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }
  const burnRateLifetime = Math.round((countLifetime / lifetimeDays) * 100) / 100;

  const activeBurnRate = burnRate7d > 0 ? burnRate7d : (burnRate30d > 0 ? burnRate30d : burnRateLifetime);
  const estimatedDaysRemaining = activeBurnRate > 0 ? Math.ceil(totalLeadsRemaining / activeBurnRate) : null;

  return {
    leadBalance: totalLeadsRemaining,
    hasPriorityDispatch,
    activePackages: activeOrders,
    burnRate7d,
    burnRate30d,
    burnRateLifetime,
    estimatedDaysRemaining,
    walletFallbackAvailable: true,
  };
};
