import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface RefundPolicyEntity {
  id: string;
  _id: string;
  category_id?: string;
  categoryId?: string;
  hours_before_threshold: number;
  cancelWithinBookingHours: number;
  refund_percentage: number;
  bookingCancellationFee: number;
  lastMinuteHours: number;
  lastMinuteCancellationFee: number;
  allowCancellationAfterProviderAssigned: boolean;
  allowCancellationAfterServiceStarted: boolean;
  created_at: Date;
  updated_at: Date;
}

export const mapRefundPolicyRow = (row: any): RefundPolicyEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const hours = Number(row.hours_before_threshold) || 24;
  const pct = parseFloat(row.refund_percentage || 100);

  return {
    id: idStr,
    _id: idStr,
    category_id: row.category_id ? String(row.category_id) : undefined,
    categoryId: row.category_id ? String(row.category_id) : undefined,
    hours_before_threshold: hours,
    cancelWithinBookingHours: hours,
    refund_percentage: pct,
    bookingCancellationFee: Math.max(0, 100 - pct),
    lastMinuteHours: 2,
    lastMinuteCancellationFee: 50,
    allowCancellationAfterProviderAssigned: true,
    allowCancellationAfterServiceStarted: false,
    created_at: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
  };
};

export class RefundPolicyRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async getPolicy(): Promise<RefundPolicyEntity> {
    const res = await this.pool.query(
      `SELECT * FROM booking.refund_policies ORDER BY created_at ASC LIMIT 1`
    );

    if (res.rows[0]) {
      return mapRefundPolicyRow(res.rows[0]);
    }

    const insertRes = await this.pool.query(
      `INSERT INTO booking.refund_policies (hours_before_threshold, refund_percentage)
       VALUES (24, 100) RETURNING *`
    );
    return mapRefundPolicyRow(insertRes.rows[0]);
  }

  static async updatePolicy(updates: Partial<RefundPolicyEntity>): Promise<RefundPolicyEntity> {
    const hours = updates.cancelWithinBookingHours ?? updates.hours_before_threshold ?? 24;
    const fee = updates.bookingCancellationFee;
    const pct = updates.refund_percentage ?? (fee !== undefined ? Math.max(0, 100 - fee) : 100);

    const current = await this.getPolicy();
    const res = await this.pool.query(
      `UPDATE booking.refund_policies
       SET hours_before_threshold = $1,
           refund_percentage = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [hours, pct, current.id]
    );

    return mapRefundPolicyRow(res.rows[0]);
  }
}
