import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface CouponUsageEntity {
  id: string;
  _id: string;
  coupon_id: string;
  couponId: string;
  user_id: string;
  userId: string;
  booking_id: string;
  bookingId: string;
  created_at: Date;
  createdAt: Date;
  usedAt: Date;
}

const mapUsageRow = (r: any): CouponUsageEntity => ({
  id: String(r.id),
  _id: String(r.id),
  coupon_id: String(r.coupon_id),
  couponId: String(r.coupon_id),
  user_id: String(r.user_id),
  userId: String(r.user_id),
  booking_id: String(r.booking_id),
  bookingId: String(r.booking_id),
  created_at: new Date(r.created_at),
  createdAt: new Date(r.created_at),
  usedAt: new Date(r.created_at),
});

export class CouponUsageRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async getCouponUsages(
    couponId: string,
    page = 1,
    limit = 50
  ): Promise<CouponUsageEntity[]> {
    const offset = (page - 1) * limit;
    const res = await this.pool.query(
      `SELECT * FROM payment.coupon_usages
       WHERE coupon_id::text = $1 OR legacy_mongo_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [couponId, limit, offset]
    );
    return res.rows.map(mapUsageRow);
  }

  static async getCouponUsageStats(): Promise<{ totalRedemptions: number; totalDiscountGiven: number }> {
    const res = await this.pool.query(
      `SELECT COUNT(*)::int as count FROM payment.coupon_usages`
    );
    const totalRedemptions = res.rows[0]?.count || 0;
    return {
      totalRedemptions,
      totalDiscountGiven: 0,
    };
  }

  static async getCouponDailyUsage(couponId: string): Promise<Array<{ _id: string; count: number; discount: number }>> {
    const res = await this.pool.query(
      `SELECT
         TO_CHAR(created_at, 'YYYY-MM-DD') as day,
         COUNT(*)::int as count
       FROM payment.coupon_usages
       WHERE (coupon_id::text = $1 OR legacy_mongo_id = $1)
         AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
       ORDER BY day ASC`,
      [couponId]
    );
    return res.rows.map(r => ({
      _id: r.day,
      count: r.count,
      discount: 0,
    }));
  }

  static async deleteCouponUsages(couponId: string): Promise<number> {
    const res = await this.pool.query(
      `DELETE FROM payment.coupon_usages
       WHERE coupon_id::text = $1 OR legacy_mongo_id = $1`,
      [couponId]
    );
    return res.rowCount || 0;
  }
}
