import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface CouponRedemptionEntity {
  id: string;
  _id: string;
  coupon_id: string;
  couponId: string;
  user_id: string;
  userId: string;
  booking_id: string;
  bookingId: string;
  discount_amount: number;
  discountApplied: number;
  currency: string;
  created_at: Date;
  createdAt: Date;
}

export const mapRedemptionRow = (row: any): CouponRedemptionEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const cIdStr = String(row.coupon_id);
  const uIdStr = String(row.user_id);
  const bIdStr = String(row.booking_id);
  const disc = parseFloat(row.discount_amount || 0);

  return {
    id: idStr,
    _id: idStr,
    coupon_id: cIdStr,
    couponId: cIdStr,
    user_id: uIdStr,
    userId: uIdStr,
    booking_id: bIdStr,
    bookingId: bIdStr,
    discount_amount: disc,
    discountApplied: disc,
    currency: row.currency || 'INR',
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
  };
};

export class CouponRedemptionRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async countUserRedemptions(couponId: string, userId: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM booking.coupon_redemptions
       WHERE (coupon_id::text = $1 OR coupon_id = (SELECT id FROM catalog.coupons WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1))
         AND (user_id::text = $2 OR user_id = (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1))`,
      [couponId, userId]
    );
    return res.rows[0]?.cnt || 0;
  }

  static async countTotalUses(couponCodeOrId: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM booking.coupon_redemptions
       WHERE coupon_id::text = $1
          OR coupon_id = (SELECT id FROM catalog.coupons WHERE id::text = $1 OR code = $1 OR legacy_mongo_id = $1 LIMIT 1)`,
      [couponCodeOrId]
    );
    return res.rows[0]?.cnt || 0;
  }

  static async create(data: {
    couponId: string;
    userId: string;
    bookingId: string;
    discountAmount: number;
    currency?: string;
  }): Promise<CouponRedemptionEntity> {
    const res = await this.pool.query(
      `INSERT INTO booking.coupon_redemptions (coupon_id, user_id, booking_id, discount_amount, currency)
       VALUES (
         COALESCE((SELECT id FROM catalog.coupons WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1), $1::uuid),
         COALESCE((SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1), $2::uuid),
         COALESCE((SELECT id FROM booking.bookings WHERE id::text = $3 OR legacy_mongo_id = $3 OR booking_id = $3 LIMIT 1), $3::uuid),
         $4,
         $5
       ) RETURNING *`,
      [data.couponId, data.userId, data.bookingId, data.discountAmount, data.currency || 'INR']
    );
    return mapRedemptionRow(res.rows[0]);
  }

  static async deleteByBookingId(bookingId: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM booking.coupon_redemptions
       WHERE booking_id::text = $1
          OR booking_id = (SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1 LIMIT 1)`,
      [bookingId]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
