import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';

export interface JobRequestEntity {
  id: string;
  provider_id: string;
  booking_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  offered_at: Date;
  responded_at?: Date;
  response_time_seconds?: number;
  created_at: Date;
  updated_at: Date;
}

export const mapJobRequestRow = (row: any): JobRequestEntity => {
  if (!row) return null as any;
  return {
    id: String(row.id),
    provider_id: String(row.provider_id),
    booking_id: String(row.booking_id),
    status: row.status,
    offered_at: new Date(row.offered_at),
    responded_at: row.responded_at ? new Date(row.responded_at) : undefined,
    response_time_seconds: row.response_time_seconds ? Number(row.response_time_seconds) : undefined,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at)
  };
};

export class JobRequestRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async create(data: {
    providerId: string;
    bookingId: string;
    status?: string;
  }, client?: PoolClient): Promise<JobRequestEntity> {
    const q = client || this.pool;
    const res = await q.query(
      `INSERT INTO provider.job_requests (
         provider_id, booking_id, status, offered_at
       ) VALUES (
         (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         (SELECT id FROM booking.bookings WHERE id::text = $2 OR legacy_mongo_id = $2 OR booking_id = $2 LIMIT 1),
         COALESCE($3, 'pending'),
         NOW()
       )
       RETURNING *`,
      [data.providerId, data.bookingId, data.status]
    );
    return mapJobRequestRow(res.rows[0]);
  }

  static async findByBookingAndProvider(bookingId: string, providerId: string): Promise<JobRequestEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM provider.job_requests
       WHERE (booking_id::text = $1 OR booking_id IN (SELECT id FROM booking.bookings WHERE booking_id = $1 OR legacy_mongo_id = $1))
         AND (provider_id::text = $2 OR provider_id IN (SELECT id FROM provider.providers WHERE legacy_mongo_id = $2))
       ORDER BY offered_at DESC
       LIMIT 1`,
      [bookingId, providerId]
    );
    return res.rows[0] ? mapJobRequestRow(res.rows[0]) : null;
  }

  static async updateStatus(
    id: string,
    status: 'accepted' | 'rejected' | 'expired' | 'cancelled',
    responseTimeSeconds?: number,
    client?: PoolClient
  ): Promise<JobRequestEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `UPDATE provider.job_requests
       SET status = $2,
           responded_at = NOW(),
           response_time_seconds = COALESCE($3, EXTRACT(EPOCH FROM (NOW() - offered_at))::int),
           updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1)
       RETURNING *`,
      [id, status, responseTimeSeconds || null]
    );
    return res.rows[0] ? mapJobRequestRow(res.rows[0]) : null;
  }

  static async expirePendingRequests(olderThanMinutes: number = 5): Promise<number> {
    const res = await this.pool.query(
      `UPDATE provider.job_requests
       SET status = 'expired',
           updated_at = NOW()
       WHERE status = 'pending'
         AND offered_at <= NOW() - ($1 || ' minutes')::interval`,
      [olderThanMinutes]
    );
    return res.rowCount || 0;
  }
}
