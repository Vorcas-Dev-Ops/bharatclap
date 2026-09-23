import { getDb } from '../config/db';
import { ProviderRepository } from '../repositories/providerRepository';
import { recordWalletChangeAndAudit } from './walletLedgerService';
import { getUsersBatch } from '../utils/internalApi';
import { eventBus, SYSTEM_EVENTS } from '../utils/eventBus';

const generateRandomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const getOrCreateProviderReferralCode = async (
  providerId: string
): Promise<{ referralCode: string; referralLink: string }> => {
  const provider = await ProviderRepository.findById(providerId);
  if (!provider) throw new Error('Provider not found');

  const pool = getDb();
  let referralCode = provider.provider_code || '';

  if (!referralCode) {
    let code = `BCP-${generateRandomCode()}`;
    let isUnique = false;
    while (!isUnique) {
      const existing = await pool.query(
        `SELECT id FROM provider.providers WHERE provider_code = $1 LIMIT 1`,
        [code]
      );
      if (existing.rowCount === 0) {
        isUnique = true;
      } else {
        code = `BCP-${generateRandomCode()}`;
      }
    }
    referralCode = code;
    await pool.query(
      `UPDATE provider.providers SET provider_code = $1, updated_at = NOW() WHERE id = $2`,
      [referralCode, provider.id]
    );
  }

  const baseUrl = process.env.FRONTEND_URL || 'https://bharatclap.com';
  const referralLink = `${baseUrl}/provider/register?ref=${referralCode}`;

  return { referralCode, referralLink };
};

export const getHighestPriorityActiveCampaign = async (): Promise<any | null> => {
  const pool = getDb();
  const res = await pool.query(
    `SELECT * FROM provider.provider_referral_campaigns
     WHERE status = 'active'
       AND (start_date IS NULL OR start_date <= NOW())
       AND (end_date IS NULL OR end_date >= NOW())
     ORDER BY created_at DESC
     LIMIT 1`
  );
  return res.rows[0] || null;
};

export const registerProviderReferral = async (
  referredProviderId: string,
  referralCode: string
): Promise<{ success: boolean; message: string; referral?: any }> => {
  if (!referralCode || !referralCode.trim()) {
    return { success: false, message: 'No referral code provided' };
  }

  const cleanCode = referralCode.trim().toUpperCase();
  const pool = getDb();

  const referrer = await ProviderRepository.findByProviderCode(cleanCode);
  if (!referrer) {
    return { success: false, message: 'Invalid referral code' };
  }

  if (referrer.id === referredProviderId) {
    return { success: false, message: 'Self-referral is strictly prohibited' };
  }

  const referredProvider = await ProviderRepository.findById(referredProviderId);
  if (!referredProvider) {
    return { success: false, message: 'Referred provider not found' };
  }

  const existingRes = await pool.query(
    `SELECT id FROM provider.provider_referrals WHERE referred_id = $1 LIMIT 1`,
    [referredProvider.id]
  );
  if (existingRes.rowCount && existingRes.rowCount > 0) {
    return { success: false, message: 'Referral already recorded for this provider' };
  }

  const activeCampaign = await getHighestPriorityActiveCampaign();
  const rewardAmount = activeCampaign ? Number(activeCampaign.referrer_reward) : 500;

  const insertRes = await pool.query(
    `INSERT INTO provider.provider_referrals (
       referrer_id, referred_id, status, reward_amount, currency
     ) VALUES (
       $1, $2, 'pending', $3, 'INR'
     ) RETURNING *`,
    [referrer.id, referredProvider.id, rewardAmount]
  );

  return { success: true, message: 'Referral applied successfully', referral: insertRes.rows[0] };
};

export const evaluateReferralStatusPipeline = async (providerId: string): Promise<void> => {
  const pool = getDb();
  const refRes = await pool.query(
    `SELECT * FROM provider.provider_referrals
     WHERE referred_id = $1 AND status NOT IN ('rewarded', 'rejected', 'expired')
     LIMIT 1`,
    [providerId]
  );

  if (refRes.rowCount === 0) return;
  const referral = refRes.rows[0];

  const provider = await ProviderRepository.findById(providerId);
  if (!provider) return;

  if (provider.kyc_status !== 'verified') {
    await pool.query(
      `UPDATE provider.provider_referrals SET status = 'kyc_pending', updated_at = NOW() WHERE id = $1`,
      [referral.id]
    );
    return;
  }

  await pool.query(
    `UPDATE provider.provider_referrals SET status = 'waiting_first_job', updated_at = NOW() WHERE id = $1`,
    [referral.id]
  );
};

export const evaluateAndProcessFirstJobReward = async (
  referredProviderId: string,
  bookingId: string,
  completedJobsCount: number = 1
): Promise<{ rewarded: boolean; message: string }> => {
  const pool = getDb();
  const refRes = await pool.query(
    `SELECT * FROM provider.provider_referrals
     WHERE referred_id = $1
     LIMIT 1`,
    [referredProviderId]
  );

  if (refRes.rowCount === 0) {
    return { rewarded: false, message: 'No referral record found for provider' };
  }

  const referral = refRes.rows[0];
  if (referral.status === 'rewarded') {
    return { rewarded: false, message: 'Referral reward already processed previously' };
  }

  if (['rejected', 'expired'].includes(referral.status)) {
    return { rewarded: false, message: `Referral in ineligible state: ${referral.status}` };
  }

  const provider = await ProviderRepository.findById(referredProviderId);
  if (!provider) return { rewarded: false, message: 'Provider not found' };

  if (provider.kyc_status !== 'verified') {
    return { rewarded: false, message: 'Referred provider KYC is pending' };
  }

  try {
    const rewardAmount = Number(referral.reward_amount) || 500;
    const idempotencyKey = `REFERRAL_${referral.referrer_id}_${referral.referred_id}`;

    await recordWalletChangeAndAudit({
      providerId: referral.referrer_id,
      amount: rewardAmount,
      type: 'credit',
      action: 'REFERRAL_REWARD',
      source: 'Referral',
      reason: `Provider Referral Reward - Referred Provider #${String(referral.referred_id).substring(0, 6)}`,
      referenceId: idempotencyKey,
      bookingId,
    });

    await pool.query(
      `UPDATE provider.provider_referrals
       SET status = 'rewarded', updated_at = NOW()
       WHERE id = $1`,
      [referral.id]
    );

    eventBus.emit(SYSTEM_EVENTS.REFERRAL_REWARDED, {
      referrerProviderId: referral.referrer_id,
      referredProviderId: referral.referred_id,
      rewardAmount,
    });

    return { rewarded: true, message: `Successfully credited ₹${rewardAmount} referral reward!` };
  } catch (err: any) {
    console.error(`[REFERRAL_REWARD_ERROR] Failed processing reward:`, err.message);
    return { rewarded: false, message: err.message };
  }
};

export const getProviderReferralDashboard = async (providerId: string) => {
  const { referralCode, referralLink } = await getOrCreateProviderReferralCode(providerId);
  const pool = getDb();

  const [referralsRes, txRes, topRes] = await Promise.all([
    pool.query(
      `SELECT pr.*, p.user_id, p.kyc_status
       FROM provider.provider_referrals pr
       LEFT JOIN provider.providers p ON p.id = pr.referred_id
       WHERE pr.referrer_id = $1
       ORDER BY pr.created_at DESC`,
      [providerId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM provider.wallet_transactions
       WHERE provider_id = $1 AND type = 'credit' AND description ILIKE '%referral%'`,
      [providerId]
    ),
    pool.query(
      `SELECT id, provider_code FROM provider.providers WHERE deleted_at IS NULL LIMIT 10`
    )
  ]);

  const referrals = referralsRes.rows;
  const totalRewardsEarned = Number(txRes.rows[0]?.total) || 0;
  const successfulReferralsCount = referrals.filter(r => r.status === 'rewarded').length;
  const pendingReferralsCount = referrals.filter(r => r.status !== 'rewarded' && r.status !== 'rejected').length;

  const history = referrals.map(r => ({
    id: r.id,
    statusKey: r.status,
    displayStatus: r.status === 'rewarded' ? `Completed - ₹${r.reward_amount} Earned` : (r.status === 'pending' ? 'Pending' : r.status),
    reward: r.status === 'rewarded' ? `₹${r.reward_amount} Earned` : '—',
    createdAt: r.created_at,
  }));

  return {
    referralCode,
    referralLink,
    stats: {
      totalRewardsEarned,
      successfulReferralsCount,
      pendingReferralsCount,
      myRank: 1,
    },
    history,
  };
};

export const getAdminCampaignsList = async () => {
  const pool = getDb();
  const res = await pool.query(
    `SELECT * FROM provider.provider_referral_campaigns ORDER BY created_at DESC`
  );
  return res.rows.map(r => ({
    _id: r.id,
    id: r.id,
    name: r.name,
    referrer_reward: Number(r.referrer_reward),
    referred_reward: Number(r.referred_reward),
    currency: r.currency,
    status: r.status,
    startDate: r.start_date,
    endDate: r.end_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
};

export const createAdminCampaign = async (data: any, adminUser: any) => {
  const pool = getDb();
  const res = await pool.query(
    `INSERT INTO provider.provider_referral_campaigns (
       name, referrer_reward, referred_reward, currency, status, start_date, end_date
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7
     ) RETURNING *`,
    [
      data.name || 'New Campaign',
      Number(data.referrer_reward || data.rewardAmount) || 500,
      Number(data.referred_reward) || 0,
      data.currency || 'INR',
      data.status || 'active',
      data.startDate ? new Date(data.startDate) : null,
      data.endDate ? new Date(data.endDate) : null
    ]
  );
  const r = res.rows[0];
  return {
    _id: r.id,
    id: r.id,
    ...r
  };
};

export const updateAdminCampaign = async (campaignId: string, data: any, adminUser: any) => {
  const pool = getDb();
  const res = await pool.query(
    `UPDATE provider.provider_referral_campaigns
     SET name = COALESCE($1, name),
         referrer_reward = COALESCE($2, referrer_reward),
         referred_reward = COALESCE($3, referred_reward),
         status = COALESCE($4, status),
         updated_at = NOW()
     WHERE id::text = $5 OR legacy_mongo_id = $5
     RETURNING *`,
    [
      data.name,
      data.referrer_reward ? Number(data.referrer_reward) : null,
      data.referred_reward ? Number(data.referred_reward) : null,
      data.status,
      campaignId
    ]
  );
  return res.rows[0];
};

export const duplicateAdminCampaign = async (campaignId: string) => {
  const pool = getDb();
  const orig = await pool.query(
    `SELECT * FROM provider.provider_referral_campaigns WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
    [campaignId]
  );
  if (orig.rowCount === 0) throw new Error('Campaign not found');
  const o = orig.rows[0];

  const res = await pool.query(
    `INSERT INTO provider.provider_referral_campaigns (
       name, referrer_reward, referred_reward, currency, status, start_date, end_date
     ) VALUES (
       $1, $2, $3, $4, 'draft', $5, $6
     ) RETURNING *`,
    [`${o.name} (Copy)`, o.referrer_reward, o.referred_reward, o.currency, o.start_date, o.end_date]
  );
  return res.rows[0];
};

export const getAdminReferralAnalytics = async () => {
  const pool = getDb();
  const [totalRes, rewardedRes, txRes] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM provider.provider_referrals`),
    pool.query(`SELECT COUNT(*) FROM provider.provider_referrals WHERE status = 'rewarded'`),
    pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM provider.wallet_transactions WHERE description ILIKE '%referral%'`)
  ]);

  const totalInvitations = Number(totalRes.rows[0]?.count) || 0;
  const rewarded = Number(rewardedRes.rows[0]?.count) || 0;
  const totalRewardsPaid = Number(txRes.rows[0]?.total) || 0;
  const conversionRate = totalInvitations > 0 ? ((rewarded / totalInvitations) * 100).toFixed(1) : '0';

  return {
    totalInvitations,
    registrations: totalInvitations,
    kycPending: 0,
    qualified: rewarded,
    rewarded,
    fraudAttempts: 0,
    totalRewardsPaid,
    conversionRate: `${conversionRate}%`,
    topReferrers: [],
  };
};

export const getAdminReferralsListPaginated = async (query: any) => {
  const page = parseInt(query.page || '1');
  const limit = parseInt(query.limit || '20');
  const offset = (page - 1) * limit;
  const pool = getDb();

  const [docsRes, countRes] = await Promise.all([
    pool.query(
      `SELECT pr.*, rp.provider_code, rp.kyc_status, rp.user_id AS referred_user_id
       FROM provider.provider_referrals pr
       LEFT JOIN provider.providers rp ON rp.id = pr.referred_id
       ORDER BY pr.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM provider.provider_referrals`)
  ]);

  const total = Number(countRes.rows[0]?.count) || 0;

  return {
    docs: docsRes.rows.map(r => ({
      _id: r.id,
      id: r.id,
      referrerProviderId: { _id: r.referrer_id },
      referredProviderId: { _id: r.referred_id, user_id: r.referred_user_id, kyc_status: r.kyc_status },
      status: r.status,
      rewardAmount: Number(r.reward_amount),
      createdAt: r.created_at
    })),
    totalDocs: total,
    limit,
    totalPages: Math.ceil(total / limit),
    page,
    hasPrevPage: page > 1,
    hasNextPage: page * limit < total,
  };
};

export const processFraudReviewDecision = async (referralId: string, action: 'approve' | 'reject') => {
  const pool = getDb();
  const newStatus = action === 'approve' ? 'pending' : 'rejected';
  const res = await pool.query(
    `UPDATE provider.provider_referrals
     SET status = $1, updated_at = NOW()
     WHERE id::text = $2 OR legacy_mongo_id = $2
     RETURNING *`,
    [newStatus, referralId]
  );
  if (res.rowCount === 0) throw new Error('Referral not found');
  return { success: true, message: `Referral status set to ${newStatus}.` };
};

// ── Event Bus Subscriptions ──────────────────────────────────────────────────
eventBus.on(SYSTEM_EVENTS.BOOKING_COMPLETED, async (payload: { providerId: string; bookingId: string; completedJobsCount: number }) => {
  try {
    await evaluateAndProcessFirstJobReward(payload.providerId, payload.bookingId, payload.completedJobsCount);
  } catch (err: any) {
    console.error('[EVENT_BUS_REFERRAL_ERROR]', err.message);
  }
});
