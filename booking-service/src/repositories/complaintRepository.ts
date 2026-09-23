import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface ComplaintEntity {
  id: string;
  _id: string;
  booking_id: string;
  bookingId: string;
  user_id: string;
  userId: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export const mapComplaintRow = (row: any): ComplaintEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);

  return {
    id: idStr,
    _id: idStr,
    booking_id: String(row.booking_id),
    bookingId: String(row.booking_id),
    user_id: String(row.user_id),
    userId: String(row.user_id),
    description: row.description,
    status: row.status || 'open',
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
};

export class ComplaintRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findById(id: string): Promise<ComplaintEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM booking.complaints WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapComplaintRow(res.rows[0]) : null;
  }

  static async findByBookingId(bookingId: string): Promise<ComplaintEntity[]> {
    const res = await this.pool.query(
      `SELECT * FROM booking.complaints WHERE booking_id::text = $1 OR legacy_mongo_id = $1 ORDER BY created_at DESC`,
      [bookingId]
    );
    return res.rows.map(mapComplaintRow);
  }

  static async findByUserId(userId: string): Promise<ComplaintEntity[]> {
    const res = await this.pool.query(
      `SELECT * FROM booking.complaints
       WHERE user_id::text = $1 OR user_id = (SELECT id FROM auth.users WHERE legacy_mongo_id = $1 LIMIT 1)
       ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows.map(mapComplaintRow);
  }

  static async create(data: {
    bookingId: string;
    userId: string;
    description: string;
    status?: string;
  }): Promise<ComplaintEntity> {
    const res = await this.pool.query(
      `INSERT INTO booking.complaints (booking_id, user_id, description, status)
       VALUES (
         (SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
         $3, $4
       ) RETURNING *`,
      [
        data.bookingId,
        data.userId,
        data.description,
        data.status || 'open',
      ]
    );
    return mapComplaintRow(res.rows[0]);
  }

  static async updateStatus(id: string, status: string): Promise<ComplaintEntity | null> {
    const res = await this.pool.query(
      `UPDATE booking.complaints
       SET status = $1, updated_at = NOW()
       WHERE id::text = $2 OR legacy_mongo_id = $2
       RETURNING *`,
      [status, id]
    );
    return res.rows[0] ? mapComplaintRow(res.rows[0]) : null;
  }
}
