import { Provider } from '../models/Provider';
import { ProviderReferral, ProviderReferralStatus } from '../models/ProviderReferral';
import { ProviderReferralCampaign, IProviderReferralCampaign } from '../models/ProviderReferralCampaign';
import { WalletTransaction } from '../models/WalletTransaction';
import { recordWalletChangeAndAudit } from './walletLedgerService';
import { getUsersBatch } from '../utils/internalApi';
import { eventBus, SYSTEM_EVENTS } from '../utils/eventBus';
import mongoose from 'mongoose';

/**
 * Generate 6-char random alphanumeric string (uppercase)
 */
const generateRandomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Get or generate a unique provider referral code & link
 */
export const getOrCreateProviderReferralCode = async (
  providerId: string
): Promise<{ referralCode: string; referralLink: string }> => {
  const provider = await Provider.findById(providerId);
  if (!provider) throw new Error('Provider not found');

  if (!provider.referral_code) {
    let code = `BCP-${generateRandomCode()}`;
    let isUnique = false;
    while (!isUnique) {
      const existing = await Provider.findOne({ referral_code: code });
      if (!existing) {
        isUnique = true;
      } else {
        code = `BCP-${generateRandomCode()}`;
      }
    }
    provider.referral_code = code;
    await provider.save();
  }

  const referralCode = provider.referral_code;
  const baseUrl = process.env.FRONTEND_URL || 'https://bharatclap.com';
  const referralLink = `${baseUrl}/provider/register?ref=${referralCode}`;

  return { referralCode, referralLink };
};

/**
 * Find highest priority active campaign matching current date
 */
export const getHighestPriorityActiveCampaign = async (): Promise<IProviderReferralCampaign | null> => {
  const now = new Date();
  const campaign = await ProviderReferralCampaign.findOne({
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .sort({ priority: -1 })
    .exec();

  return campaign;
};

/**
 * Register a provider referral with snapshotting and fraud checks
 */
export const registerProviderReferral = async (
  referredProviderId: string,
  referralCode: string
): Promise<{ success: boolean; message: string; referral?: any }> => {
  if (!referralCode || !referralCode.trim()) {
    return { success: false, message: 'No referral code provided' };
  }

  const cleanCode = referralCode.trim().toUpperCase();

  // Find referrer
  const referrer = await Provider.findOne({ referral_code: cleanCode });
  if (!referrer) {
    return { success: false, message: 'Invalid referral code' };
  }

  // 1. Anti-Fraud: Block Self-Referral
  if (String(referrer._id) === String(referredProviderId)) {
    return { success: false, message: 'Self-referral is strictly prohibited' };
  }

  const referredProvider = await Provider.findById(referredProviderId);
  if (!referredProvider) {
    return { success: false, message: 'Referred provider not found' };
  }

  // Check existing referral
  const existing = await ProviderReferral.findOne({ referredProviderId });
  if (existing) {
    return { success: false, message: 'Referral already recorded for this provider' };
  }

  // Select Highest Priority Active Campaign or Fallback Snapshot
  const activeCampaign = await getHighestPriorityActiveCampaign();

  const rewardAmount = activeCampaign ? activeCampaign.rewardAmount : 500;
  const rewardType = activeCampaign ? activeCampaign.rewardType : 'wallet_credit';
  const expiryDays = activeCampaign ? activeCampaign.expiryDays : 30;
  const qualificationRulesSnapshot = activeCampaign
    ? activeCampaign.qualificationRules
    : {
        minCompletedJobs: 1,
        minEarnings: 0,
        minRating: 0,
        kycRequired: true,
        starterKitRequired: false,
        walletActive: true,
      };

  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  // 2. Anti-Fraud: Cross-match mobile, PAN, Aadhaar, Bank Details
  const users = await getUsersBatch([referrer.user_id.toString(), referredProvider.user_id.toString()]);
  const referrerUser = users.find((u) => u._id === referrer.user_id.toString());
  const referredUser = users.find((u) => u._id === referredProvider.user_id.toString());

  let isFraud = false;
  let fraudReason = '';

  if (referrerUser?.phone && referredUser?.phone && referrerUser.phone === referredUser.phone) {
    isFraud = true;
    fraudReason = 'Duplicate mobile phone number match';
  } else if (
    (referrer as any).pan_number &&
    (referredProvider as any).pan_number &&
    (referrer as any).pan_number === (referredProvider as any).pan_number
  ) {
    isFraud = true;
    fraudReason = 'Duplicate PAN card match';
  } else if (
    (referrer as any).aadhaar_number &&
    (referredProvider as any).aadhaar_number &&
    (referrer as any).aadhaar_number === (referredProvider as any).aadhaar_number
  ) {
    isFraud = true;
    fraudReason = 'Duplicate Aadhaar card match';
  }

  const initialStatus: ProviderReferralStatus = isFraud ? 'fraud_review' : 'registered';

  const referral = await ProviderReferral.create({
    referrerProviderId: referrer._id,
    referredProviderId: referredProvider._id,
    referralCode: cleanCode,
    campaignId: activeCampaign ? activeCampaign._id : undefined,
    status: initialStatus,
    rewardAmount,
    rewardType,
    qualificationRulesSnapshot,
    expiresAt,
    failureReason: isFraud ? fraudReason : undefined,
  });

  // Link referred_by on provider
  referredProvider.referred_by = referrer._id;
  await referredProvider.save();

  if (isFraud) {
    console.warn(`[REFERRAL_FRAUD_FLAGGED] Referrer ${referrer._id} & Referred ${referredProvider._id}: ${fraudReason}`);
    return { success: true, message: 'Referral registered under admin fraud review', referral };
  }

  return { success: true, message: 'Referral applied successfully', referral };
};

/**
 * Update pipeline status when KYC, Starter Kit, or Job is completed
 */
export const evaluateReferralStatusPipeline = async (providerId: string): Promise<void> => {
  const referral = await ProviderReferral.findOne({ referredProviderId: providerId });
  if (!referral || ['rewarded', 'fraud_review', 'rejected', 'expired'].includes(referral.status)) {
    return;
  }

  const provider = await Provider.findById(providerId);
  if (!provider) return;

  const rules = referral.qualificationRulesSnapshot || { kycRequired: true, starterKitRequired: false };

  if (rules.kycRequired && provider.kyc_status !== 'verified') {
    referral.status = 'kyc_pending';
    await referral.save();
    return;
  }

  if (rules.starterKitRequired && !provider.providerKitCompleted) {
    referral.status = 'starter_kit_pending';
    await referral.save();
    return;
  }

  referral.status = 'waiting_first_job';
  await referral.save();
};

/**
 * Reward Engine: Evaluates completion against frozen snapshot & executes atomic wallet ledger entry
 */
export const evaluateAndProcessFirstJobReward = async (
  referredProviderId: string,
  bookingId: string,
  completedJobsCount: number = 1
): Promise<{ rewarded: boolean; message: string }> => {
  const referral = await ProviderReferral.findOne({ referredProviderId });
  if (!referral) {
    return { rewarded: false, message: 'No referral record found for provider' };
  }

  if (referral.status === 'rewarded') {
    return { rewarded: false, message: 'Referral reward already processed previously' };
  }

  if (['fraud_review', 'rejected', 'expired'].includes(referral.status)) {
    return { rewarded: false, message: `Referral in ineligible state: ${referral.status}` };
  }

  // Check per-referral expiry
  if (referral.expiresAt && new Date() > referral.expiresAt) {
    referral.status = 'expired';
    referral.failureReason = 'Referral validity period expired';
    await referral.save();
    return { rewarded: false, message: 'Referral expired' };
  }

  // Read qualification snapshot
  const rules = referral.qualificationRulesSnapshot || { minCompletedJobs: 1, kycRequired: true, walletActive: true };

  const provider = await Provider.findById(referredProviderId);
  if (!provider) return { rewarded: false, message: 'Provider not found' };

  if (rules.walletActive && provider.walletStatus !== 'active') {
    return { rewarded: false, message: 'Provider wallet is not active' };
  }

  if (rules.kycRequired && provider.kyc_status !== 'verified') {
    return { rewarded: false, message: 'Referred provider KYC is pending' };
  }

  if (completedJobsCount < rules.minCompletedJobs) {
    return {
      rewarded: false,
      message: `Minimum required jobs count not met (${completedJobsCount}/${rules.minCompletedJobs})`,
    };
  }

  // Construct Idempotency Key
  const campaignKey = referral.campaignId ? String(referral.campaignId) : 'DEFAULT';
  const idempotencyKey = `REFERRAL_${campaignKey}_${referral.referrerProviderId}_${referral.referredProviderId}`;

  if (referral.idempotencyKey === idempotencyKey) {
    return { rewarded: false, message: 'Duplicate event ignored (Idempotency matched)' };
  }

  try {
    referral.status = 'reward_processing';
    referral.idempotencyKey = idempotencyKey;
    referral.qualificationBookingId = new mongoose.Types.ObjectId(bookingId);
    await referral.save();

    const rewardAmount = referral.rewardAmount || 500;

    // Execute Immutable Wallet Ledger Credit for Referrer
    await recordWalletChangeAndAudit({
      providerId: String(referral.referrerProviderId),
      amount: rewardAmount,
      type: 'credit',
      action: 'REFERRAL_REWARD',
      source: 'Referral',
      reason: `Provider Referral Reward - Referred Provider #${String(referral.referredProviderId).substring(0, 6)}`,
      referenceId: idempotencyKey,
      bookingId,
    });

    // Update referrer provider's successful referrals counter
    await Provider.findByIdAndUpdate(referral.referrerProviderId, { $inc: { successful_referrals: 1 } });

    referral.status = 'rewarded';
    referral.rewardedAt = new Date();
    await referral.save();

    // Emit event for non-blocking notification queue
    eventBus.emit(SYSTEM_EVENTS.REFERRAL_REWARDED, {
      referrerProviderId: referral.referrerProviderId,
      referredProviderId: referral.referredProviderId,
      rewardAmount,
    });

    console.log(`[REFERRAL_REWARDED] Referrer: ${referral.referrerProviderId}, Amount: ₹${rewardAmount}`);
    return { rewarded: true, message: `Successfully credited ₹${rewardAmount} referral reward!` };
  } catch (err: any) {
    console.error(`[REFERRAL_REWARD_ERROR] Failed processing reward for ${referredProviderId}:`, err.message);
    return { rewarded: false, message: err.message };
  }
};

/**
 * Provider Referral Dashboard (Code, Link, Stats, Leaderboard, History)
 */
export const getProviderReferralDashboard = async (providerId: string) => {
  const { referralCode, referralLink } = await getOrCreateProviderReferralCode(providerId);

  const referrals = await ProviderReferral.find({ referrerProviderId: providerId })
    .populate('referredProviderId', 'user_id kyc_status createdAt')
    .sort({ createdAt: -1 })
    .lean();

  // Dynamically calculate total earned rewards from immutable WalletTransaction ledger
  const rewardTransactions = await WalletTransaction.find({
    providerId,
    source: 'Referral',
    type: 'credit',
  }).lean();

  const totalRewardsEarned = rewardTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const successfulReferralsCount = referrals.filter((r) => r.status === 'rewarded').length;
  const pendingReferralsCount = referrals.filter((r) =>
    ['registered', 'kyc_pending', 'starter_kit_pending', 'waiting_first_job', 'qualified', 'reward_processing'].includes(r.status)
  ).length;

  // Monthly Leaderboard Query
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const leaderboardRaw = await Provider.find({ successful_referrals: { $gt: 0 } })
    .sort({ successful_referrals: -1 })
    .limit(10)
    .lean();

  let myRank = 0;
  const allProvidersWithReferrals = await Provider.find({ successful_referrals: { $gt: 0 } })
    .sort({ successful_referrals: -1 })
    .lean();

  const foundIndex = allProvidersWithReferrals.findIndex((p) => String(p._id) === String(providerId));
  myRank = foundIndex !== -1 ? foundIndex + 1 : allProvidersWithReferrals.length + 1;

  const history = referrals.map((r: any) => {
    let displayStatus = 'Pending';
    if (r.status === 'registered') displayStatus = 'Registered';
    else if (r.status === 'kyc_pending') displayStatus = 'KYC Pending';
    else if (r.status === 'starter_kit_pending') displayStatus = 'Starter Kit Pending';
    else if (r.status === 'waiting_first_job') displayStatus = 'Waiting First Job';
    else if (r.status === 'qualified') displayStatus = 'Qualified';
    else if (r.status === 'rewarded') displayStatus = `Completed - ₹${r.rewardAmount} Earned`;
    else if (r.status === 'fraud_review') displayStatus = 'Under Fraud Review';
    else if (r.status === 'rejected') displayStatus = 'Rejected';
    else if (r.status === 'expired') displayStatus = 'Expired';

    return {
      id: r._id,
      statusKey: r.status,
      displayStatus,
      reward: r.status === 'rewarded' ? `₹${r.rewardAmount} Earned` : '—',
      createdAt: r.createdAt,
    };
  });

  return {
    referralCode,
    referralLink,
    stats: {
      totalRewardsEarned,
      successfulReferralsCount,
      pendingReferralsCount,
      myRank,
    },
    history,
  };
};

/**
 * Admin Referral Campaigns CRUD
 */
export const getAdminCampaignsList = async () => {
  return await ProviderReferralCampaign.find().sort({ priority: -1, createdAt: -1 }).lean();
};

export const createAdminCampaign = async (data: any, adminUser: any) => {
  return await ProviderReferralCampaign.create({
    ...data,
    createdBy: adminUser?._id,
  });
};

export const updateAdminCampaign = async (campaignId: string, data: any, adminUser: any) => {
  return await ProviderReferralCampaign.findByIdAndUpdate(
    campaignId,
    { ...data, updatedBy: adminUser?._id },
    { new: true }
  );
};

export const duplicateAdminCampaign = async (campaignId: string) => {
  const original = await ProviderReferralCampaign.findById(campaignId).lean();
  if (!original) throw new Error('Campaign not found');

  const copyData: any = { ...original };
  delete copyData._id;
  delete copyData.createdAt;
  delete copyData.updatedAt;

  copyData.name = `${original.name} (Copy)`;
  copyData.status = 'draft';

  return await ProviderReferralCampaign.create(copyData);
};

/**
 * Admin Analytics Overview
 */
export const getAdminReferralAnalytics = async () => {
  const totalInvitations = await ProviderReferral.countDocuments();
  const registrations = await ProviderReferral.countDocuments({ status: { $ne: 'expired' } });
  const kycPending = await ProviderReferral.countDocuments({ status: 'kyc_pending' });
  const qualified = await ProviderReferral.countDocuments({ status: 'qualified' });
  const rewarded = await ProviderReferral.countDocuments({ status: 'rewarded' });
  const fraudAttempts = await ProviderReferral.countDocuments({ status: { $in: ['fraud_review', 'rejected'] } });

  const totalRewardsPaidResult = await WalletTransaction.aggregate([
    { $match: { source: 'Referral', type: 'credit' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const totalRewardsPaid = totalRewardsPaidResult[0]?.total || 0;
  const conversionRate = totalInvitations > 0 ? ((rewarded / totalInvitations) * 100).toFixed(1) : 0;

  // Top Referrers Leaderboard
  const topReferrers = await Provider.find({ successful_referrals: { $gt: 0 } })
    .sort({ successful_referrals: -1 })
    .limit(5)
    .lean();

  return {
    totalInvitations,
    registrations,
    kycPending,
    qualified,
    rewarded,
    fraudAttempts,
    totalRewardsPaid,
    conversionRate: `${conversionRate}%`,
    topReferrers,
  };
};

/**
 * Admin Paginated Referral List
 */
export const getAdminReferralsListPaginated = async (query: any) => {
  const page = parseInt(query.page || '1');
  const limit = parseInt(query.limit || '20');
  const skip = (page - 1) * limit;

  const filter: any = {};
  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }

  if (query.search) {
    filter.referralCode = { $regex: query.search, $options: 'i' };
  }

  const total = await ProviderReferral.countDocuments(filter);
  const docs = await ProviderReferral.find(filter)
    .populate('referrerProviderId', 'user_id referral_code')
    .populate('referredProviderId', 'user_id kyc_status providerKitCompleted')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    docs,
    totalDocs: total,
    limit,
    totalPages: Math.ceil(total / limit),
    page,
    hasPrevPage: page > 1,
    hasNextPage: page * limit < total,
  };
};

/**
 * Fraud Review Decision (Approve / Reject)
 */
export const processFraudReviewDecision = async (referralId: string, action: 'approve' | 'reject') => {
  const referral = await ProviderReferral.findById(referralId);
  if (!referral) throw new Error('Referral not found');

  if (action === 'approve') {
    referral.status = 'registered';
    referral.failureReason = undefined;
    await referral.save();
    return { success: true, message: 'Referral fraud flag cleared. Status set to Registered.' };
  } else {
    referral.status = 'rejected';
    referral.failureReason = 'Admin manually rejected fraud flagged referral';
    await referral.save();
    return { success: true, message: 'Referral marked as Rejected.' };
  }
};

// ── Event Bus Subscriptions ──────────────────────────────────────────────────
eventBus.on(SYSTEM_EVENTS.BOOKING_COMPLETED, async (payload: { providerId: string; bookingId: string; completedJobsCount: number }) => {
  try {
    await evaluateAndProcessFirstJobReward(payload.providerId, payload.bookingId, payload.completedJobsCount);
  } catch (err: any) {
    console.error('[EVENT_BUS_REFERRAL_ERROR]', err.message);
  }
});
