import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';

export interface PaymentEntity {
  id: string;
  _id: string;
  booking_id: string;
  bookingId: string;
  user_id: string;
  userId: string;
  amount: number;
  currency: string;
  payment_method?: string;
  paid_via?: string;
  payment_status: string;
  status: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  transaction_id?: string;
  correlation_id?: string;
  refund_metadata?: any;
  status_history: any[];
  version: number;
  legacy_mongo_id?: string;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
  payment_date?: Date;
  gateway_response?: any;
  payment_link_status?: string;
}

export function normalizePaymentStatus(status: string | undefined): string {
  if (!status) return 'Created';
  const s = String(status).toLowerCase();
  if (['completed', 'captured', 'paid', 'successful'].includes(s)) return 'Captured';
  if (['created', 'pending', 'initiated', 'not required'].includes(s)) return 'Created';
  if (['attempted'].includes(s)) return 'Attempted';
  if (['authorized'].includes(s)) return 'Authorized';
  if (['failed', 'cancelled', 'expired'].includes(s)) return 'Failed';
  if (['refunded'].includes(s)) return 'Refunded';
  if (['partially_refunded', 'partially refunded', 'partially paid'].includes(s)) return 'Partially_Refunded';
  return 'Created';
}

export function isPaymentCaptured(status: string | undefined): boolean {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return ['captured', 'completed', 'paid', 'successful'].includes(s);
}

export const mapPaymentRow = (r: any): PaymentEntity => ({
  id: String(r.id),
  _id: String(r.id),
  booking_id: String(r.booking_id),
  bookingId: String(r.booking_id),
  user_id: String(r.user_id),
  userId: String(r.user_id),
  amount: Number(r.amount),
  currency: r.currency || 'INR',
  payment_method: r.payment_method,
  paid_via: r.payment_method,
  payment_status: r.payment_status,
  status: r.payment_status,
  razorpay_order_id: r.razorpay_order_id,
  razorpay_payment_id: r.razorpay_payment_id,
  razorpay_signature: r.razorpay_signature,
  transaction_id: r.transaction_id,
  correlation_id: r.correlation_id,
  refund_metadata: r.refund_metadata,
  status_history: Array.isArray(r.status_history) ? r.status_history : [],
  version: Number(r.version) || 1,
  legacy_mongo_id: r.legacy_mongo_id,
  created_at: new Date(r.created_at),
  createdAt: new Date(r.created_at),
  updated_at: new Date(r.updated_at),
  updatedAt: new Date(r.updated_at),
  payment_date: new Date(r.updated_at),
  gateway_response: r.refund_metadata || {},
  payment_link_status: r.booking_id ? 'linked' : 'pending',
});

export class PaymentRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findById(id: string, client?: Pool | PoolClient): Promise<PaymentEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `SELECT * FROM payment.payments WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapPaymentRow(res.rows[0]) : null;
  }

  static async findByBookingId(bookingId: string, client?: Pool | PoolClient): Promise<PaymentEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `SELECT * FROM payment.payments
       WHERE (booking_id::text = $1 OR booking_id IN (SELECT id FROM booking.bookings WHERE legacy_mongo_id = $1))
       ORDER BY created_at DESC LIMIT 1`,
      [bookingId]
    );
    return res.rows[0] ? mapPaymentRow(res.rows[0]) : null;
  }

  static async findExistingPaid(bookingId: string, client?: Pool | PoolClient): Promise<PaymentEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `SELECT * FROM payment.payments
       WHERE (booking_id::text = $1 OR booking_id IN (SELECT id FROM booking.bookings WHERE legacy_mongo_id = $1))
         AND payment_status = 'Captured'
       LIMIT 1`,
      [bookingId]
    );
    return res.rows[0] ? mapPaymentRow(res.rows[0]) : null;
  }

  static async findPendingOrder(bookingId: string, maxAgeMinutes = 30): Promise<PaymentEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM payment.payments
       WHERE (booking_id::text = $1 OR booking_id IN (SELECT id FROM booking.bookings WHERE legacy_mongo_id = $1))
         AND payment_status IN ('Created', 'Attempted')
         AND razorpay_order_id IS NOT NULL
         AND created_at >= NOW() - ($2 || ' minutes')::interval
       ORDER BY created_at DESC LIMIT 1`,
      [bookingId, maxAgeMinutes]
    );
    return res.rows[0] ? mapPaymentRow(res.rows[0]) : null;
  }

  static async findByRazorpayPaymentId(razorpayPaymentId: string, client?: Pool | PoolClient): Promise<PaymentEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `SELECT * FROM payment.payments WHERE razorpay_payment_id = $1 LIMIT 1`,
      [razorpayPaymentId]
    );
    return res.rows[0] ? mapPaymentRow(res.rows[0]) : null;
  }

  static async findByRazorpayOrderId(razorpayOrderId: string, client?: Pool | PoolClient): Promise<PaymentEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `SELECT * FROM payment.payments WHERE razorpay_order_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [razorpayOrderId]
    );
    return res.rows[0] ? mapPaymentRow(res.rows[0]) : null;
  }

  static async findByTransactionId(transactionId: string, client?: Pool | PoolClient): Promise<PaymentEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `SELECT * FROM payment.payments WHERE transaction_id = $1 LIMIT 1`,
      [transactionId]
    );
    return res.rows[0] ? mapPaymentRow(res.rows[0]) : null;
  }

  static async createPayment(data: {
    bookingId: string;
    userId: string;
    amount: number;
    currency?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    transactionId?: string;
    correlationId?: string;
    refundMetadata?: any;
    statusHistory?: any[];
  }, client?: Pool | PoolClient): Promise<PaymentEntity> {
    const q = client || this.pool;
    const status = normalizePaymentStatus(data.paymentStatus);
    const history = JSON.stringify(data.statusHistory || [{
      status,
      timestamp: new Date().toISOString(),
      note: 'Payment created',
    }]);

    const res = await q.query(
      `INSERT INTO payment.payments (
         booking_id,
         user_id,
         amount,
         currency,
         payment_method,
         payment_status,
         razorpay_order_id,
         razorpay_payment_id,
         razorpay_signature,
         transaction_id,
         correlation_id,
         refund_metadata,
         status_history
       ) VALUES (
         (SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10,
         $11,
         $12,
         $13::jsonb
       ) RETURNING *`,
      [
        data.bookingId,
        data.userId,
        data.amount,
        data.currency || 'INR',
        data.paymentMethod || 'online',
        status,
        data.razorpayOrderId || null,
        data.razorpayPaymentId || null,
        data.razorpaySignature || null,
        data.transactionId || null,
        data.correlationId || null,
        data.refundMetadata ? JSON.stringify(data.refundMetadata) : null,
        history,
      ]
    );

    return mapPaymentRow(res.rows[0]);
  }

  static async upsertPaymentByRazorpayPaymentId(data: {
    razorpayPaymentId: string;
    razorpayOrderId?: string;
    razorpaySignature?: string;
    bookingId?: string;
    userId?: string;
    amount: number;
    currency?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    transactionId?: string;
    correlationId?: string;
    gatewayResponse?: any;
    note?: string;
  }, client?: Pool | PoolClient): Promise<PaymentEntity> {
    const q = client || this.pool;
    const status = normalizePaymentStatus(data.paymentStatus);

    // First check if payment already exists
    const existing = await this.findByRazorpayPaymentId(data.razorpayPaymentId, q);

    if (existing) {
      const historyEntry = {
        status,
        timestamp: new Date().toISOString(),
        note: data.note || 'Razorpay payment verified',
      };
      const res = await q.query(
        `UPDATE payment.payments
         SET payment_status = $2,
             razorpay_order_id = COALESCE($3, razorpay_order_id),
             razorpay_signature = COALESCE($4, razorpay_signature),
             transaction_id = COALESCE($5, transaction_id),
             correlation_id = COALESCE($6, correlation_id),
             refund_metadata = COALESCE($7, refund_metadata),
             status_history = status_history || $8::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          existing.id,
          status,
          data.razorpayOrderId || null,
          data.razorpaySignature || null,
          data.transactionId || data.razorpayPaymentId,
          data.correlationId || null,
          data.gatewayResponse ? JSON.stringify(data.gatewayResponse) : null,
          JSON.stringify([historyEntry]),
        ]
      );
      return mapPaymentRow(res.rows[0]);
    } else {
      // Insert new
      return this.createPayment({
        bookingId: data.bookingId!,
        userId: data.userId!,
        amount: data.amount,
        currency: data.currency || 'INR',
        paymentMethod: data.paymentMethod || 'online',
        paymentStatus: status,
        razorpayOrderId: data.razorpayOrderId,
        razorpayPaymentId: data.razorpayPaymentId,
        razorpaySignature: data.razorpaySignature,
        transactionId: data.transactionId || data.razorpayPaymentId,
        correlationId: data.correlationId,
        refundMetadata: data.gatewayResponse,
        statusHistory: [{
          status,
          timestamp: new Date().toISOString(),
          note: data.note || 'Razorpay payment verified',
        }],
      }, q);
    }
  }

  static async updatePaymentStatus(
    id: string,
    status: string,
    note?: string,
    client?: Pool | PoolClient
  ): Promise<PaymentEntity | null> {
    const q = client || this.pool;
    const normalized = normalizePaymentStatus(status);
    const historyEntry = {
      status: normalized,
      timestamp: new Date().toISOString(),
      note: note || `Status updated to ${normalized}`,
    };

    const res = await q.query(
      `UPDATE payment.payments
       SET payment_status = $2,
           status_history = status_history || $3::jsonb,
           updated_at = NOW()
       WHERE id::text = $1 OR legacy_mongo_id = $1
       RETURNING *`,
      [id, normalized, JSON.stringify([historyEntry])]
    );

    return res.rows[0] ? mapPaymentRow(res.rows[0]) : null;
  }

  static async findPayments(params: {
    userId?: string;
    bookingId?: string;
    paymentStatus?: string | string[];
    paymentMethod?: string;
    page?: number;
    limit?: number;
  }): Promise<{ payments: PaymentEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.userId) {
      conditions.push(
        `(p.user_id::text = $${idx} OR p.user_id IN (SELECT id FROM auth.users WHERE legacy_mongo_id = $${idx}))`
      );
      values.push(params.userId);
      idx++;
    }

    if (params.bookingId) {
      conditions.push(
        `(p.booking_id::text = $${idx} OR p.booking_id IN (SELECT id FROM booking.bookings WHERE legacy_mongo_id = $${idx}))`
      );
      values.push(params.bookingId);
      idx++;
    }

    if (params.paymentStatus) {
      if (Array.isArray(params.paymentStatus)) {
        const mapped = params.paymentStatus.map(s => normalizePaymentStatus(s));
        conditions.push(`p.payment_status = ANY($${idx})`);
        values.push(mapped);
        idx++;
      } else {
        conditions.push(`p.payment_status = $${idx}`);
        values.push(normalizePaymentStatus(params.paymentStatus));
        idx++;
      }
    }

    if (params.paymentMethod) {
      conditions.push(`p.payment_method ILIKE $${idx}`);
      values.push(params.paymentMethod);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int as count FROM payment.payments p ${whereClause}`,
      values
    );
    const total = countRes.rows[0]?.count || 0;

    const query = `
      SELECT p.*
      FROM payment.payments p
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const res = await this.pool.query(query, values);
    return {
      payments: res.rows.map(mapPaymentRow),
      total,
    };
  }

  static async getAuthoritativeRevenueMetrics(): Promise<{
    totalRevenue: number;
    transactionCount: number;
    paymentMethodBreakdown: Array<{ method: string; total: number; count: number }>;
  }> {
    const totalsRes = await this.pool.query(
      `SELECT
         COALESCE(SUM(amount), 0)::numeric as total_revenue,
         COUNT(*)::int as transaction_count
       FROM payment.payments
       WHERE payment_status = 'Captured'`
    );

    const methodsRes = await this.pool.query(
      `SELECT
         COALESCE(payment_method, 'unknown') as method,
         COALESCE(SUM(amount), 0)::numeric as total,
         COUNT(*)::int as count
       FROM payment.payments
       WHERE payment_status = 'Captured'
       GROUP BY payment_method
       ORDER BY total DESC`
    );

    return {
      totalRevenue: Number(totalsRes.rows[0]?.total_revenue || 0),
      transactionCount: Number(totalsRes.rows[0]?.transaction_count || 0),
      paymentMethodBreakdown: methodsRes.rows.map(r => ({
        method: r.method,
        total: Number(r.total),
        count: Number(r.count),
      })),
    };
  }

  // ── Webhook Logging (IMMUTABLE, P0-5 atomic idempotency) ───────────
  static async upsertWebhookLog(data: {
    eventId: string;
    eventType: string;
    signatureValid: boolean;
    payload: any;
  }): Promise<{ log: any; isDuplicate: boolean }> {
    const res = await this.pool.query(
      `INSERT INTO payment.webhook_logs (
         event_id,
         event_type,
         signature_valid,
         received_at,
         result,
         payload
       ) VALUES ($1, $2, $3, NOW(), 'processing', $4::jsonb)
       ON CONFLICT (event_id) DO UPDATE
         SET received_at = EXCLUDED.received_at
       RETURNING *`,
      [data.eventId, data.eventType, data.signatureValid, JSON.stringify(data.payload)]
    );

    const log = res.rows[0];
    const isDuplicate = log.result === 'success';
    return { log, isDuplicate };
  }

  static async updateWebhookResult(eventId: string, result: string): Promise<void> {
    await this.pool.query(
      `UPDATE payment.webhook_logs SET result = $2 WHERE event_id = $1`,
      [eventId, result]
    );
  }

  // ── Payment Event Outbox ──────────────────────────────────────────
  static async createOutboxEvent(data: {
    eventId: string;
    eventType: string;
    payload: any;
  }, client?: Pool | PoolClient): Promise<void> {
    const q = client || this.pool;
    await q.query(
      `INSERT INTO payment.payment_event_outbox (
         event_id,
         event_type,
         payload,
         status
       ) VALUES ($1, $2, $3::jsonb, 'PENDING')
       ON CONFLICT (event_id) DO NOTHING`,
      [data.eventId, data.eventType, JSON.stringify(data.payload)]
    );
  }

  static async findPendingOutboxEvents(maxAttempts = 10, limit = 50): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT * FROM payment.payment_event_outbox
       WHERE status = 'PENDING' AND attempts < $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [maxAttempts, limit]
    );
    return res.rows;
  }

  static async claimOutboxEvent(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE payment.payment_event_outbox
       SET status = 'PROCESSING',
           attempts = attempts + 1,
           updated_at = NOW()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING id`,
      [id]
    );
    return res.rowCount !== null && res.rowCount > 0;
  }

  static async updateOutboxStatus(id: string, status: 'PUBLISHED' | 'PENDING' | 'DLQ'): Promise<void> {
    await this.pool.query(
      `UPDATE payment.payment_event_outbox
       SET status = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, status]
    );
  }

  static async moveToDlq(eventId: string, errorMessage: string, payload: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO payment.payment_dlq (event_id, error_message, payload)
       VALUES ($1, $2, $3::jsonb)`,
      [eventId, errorMessage, JSON.stringify(payload)]
    );
  }
}
