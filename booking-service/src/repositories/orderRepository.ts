import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface OrderEntity {
  id: string;
  _id: string;
  user_id: string;
  userId: string;
  items: any[];
  total_amount: number;
  totalAmount: number;
  currency: string;
  status: string;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export const mapOrderRow = (row: any): OrderEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const uIdStr = String(row.user_id);
  const items = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []);

  return {
    id: idStr,
    _id: idStr,
    user_id: uIdStr,
    userId: uIdStr,
    items,
    total_amount: parseFloat(row.total_amount || 0),
    totalAmount: parseFloat(row.total_amount || 0),
    currency: row.currency || 'INR',
    status: row.status || 'pending',
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
};

export class OrderRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findById(id: string): Promise<OrderEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM booking.orders WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapOrderRow(res.rows[0]) : null;
  }

  static async findByUserId(userId: string): Promise<OrderEntity[]> {
    const res = await this.pool.query(
      `SELECT * FROM booking.orders
       WHERE user_id::text = $1 OR user_id = (SELECT id FROM auth.users WHERE legacy_mongo_id = $1 LIMIT 1)
       ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows.map(mapOrderRow);
  }

  static async create(data: {
    userId: string;
    items: any[];
    totalAmount: number;
    currency?: string;
    status?: string;
  }): Promise<OrderEntity> {
    const res = await this.pool.query(
      `INSERT INTO booking.orders (user_id, items, total_amount, currency, status)
       VALUES (
         (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         $2, $3, $4, $5
       ) RETURNING *`,
      [
        data.userId,
        JSON.stringify(data.items || []),
        data.totalAmount,
        data.currency || 'INR',
        data.status || 'pending',
      ]
    );
    return mapOrderRow(res.rows[0]);
  }
}
