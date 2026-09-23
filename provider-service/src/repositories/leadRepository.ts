import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';

export interface LeadPackageEntity {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  status: string;
}

export class LeadRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async getPackages(): Promise<LeadPackageEntity[]> {
    const res = await this.pool.query(
      `SELECT * FROM provider.lead_packages WHERE status = 'active' ORDER BY credits ASC`
    );
    return res.rows.map(r => ({
      id: String(r.id),
      name: r.name,
      credits: Number(r.credits),
      price: Number(r.price),
      currency: r.currency || 'INR',
      status: r.status
    }));
  }

  static async deductLeadCredits(providerId: string, credits: number, referenceId: string, client?: PoolClient): Promise<number> {
    const q = client || this.pool;
    // Check constraint or atomic decrement on lead balance
    const res = await q.query(
      `UPDATE provider.providers
       SET lead_balance = GREATEST(0, lead_balance - $2),
           updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1)
       RETURNING lead_balance`,
      [providerId, credits]
    );

    if (res.rows.length === 0) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    const newBalance = Number(res.rows[0].lead_balance);

    // Record lead transaction
    await q.query(
      `INSERT INTO provider.lead_transactions (
         provider_id, type, amount, balance_after, reference_type, reference_id
       ) VALUES (
         (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         'deduction', $2, $3, 'booking_lead', $4
       )`,
      [providerId, credits, newBalance, referenceId]
    );

    return newBalance;
  }

  static async addLeadCredits(providerId: string, credits: number, orderId: string, client?: PoolClient): Promise<number> {
    const q = client || this.pool;
    const res = await q.query(
      `UPDATE provider.providers
       SET lead_balance = lead_balance + $2,
           updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1)
       RETURNING lead_balance`,
      [providerId, credits]
    );

    const newBalance = Number(res.rows[0].lead_balance);

    await q.query(
      `INSERT INTO provider.lead_transactions (
         provider_id, type, amount, balance_after, reference_type, reference_id
       ) VALUES (
         (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         'purchase', $2, $3, 'package_order', $4
       )`,
      [providerId, credits, newBalance, orderId]
    );

    return newBalance;
  }
}
