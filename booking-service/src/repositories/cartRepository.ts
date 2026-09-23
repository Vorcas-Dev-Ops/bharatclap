import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface CartEntity {
  id: string;
  _id: string;
  user_id: string;
  userId: string;
  items: any[];
  total: number;
  total_amount: number;
  currency: string;
  preferred_date?: string;
  preferred_start_time?: string;
  scheduling_mode?: string;
  created_at: Date;
  updated_at: Date;
}

export const mapCartRow = (row: any): CartEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const uIdStr = String(row.user_id);
  const items = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []);
  const totalVal = parseFloat(row.total || 0);

  return {
    id: idStr,
    _id: idStr,
    user_id: uIdStr,
    userId: uIdStr,
    items,
    total: totalVal,
    total_amount: totalVal,
    currency: row.currency || 'INR',
    preferred_date: row.preferred_date || undefined,
    preferred_start_time: row.preferred_start_time || undefined,
    scheduling_mode: row.scheduling_mode || undefined,
    created_at: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
  };
};

export class CartRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findByUserId(userId: string): Promise<CartEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM booking.carts
       WHERE user_id::text = $1 OR legacy_mongo_id = $1
          OR user_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1)
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId]
    );
    return res.rows[0] ? mapCartRow(res.rows[0]) : null;
  }

  static async createOrUpdate(userId: string, items: any[], total?: number): Promise<CartEntity> {
    const calculatedTotal = total !== undefined
      ? total
      : items.reduce((acc, item) => acc + (parseFloat(item.price || item.base_price || 0) * (item.quantity || 1)), 0);

    const existing = await this.findByUserId(userId);
    if (existing) {
      const res = await this.pool.query(
        `UPDATE booking.carts
         SET items = $1, total = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [JSON.stringify(items), calculatedTotal, existing.id]
      );
      return mapCartRow(res.rows[0]);
    } else {
      const res = await this.pool.query(
        `INSERT INTO booking.carts (user_id, items, total)
         VALUES (
           (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
           $2, $3
         ) RETURNING *`,
        [userId, JSON.stringify(items), calculatedTotal]
      );
      return mapCartRow(res.rows[0]);
    }
  }

  static async clearCart(userId: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE booking.carts
       SET items = '[]'::jsonb, total = 0, updated_at = NOW()
       WHERE user_id::text = $1 OR legacy_mongo_id = $1
          OR user_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1)`,
      [userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async deleteCart(userId: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM booking.carts
       WHERE user_id::text = $1 OR legacy_mongo_id = $1
          OR user_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1)`,
      [userId]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
