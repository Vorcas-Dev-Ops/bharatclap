import { Pool } from 'pg';
import { getDb } from '../config/db';

export class ReferralRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async getTotalRewardsForUser(userId: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT COALESCE(SUM(amount), 0)::float AS total
       FROM auth.referral_rewards
       WHERE user_id::text = $1 AND status IN ('completed', 'credited')`,
      [userId]
    );
    return res.rows[0]?.total ?? 0;
  }

  static async createReferral(data: {
    referrerId: string;
    referredId: string;
    rewardAmount?: number;
  }): Promise<any> {
    const res = await this.pool.query(
      `INSERT INTO auth.customer_referrals (referrer_id, referred_id, reward_amount)
       VALUES ($1, $2, $3)
       ON CONFLICT (referrer_id, referred_id) DO NOTHING
       RETURNING *`,
      [data.referrerId, data.referredId, data.rewardAmount || 0]
    );
    return res.rows[0] || null;
  }

  static async findPendingByReferee(refereeId: string): Promise<any | null> {
    const res = await this.pool.query(
      `SELECT * FROM auth.customer_referrals
       WHERE referred_id::text = $1 AND status IN ('pending', 'invited', 'booked')
       LIMIT 1`,
      [refereeId]
    );
    return res.rows[0] || null;
  }

  static async getHistory(userId: string): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT cr.id, cr.referred_id, cr.status, cr.created_at, u.name, u.phone
       FROM auth.customer_referrals cr
       LEFT JOIN auth.users u ON u.id = cr.referred_id
       WHERE cr.referrer_id::text = $1
       ORDER BY cr.created_at DESC`,
      [userId]
    );
    return res.rows;
  }

  static async completeReferralTx(
    client: any,
    referralId: string,
    referrerId: string,
    refereeId: string,
    rewardAmount: number = 100
  ): Promise<any> {
    // 1. Update customer_referrals status to 'completed'
    await client.query(
      `UPDATE auth.customer_referrals
       SET status = 'completed', reward_amount = $1, updated_at = NOW()
       WHERE id::text = $2`,
      [rewardAmount, referralId]
    );

    // 2. Insert into referral_rewards
    const rewardRes = await client.query(
      `INSERT INTO auth.referral_rewards (
        user_id, referral_id, amount, currency, reward_type, status
      ) VALUES ($1, $2, $3, 'INR', 'wallet_credit', 'completed')
      RETURNING *`,
      [referrerId, referralId, rewardAmount]
    );

    // 3. Atomically credit customer wallet in payment schema (P0-1)
    await client.query(
      `INSERT INTO payment.customer_wallets (customer_id, balance, currency)
       VALUES ($1, $2, 'INR')
       ON CONFLICT (customer_id)
       DO UPDATE SET balance = payment.customer_wallets.balance + EXCLUDED.balance, updated_at = NOW()`,
      [referrerId, rewardAmount]
    );

    return rewardRes.rows[0];
  }

  static async flagReferral(referralId: string, holdReason: string): Promise<void> {
    await this.pool.query(
      `UPDATE auth.customer_referrals
       SET status = 'cancelled', updated_at = NOW()
       WHERE id::text = $1`,
      [referralId]
    );
  }
}
