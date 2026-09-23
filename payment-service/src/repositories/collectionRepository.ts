import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';

export interface ProviderCollectionEntity {
  id: string;
  _id: string;
  provider_id: string;
  providerId: string;
  booking_id: string;
  bookingId: string;
  customer_id?: string;
  customerId?: string;
  method: string;
  status: string;
  qr_reference?: string;
  qr_payload?: string;
  qr_expires_at?: Date;
  amount_snapshot: any;
  amount: number;
  provider_upi_id?: string;
  customer_transaction_reference?: string;
  verified_transaction_reference?: string;
  dispute?: any;
  collection_data: any;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export interface CashRemittanceEntity {
  id: string;
  _id: string;
  provider_id: string;
  providerId: string;
  amount: number;
  currency: string;
  status: string;
  remittance_reference?: string;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

const mapCollectionRow = (r: any): ProviderCollectionEntity => {
  const d = r.collection_data || {};
  return {
    id: String(r.id),
    _id: String(r.id),
    provider_id: String(r.provider_id),
    providerId: String(r.provider_id),
    booking_id: r.booking_id ? String(r.booking_id) : (d.booking_id || ''),
    bookingId: r.booking_id ? String(r.booking_id) : (d.booking_id || ''),
    customer_id: d.customer_id,
    customerId: d.customer_id,
    method: d.method || 'PROVIDER_UPI',
    status: r.status || d.status || 'INITIATED',
    qr_reference: d.qr_reference,
    qr_payload: d.qr_payload,
    qr_expires_at: d.qr_expires_at ? new Date(d.qr_expires_at) : undefined,
    amount_snapshot: d.amount_snapshot || { amount: Number(r.amount || 0) },
    amount: Number(r.amount || d.amount_snapshot?.amount || 0),
    provider_upi_id: d.provider_upi_id,
    customer_transaction_reference: d.customer_transaction_reference,
    verified_transaction_reference: d.verified_transaction_reference,
    dispute: d.dispute,
    collection_data: d,
    created_at: new Date(r.created_at),
    createdAt: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
    updatedAt: new Date(r.updated_at),
  };
};

const mapRemittanceRow = (r: any): CashRemittanceEntity => ({
  id: String(r.id),
  _id: String(r.id),
  provider_id: String(r.provider_id),
  providerId: String(r.provider_id),
  amount: Number(r.amount),
  currency: r.currency || 'INR',
  status: r.status,
  remittance_reference: r.legacy_mongo_id,
  created_at: new Date(r.created_at),
  createdAt: new Date(r.created_at),
  updated_at: new Date(r.updated_at),
  updatedAt: new Date(r.updated_at),
});

export class CollectionRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findActiveByBookingId(bookingId: string): Promise<ProviderCollectionEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM payment.provider_collections
       WHERE (booking_id::text = $1 OR booking_id IN (SELECT id FROM booking.bookings WHERE legacy_mongo_id = $1)
              OR collection_data->>'booking_id' = $1)
         AND status IN ('INITIATED', 'AWAITING_CUSTOMER', 'CUSTOMER_CONFIRMED', 'PROVIDER_CONFIRMED', 'pending')
       ORDER BY created_at DESC
       LIMIT 1`,
      [bookingId]
    );
    return res.rows[0] ? mapCollectionRow(res.rows[0]) : null;
  }

  static async findById(id: string): Promise<ProviderCollectionEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM payment.provider_collections
       WHERE id::text = $1 OR legacy_mongo_id = $1
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapCollectionRow(res.rows[0]) : null;
  }

  static async createCollection(data: {
    bookingId: string;
    providerId: string;
    customerId?: string;
    method: string;
    status: string;
    amount: number;
    amountSnapshot: any;
    qrReference?: string;
    qrPayload?: string;
    qrExpiresAt?: Date;
    providerUpiId?: string;
    idempotencyKey?: string;
  }): Promise<ProviderCollectionEntity> {
    const collectionData = {
      booking_id: data.bookingId,
      customer_id: data.customerId,
      method: data.method,
      status: data.status,
      amount_snapshot: data.amountSnapshot,
      qr_reference: data.qrReference,
      qr_payload: data.qrPayload,
      qr_expires_at: data.qrExpiresAt ? data.qrExpiresAt.toISOString() : undefined,
      provider_upi_id: data.providerUpiId,
      idempotency_key: data.idempotencyKey,
    };

    const res = await this.pool.query(
      `INSERT INTO payment.provider_collections (
         provider_id,
         booking_id,
         collection_data,
         amount,
         currency,
         status
       ) VALUES (
         COALESCE(
           (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
           '00000000-0000-0000-0000-000000000000'::uuid
         ),
         (SELECT id FROM booking.bookings WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
         $3::jsonb,
         $4,
         'INR',
         $5
       ) RETURNING *`,
      [data.providerId, data.bookingId, JSON.stringify(collectionData), data.amount, data.status]
    );

    return mapCollectionRow(res.rows[0]);
  }

  static async updateCollection(
    id: string,
    updates: {
      status?: string;
      customerTxnRef?: string;
      verifiedTxnRef?: string;
      dispute?: any;
      method?: string;
      auditEntry?: any;
    }
  ): Promise<ProviderCollectionEntity | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const data = { ...existing.collection_data };
    if (updates.status) data.status = updates.status;
    if (updates.method) data.method = updates.method;
    if (updates.customerTxnRef) data.customer_transaction_reference = updates.customerTxnRef;
    if (updates.verifiedTxnRef) data.verified_transaction_reference = updates.verifiedTxnRef;
    if (updates.dispute) data.dispute = updates.dispute;
    if (updates.auditEntry) {
      data.audit_trail = [...(data.audit_trail || []), updates.auditEntry];
    }

    const res = await this.pool.query(
      `UPDATE payment.provider_collections
       SET status = COALESCE($2, status),
           collection_data = $3::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [existing.id, updates.status || null, JSON.stringify(data)]
    );

    return res.rows[0] ? mapCollectionRow(res.rows[0]) : null;
  }

  static async findCollections(params: {
    method?: string;
    status?: string;
    search?: string;
    providerId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ collections: ProviderCollectionEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.method) {
      conditions.push(`collection_data->>'method' = $${idx}`);
      values.push(params.method);
      idx++;
    }

    if (params.status) {
      conditions.push(`status = $${idx}`);
      values.push(params.status);
      idx++;
    }

    if (params.providerId) {
      conditions.push(
        `(provider_id::text = $${idx} OR provider_id IN (SELECT id FROM provider.providers WHERE legacy_mongo_id = $${idx}))`
      );
      values.push(params.providerId);
      idx++;
    }

    if (params.search) {
      conditions.push(
        `(collection_data->>'qr_reference' ILIKE $${idx} OR
          collection_data->>'customer_transaction_reference' ILIKE $${idx} OR
          collection_data->>'verified_transaction_reference' ILIKE $${idx} OR
          collection_data->>'provider_upi_id' ILIKE $${idx})`
      );
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int as count FROM payment.provider_collections ${whereClause}`,
      values
    );
    const total = countRes.rows[0]?.count || 0;

    const query = `
      SELECT * FROM payment.provider_collections
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const res = await this.pool.query(query, values);
    return {
      collections: res.rows.map(mapCollectionRow),
      total,
    };
  }

  // ── Cash Remittances ───────────────────────────────────────────────
  static async findRemittances(providerId?: string): Promise<CashRemittanceEntity[]> {
    if (providerId) {
      const res = await this.pool.query(
        `SELECT * FROM payment.cash_remittances
         WHERE provider_id::text = $1 OR provider_id IN (SELECT id FROM provider.providers WHERE legacy_mongo_id = $1)
         ORDER BY created_at DESC`,
        [providerId]
      );
      return res.rows.map(mapRemittanceRow);
    }
    const res = await this.pool.query(
      `SELECT * FROM payment.cash_remittances ORDER BY created_at DESC`
    );
    return res.rows.map(mapRemittanceRow);
  }

  static async createRemittance(data: {
    providerId: string;
    amount: number;
    currency?: string;
    status?: string;
  }): Promise<CashRemittanceEntity> {
    const rawStatus = (data.status || 'pending').toLowerCase();
    const validStatus = ['pending', 'collected', 'verified', 'disputed'].includes(rawStatus)
      ? rawStatus
      : 'pending';

    const res = await this.pool.query(
      `INSERT INTO payment.cash_remittances (
         provider_id,
         amount,
         currency,
         status
       ) VALUES (
         COALESCE(
           (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
           '00000000-0000-0000-0000-000000000000'::uuid
         ),
         $2,
         $3,
         $4
       ) RETURNING *`,
      [data.providerId, data.amount, data.currency || 'INR', validStatus]
    );

    return mapRemittanceRow(res.rows[0]);
  }

  static async updateRemittance(id: string, status: string): Promise<CashRemittanceEntity | null> {
    const rawStatus = status.toLowerCase();
    const validStatus = ['pending', 'collected', 'verified', 'disputed'].includes(rawStatus)
      ? rawStatus
      : 'verified';

    const res = await this.pool.query(
      `UPDATE payment.cash_remittances
       SET status = $2, updated_at = NOW()
       WHERE id::text = $1 OR legacy_mongo_id = $1
       RETURNING *`,
      [id, validStatus]
    );

    return res.rows[0] ? mapRemittanceRow(res.rows[0]) : null;
  }
}
