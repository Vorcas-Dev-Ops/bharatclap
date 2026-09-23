import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';

export interface RefundEntity {
  id: string;
  _id: string;
  booking_id: string;
  bookingId: string;
  customer_id: string;
  customerId: string;
  user_id: string;
  userId: string;
  provider_id?: string;
  providerId?: string;
  payment_id?: string;
  refund_amount: number;
  amount: number;
  original_amount?: number;
  refund_type: string;
  currency: string;
  reason?: string;
  refund_reason?: string;
  status: string;
  gateway_refund_id?: string;
  gateway_response?: any;
  idempotency_key: string;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

const mapRefundRow = (r: any): RefundEntity => ({
  id: String(r.id),
  _id: String(r.id),
  booking_id: String(r.booking_id),
  bookingId: String(r.booking_id),
  customer_id: String(r.customer_id),
  customerId: String(r.customer_id),
  user_id: String(r.customer_id),
  userId: String(r.customer_id),
  provider_id: r.provider_id ? String(r.provider_id) : undefined,
  providerId: r.provider_id ? String(r.provider_id) : undefined,
  payment_id: r.gateway_refund_id || undefined,
  refund_amount: Number(r.refund_amount),
  amount: Number(r.refund_amount),
  original_amount: Number(r.refund_amount),
  refund_type: r.refund_type,
  currency: r.currency || 'INR',
  reason: r.reason,
  refund_reason: r.reason,
  status: r.status,
  gateway_refund_id: r.gateway_refund_id,
  gateway_response: r.gateway_response || {},
  idempotency_key: r.idempotency_key,
  created_at: new Date(r.created_at),
  createdAt: new Date(r.created_at),
  updated_at: new Date(r.updated_at),
  updatedAt: new Date(r.updated_at),
});

export class RefundRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findById(id: string, client?: Pool | PoolClient): Promise<RefundEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `SELECT * FROM payment.refunds WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapRefundRow(res.rows[0]) : null;
  }

  static async findRefunds(params: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ refunds: RefundEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.status) {
      conditions.push(`status = $${idx}`);
      values.push(params.status.toUpperCase());
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int as count FROM payment.refunds ${whereClause}`,
      values
    );
    const total = countRes.rows[0]?.count || 0;

    const query = `
      SELECT * FROM payment.refunds
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const res = await this.pool.query(query, values);
    return {
      refunds: res.rows.map(mapRefundRow),
      total,
    };
  }

  static async createRefund(data: {
    bookingId: string;
    customerId: string;
    providerId?: string;
    refundAmount: number;
    refundType?: string;
    reason?: string;
    idempotencyKey?: string;
  }, client?: Pool | PoolClient): Promise<RefundEntity> {
    const q = client || this.pool;
    const key = data.idempotencyKey || `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const res = await q.query(
      `INSERT INTO payment.refunds (
         booking_id,
         customer_id,
         provider_id,
         refund_amount,
         refund_type,
         currency,
         reason,
         status,
         idempotency_key
       ) VALUES (
         (SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
         (SELECT id FROM provider.providers WHERE id::text = $3 OR legacy_mongo_id = $3 LIMIT 1),
         $4,
         $5,
         'INR',
         $6,
         'REQUESTED',
         $7
       ) RETURNING *`,
      [
        data.bookingId,
        data.customerId,
        data.providerId || null,
        data.refundAmount,
        data.refundType || 'admin',
        data.reason || null,
        key,
      ]
    );

    return mapRefundRow(res.rows[0]);
  }

  static async updateRefund(
    id: string,
    updates: {
      status?: string;
      reason?: string;
      refundAmount?: number;
    },
    client?: Pool | PoolClient
  ): Promise<RefundEntity | null> {
    const q = client || this.pool;
    const existing = await this.findById(id, q);
    if (!existing) return null;

    const newStatus = updates.status ? updates.status.toUpperCase() : existing.status;
    const newReason = updates.reason !== undefined ? updates.reason : existing.reason;
    const newAmount = updates.refundAmount !== undefined ? updates.refundAmount : existing.refund_amount;

    const res = await q.query(
      `UPDATE payment.refunds
       SET status = $2,
           reason = $3,
           refund_amount = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [existing.id, newStatus, newReason, newAmount]
    );

    return res.rows[0] ? mapRefundRow(res.rows[0]) : null;
  }
}
