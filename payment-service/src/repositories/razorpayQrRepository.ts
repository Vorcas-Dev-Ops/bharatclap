import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';

export interface RazorpayQrEntity {
  id: string;
  _id: string;
  provider_id: string;
  providerId: string;
  booking_id: string;
  bookingId: string;
  razorpay_qr_id: string;
  amount_paise: number;
  currency: string;
  status: string;
  qr_payload: string;
  expires_at: Date;
  audit_trail: any[];
  notes?: Record<string, any>;
  payment_id?: string;
  qr_data: any;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

const mapQrRow = (r: any): RazorpayQrEntity => {
  const d = r.qr_data || {};
  return {
    id: String(r.id),
    _id: String(r.id),
    provider_id: String(r.provider_id),
    providerId: String(r.provider_id),
    booking_id: d.booking_id || '',
    bookingId: d.booking_id || '',
    razorpay_qr_id: d.razorpay_qr_id || '',
    amount_paise: Number(d.amount_paise || 0),
    currency: d.currency || 'INR',
    status: r.status || d.status || 'PENDING',
    qr_payload: d.qr_payload || '',
    expires_at: d.expires_at ? new Date(d.expires_at) : new Date(Date.now() + 15 * 60 * 1000),
    audit_trail: Array.isArray(d.audit_trail) ? d.audit_trail : [],
    notes: d.notes || {},
    payment_id: d.payment_id || undefined,
    qr_data: d,
    created_at: new Date(r.created_at),
    createdAt: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
    updatedAt: new Date(r.updated_at),
  };
};

export class RazorpayQrRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findActiveByBookingId(bookingId: string): Promise<RazorpayQrEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM payment.razorpay_payment_qrs
       WHERE qr_data->>'booking_id' = $1
         AND status IN ('PENDING', 'active')
       ORDER BY created_at DESC
       LIMIT 1`,
      [bookingId]
    );
    return res.rows[0] ? mapQrRow(res.rows[0]) : null;
  }

  static async findByRazorpayQrId(razorpayQrId: string): Promise<RazorpayQrEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM payment.razorpay_payment_qrs
       WHERE qr_data->>'razorpay_qr_id' = $1
       LIMIT 1`,
      [razorpayQrId]
    );
    return res.rows[0] ? mapQrRow(res.rows[0]) : null;
  }

  static async findById(id: string): Promise<RazorpayQrEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM payment.razorpay_payment_qrs
       WHERE id::text = $1 OR legacy_mongo_id = $1
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapQrRow(res.rows[0]) : null;
  }

  static async createQr(data: {
    providerId: string;
    bookingId: string;
    razorpayQrId: string;
    amountPaise: number;
    currency?: string;
    status?: string;
    qrPayload: string;
    expiresAt: Date;
    auditTrail?: any[];
    notes?: Record<string, any>;
  }): Promise<RazorpayQrEntity> {
    const qrData = {
      booking_id: data.bookingId,
      razorpay_qr_id: data.razorpayQrId,
      amount_paise: data.amountPaise,
      currency: data.currency || 'INR',
      status: data.status || 'PENDING',
      qr_payload: data.qrPayload,
      expires_at: data.expiresAt.toISOString(),
      audit_trail: data.auditTrail || [
        { status: 'CREATED', timestamp: new Date().toISOString(), note: 'UPI QR generated' },
      ],
      notes: data.notes || {},
    };

    // provider_id in DB is UUID NOT NULL; if placeholder or legacy string, resolve or fallback to system UUID
    const res = await this.pool.query(
      `INSERT INTO payment.razorpay_payment_qrs (
         provider_id,
         qr_data,
         status
       ) VALUES (
         COALESCE(
           (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
           '00000000-0000-0000-0000-000000000000'::uuid
         ),
         $2::jsonb,
         $3
       ) RETURNING *`,
      [data.providerId, JSON.stringify(qrData), data.status || 'PENDING']
    );

    return mapQrRow(res.rows[0]);
  }

  static async updateQr(
    id: string,
    updates: {
      status?: string;
      auditEntry?: any;
      paymentId?: string;
    }
  ): Promise<RazorpayQrEntity | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const qrData = { ...existing.qr_data };
    if (updates.status) qrData.status = updates.status;
    if (updates.paymentId) qrData.payment_id = updates.paymentId;
    if (updates.auditEntry) {
      qrData.audit_trail = [...(qrData.audit_trail || []), updates.auditEntry];
    }

    const res = await this.pool.query(
      `UPDATE payment.razorpay_payment_qrs
       SET status = COALESCE($2, status),
           qr_data = $3::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [existing.id, updates.status || null, JSON.stringify(qrData)]
    );

    return res.rows[0] ? mapQrRow(res.rows[0]) : null;
  }

  static async findAll(params: { page?: number; limit?: number }): Promise<{ qrs: RazorpayQrEntity[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int as count FROM payment.razorpay_payment_qrs`
    );
    const total = countRes.rows[0]?.count || 0;

    const res = await this.pool.query(
      `SELECT * FROM payment.razorpay_payment_qrs
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      qrs: res.rows.map(mapQrRow),
      total,
    };
  }
}
