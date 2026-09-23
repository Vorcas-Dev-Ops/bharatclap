import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';
import crypto from 'crypto';

export interface RefundEntity {
  id: string;
  _id: string;
  booking_id: string;
  bookingId: string;
  customer_id: string;
  customerId: string;
  provider_id?: string;
  providerId?: string;
  refund_amount: number;
  refundAmount: number;
  refund_type: string;
  refundType: string;
  currency: string;
  reason?: string;
  status: string;
  gateway_refund_id?: string;
  gatewayRefundId?: string;
  gateway_response?: any;
  metadata?: any;
  idempotency_key: string;
  idempotencyKey: string;
  processed_at?: Date;
  processedAt?: Date;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
  payout_attempts?: number;
  payoutAttempts?: number;
}

const mapRefundRow = (r: any): RefundEntity => ({
  id: String(r.id),
  _id: String(r.id),
  booking_id: String(r.booking_id),
  bookingId: String(r.booking_id),
  customer_id: String(r.customer_id),
  customerId: String(r.customer_id),
  provider_id: r.provider_id ? String(r.provider_id) : undefined,
  providerId: r.provider_id ? String(r.provider_id) : undefined,
  refund_amount: Number(r.refund_amount),
  refundAmount: Number(r.refund_amount),
  refund_type: r.refund_type,
  refundType: r.refund_type?.toUpperCase(),
  currency: r.currency || 'INR',
  reason: r.reason,
  status: r.status,
  gateway_refund_id: r.gateway_refund_id,
  gatewayRefundId: r.gateway_refund_id,
  gateway_response: r.gateway_response,
  metadata: r.gateway_response || {},
  idempotency_key: r.idempotency_key,
  idempotencyKey: r.idempotency_key,
  processed_at: r.processed_at ? new Date(r.processed_at) : undefined,
  processedAt: r.processed_at ? new Date(r.processed_at) : undefined,
  created_at: new Date(r.created_at),
  createdAt: new Date(r.created_at),
  updated_at: new Date(r.updated_at),
  updatedAt: new Date(r.updated_at),
  payout_attempts: Number(r.version) || 0,
  payoutAttempts: Number(r.version) || 0
});

export class RefundRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findById(id: string, client?: PoolClient): Promise<RefundEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `SELECT * FROM payment.refunds WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapRefundRow(res.rows[0]) : null;
  }

  static async findByIdempotency(bookingId: string, idempotencyKey: string): Promise<RefundEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM payment.refunds
       WHERE (booking_id::text = $1 OR booking_id IN (SELECT id FROM booking.bookings WHERE legacy_mongo_id = $1))
         AND idempotency_key = $2
       LIMIT 1`,
      [bookingId, idempotencyKey]
    );
    return res.rows[0] ? mapRefundRow(res.rows[0]) : null;
  }

  static async findByGatewayRefundId(gatewayRefundId: string): Promise<RefundEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM payment.refunds WHERE gateway_refund_id = $1 LIMIT 1`,
      [gatewayRefundId]
    );
    return res.rows[0] ? mapRefundRow(res.rows[0]) : null;
  }

  static async create(data: {
    bookingId: string;
    customerId: string;
    providerId?: string;
    refundAmount: number;
    refundType?: string;
    reason?: string;
    status?: string;
    idempotencyKey: string;
    gatewayRefundId?: string;
    metadata?: any;
  }): Promise<RefundEntity> {
    const normalizedType = (data.refundType || 'full').toLowerCase();
    const normalizedStatus = (data.status || 'REQUESTED').toUpperCase();

    const res = await this.pool.query(
      `INSERT INTO payment.refunds (
         booking_id, customer_id, provider_id, refund_amount, refund_type,
         currency, reason, status, idempotency_key, gateway_refund_id, gateway_response
       ) VALUES (
         (SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
         (SELECT id FROM provider.providers WHERE id::text = $3 OR legacy_mongo_id = $3 LIMIT 1),
         $4, $5, 'INR', $6, $7, $8, $9, $10
       ) RETURNING *`,
      [
        data.bookingId,
        data.customerId,
        data.providerId || null,
        data.refundAmount,
        normalizedType,
        data.reason || null,
        normalizedStatus,
        data.idempotencyKey,
        data.gatewayRefundId || null,
        JSON.stringify(data.metadata || {})
      ]
    );

    return mapRefundRow(res.rows[0]);
  }

  static async updateStatus(
    id: string,
    status: string,
    extra?: { gatewayRefundId?: string; metadata?: any; processedAt?: Date; failureReason?: string }
  ): Promise<RefundEntity | null> {
    const normalizedStatus = status.toUpperCase();
    const res = await this.pool.query(
      `UPDATE payment.refunds
       SET status = $1,
           gateway_refund_id = COALESCE($2, gateway_refund_id),
           gateway_response = CASE WHEN $3::jsonb IS NOT NULL THEN $3::jsonb ELSE gateway_response END,
           processed_at = COALESCE($4, processed_at),
           updated_at = NOW()
       WHERE id::text = $5 OR legacy_mongo_id = $5
       RETURNING *`,
      [
        normalizedStatus,
        extra?.gatewayRefundId || null,
        extra?.metadata ? JSON.stringify(extra.metadata) : null,
        extra?.processedAt || null,
        id
      ]
    );
    return res.rows[0] ? mapRefundRow(res.rows[0]) : null;
  }

  static async logOutboxEvent(eventType: string, payload: any): Promise<void> {
    const eventId = `EVT-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await this.pool.query(
      `INSERT INTO payment.refund_outbox_events (
         event_id, event_type, aggregate_type, aggregate_id, payload, status
       ) VALUES ($1, $2, 'refund', $3, $4, 'PENDING')`,
      [eventId, eventType, String(payload?.refundId || ''), JSON.stringify(payload)]
    );
  }
}
