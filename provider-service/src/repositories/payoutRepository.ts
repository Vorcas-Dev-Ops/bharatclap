import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';

export interface PayoutEntity {
  id: string;
  provider_id: string;
  settlement_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';
  utr?: string;
  payout_reference?: string;
  failure_reason?: string;
  created_at: Date;
  updated_at: Date;
}

export class PayoutRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async create(data: {
    providerId: string;
    settlementId?: string;
    amount: number;
    currency?: string;
    status?: string;
    payoutReference?: string;
  }, client?: PoolClient): Promise<PayoutEntity> {
    const q = client || this.pool;
    const res = await q.query(
      `INSERT INTO provider.payouts (
         provider_id, settlement_id, amount, currency, status, payout_reference
       ) VALUES (
         (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         (SELECT id FROM provider.provider_settlements WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
         $3, COALESCE($4, 'INR'), COALESCE($5, 'pending'), $6
       )
       RETURNING *`,
      [
        data.providerId,
        data.settlementId || null,
        data.amount,
        data.currency || 'INR',
        data.status || 'pending',
        data.payoutReference || null
      ]
    );

    const r = res.rows[0];
    return {
      id: String(r.id),
      provider_id: String(r.provider_id),
      settlement_id: r.settlement_id ? String(r.settlement_id) : undefined,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      utr: r.utr,
      payout_reference: r.payout_reference,
      failure_reason: r.failure_reason,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at)
    };
  }

  static async updateStatus(
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed',
    updates: { utr?: string; failureReason?: string } = {},
    client?: PoolClient
  ): Promise<PayoutEntity | null> {
    const q = client || this.pool;
    const setClauses = [`status = $2`, `updated_at = NOW()`];
    const values: any[] = [id, status];

    if (updates.utr) {
      values.push(updates.utr);
      setClauses.push(`utr = $${values.length}`);
    }
    if (updates.failureReason) {
      values.push(updates.failureReason);
      setClauses.push(`failure_reason = $${values.length}`);
    }

    const res = await q.query(
      `UPDATE provider.payouts
       SET ${setClauses.join(', ')}
       WHERE (id::text = $1 OR legacy_mongo_id = $1)
       RETURNING *`,
      values
    );

    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: String(r.id),
      provider_id: String(r.provider_id),
      settlement_id: r.settlement_id ? String(r.settlement_id) : undefined,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      utr: r.utr,
      payout_reference: r.payout_reference,
      failure_reason: r.failure_reason,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at)
    };
  }

  static async logWebhook(event: string, payload: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO provider.razorpay_payout_webhooks (
         event_type, payload
       ) VALUES ($1, $2::jsonb)`,
      [event, JSON.stringify(payload)]
    );
  }
}
