import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';

export interface SettlementEntity {
  id: string;
  provider_id: string;
  booking_id: string;
  booking_display_id: string;
  service_name?: string;
  variant_name?: string;
  payment_type: 'online' | 'cod';
  gross_amount: number;
  commission_percentage: number;
  commission_amount: number;
  gst_on_commission: number;
  tds_amount: number;
  tcs_amount: number;
  net_payable_amount: number;
  cod_due_amount: number;
  currency: string;
  status: string;
  payout_id?: string;
  payout_reference?: string;
  period_start?: Date;
  period_end?: Date;
  created_at: Date;
  updated_at: Date;
}

export const mapSettlementRow = (row: any): SettlementEntity => {
  if (!row) return null as any;
  return {
    id: String(row.id),
    provider_id: String(row.provider_id),
    booking_id: String(row.booking_id),
    booking_display_id: row.booking_display_id,
    service_name: row.service_name,
    variant_name: row.variant_name,
    payment_type: row.payment_type,
    gross_amount: Number(row.gross_amount) || 0,
    commission_percentage: Number(row.commission_percentage) || 0,
    commission_amount: Number(row.commission_amount) || 0,
    gst_on_commission: Number(row.gst_on_commission) || 0,
    tds_amount: Number(row.tds_amount) || 0,
    tcs_amount: Number(row.tcs_amount) || 0,
    net_payable_amount: Number(row.net_payable_amount) || 0,
    cod_due_amount: Number(row.cod_due_amount) || 0,
    currency: row.currency || 'INR',
    status: row.status,
    payout_id: row.payout_id,
    payout_reference: row.payout_reference,
    period_start: row.period_start ? new Date(row.period_start) : undefined,
    period_end: row.period_end ? new Date(row.period_end) : undefined,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at)
  };
};

export class SettlementRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async createSettlement(data: {
    providerId: string;
    bookingId: string;
    bookingDisplayId: string;
    serviceName?: string;
    variantName?: string;
    paymentType: 'online' | 'cod';
    grossAmount: number;
    commissionPercentage: number;
    commissionAmount: number;
    gstOnCommission: number;
    tdsAmount?: number;
    tcsAmount?: number;
    netPayableAmount: number;
    codDueAmount?: number;
    status?: string;
  }, client?: PoolClient): Promise<SettlementEntity> {
    const q = client || this.pool;
    const res = await q.query(
      `INSERT INTO provider.provider_settlements (
         provider_id, booking_id, booking_display_id, service_name, variant_name,
         payment_type, gross_amount, commission_percentage, commission_amount,
         gst_on_commission, tds_amount, tcs_amount, net_payable_amount,
         cod_due_amount, status
       ) VALUES (
         (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         (SELECT id FROM booking.bookings WHERE id::text = $2 OR legacy_mongo_id = $2 OR booking_id = $2 LIMIT 1),
         $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, 0), COALESCE($12, 0), $13, COALESCE($14, 0), COALESCE($15, 'pending_hold')
       )
       RETURNING *`,
      [
        data.providerId,
        data.bookingId,
        data.bookingDisplayId,
        data.serviceName || null,
        data.variantName || null,
        data.paymentType,
        data.grossAmount,
        data.commissionPercentage,
        data.commissionAmount,
        data.gstOnCommission,
        data.tdsAmount || 0,
        data.tcsAmount || 0,
        data.netPayableAmount,
        data.codDueAmount || 0,
        data.status || 'pending_hold'
      ]
    );
    return mapSettlementRow(res.rows[0]);
  }

  static async findById(id: string, client?: PoolClient): Promise<SettlementEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `SELECT * FROM provider.provider_settlements
       WHERE (id::text = $1 OR legacy_mongo_id = $1)
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapSettlementRow(res.rows[0]) : null;
  }

  static async findByBookingId(bookingId: string, client?: PoolClient): Promise<SettlementEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `SELECT * FROM provider.provider_settlements
       WHERE (booking_id::text = $1 OR booking_display_id = $1)
       LIMIT 1`,
      [bookingId]
    );
    return res.rows[0] ? mapSettlementRow(res.rows[0]) : null;
  }

  static async findByProviderId(
    providerId: string,
    status?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ settlements: SettlementEntity[]; total: number }> {
    const conditions = [`(provider_id::text = $1 OR legacy_mongo_id = $1)`];
    const values: any[] = [providerId];

    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const [settlementsRes, countRes] = await Promise.all([
      this.pool.query(
        `SELECT * FROM provider.provider_settlements
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS total FROM provider.provider_settlements ${whereClause}`,
        values
      )
    ]);

    return {
      settlements: settlementsRes.rows.map(mapSettlementRow),
      total: countRes.rows[0]?.total || 0
    };
  }

  static async findReadyForPayout(limit: number = 50, client?: PoolClient): Promise<SettlementEntity[]> {
    const q = client || this.pool;
    const res = await q.query(
      `SELECT * FROM provider.provider_settlements
       WHERE status = 'ready_for_payout'
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $1`,
      [limit]
    );
    return res.rows.map(mapSettlementRow);
  }

  static async updateStatus(
    id: string,
    status: string,
    updates: { payoutId?: string; payoutReference?: string } = {},
    client?: PoolClient
  ): Promise<SettlementEntity | null> {
    const q = client || this.pool;
    const setClauses = [`status = $2`, `updated_at = NOW()`];
    const values: any[] = [id, status];

    if (updates.payoutId) {
      values.push(updates.payoutId);
      setClauses.push(`payout_id = $${values.length}`);
    }
    if (updates.payoutReference) {
      values.push(updates.payoutReference);
      setClauses.push(`payout_reference = $${values.length}`);
    }

    const res = await q.query(
      `UPDATE provider.provider_settlements
       SET ${setClauses.join(', ')}
       WHERE (id::text = $1 OR legacy_mongo_id = $1)
       RETURNING *`,
      values
    );
    return res.rows[0] ? mapSettlementRow(res.rows[0]) : null;
  }

  static async aggregateProviderSettlements(providerId: string): Promise<{
    totalGross: number;
    totalNet: number;
    totalCommission: number;
    totalTds: number;
    totalTcs: number;
    pendingPayout: number;
  }> {
    const res = await this.pool.query(
      `SELECT 
         COALESCE(SUM(gross_amount), 0)::float AS total_gross,
         COALESCE(SUM(net_payable_amount), 0)::float AS total_net,
         COALESCE(SUM(commission_amount), 0)::float AS total_commission,
         COALESCE(SUM(tds_amount), 0)::float AS total_tds,
         COALESCE(SUM(tcs_amount), 0)::float AS total_tcs,
         COALESCE(SUM(CASE WHEN status = 'ready_for_payout' THEN net_payable_amount ELSE 0 END), 0)::float AS pending_payout
       FROM provider.provider_settlements
       WHERE (provider_id::text = $1 OR legacy_mongo_id = $1)`,
      [providerId]
    );
    const row = res.rows[0] || {};
    return {
      totalGross: row.total_gross || 0,
      totalNet: row.total_net || 0,
      totalCommission: row.total_commission || 0,
      totalTds: row.total_tds || 0,
      totalTcs: row.total_tcs || 0,
      pendingPayout: row.pending_payout || 0,
    };
  }
}
