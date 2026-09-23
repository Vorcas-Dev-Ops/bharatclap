import { getDb } from '../config/db';

export interface AccountDeletionRequestEntity {
  id: string;
  _id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  reason?: string;
  scheduled_at?: Date;
  processed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AccountDeletionOutboxEntity {
  id: string;
  _id: string;
  event_id: string;
  user_id: string;
  event_type: string;
  payload: any;
  status: 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'DLQ';
  attempts: number;
  created_at: Date;
  updated_at: Date;
}

export class AccountDeletionRepository {
  static async createRequest(
    userId: string,
    reason?: string,
    scheduledAt?: Date,
    client?: any
  ): Promise<AccountDeletionRequestEntity> {
    const db = client || getDb();
    const res = await db.query(
      `INSERT INTO auth.account_deletion_requests (user_id, status, reason, scheduled_at)
       VALUES ($1, 'pending', $2, $3)
       RETURNING *`,
      [userId, reason || null, scheduledAt || null]
    );
    const row = res.rows[0];
    return { ...row, _id: row.id };
  }

  static async findActiveRequest(userId: string): Promise<AccountDeletionRequestEntity | null> {
    const pool = getDb();
    const res = await pool.query(
      `SELECT * FROM auth.account_deletion_requests
       WHERE user_id = $1 AND status IN ('pending', 'processing')
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return { ...row, _id: row.id };
  }

  static async findById(id: string): Promise<AccountDeletionRequestEntity | null> {
    const pool = getDb();
    const res = await pool.query(
      `SELECT * FROM auth.account_deletion_requests WHERE id = $1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return { ...row, _id: row.id };
  }

  static async updateStatus(
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'cancelled',
    processedAt?: Date,
    client?: any
  ): Promise<AccountDeletionRequestEntity | null> {
    const db = client || getDb();
    const res = await db.query(
      `UPDATE auth.account_deletion_requests
       SET status = $1, processed_at = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, processedAt || null, id]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return { ...row, _id: row.id };
  }

  static async listRequests(limit: number = 20, offset: number = 0): Promise<{ data: AccountDeletionRequestEntity[]; total: number }> {
    const pool = getDb();
    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM auth.account_deletion_requests`);
    const total = countRes.rows[0].total;

    const res = await pool.query(
      `SELECT * FROM auth.account_deletion_requests
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const data = res.rows.map(r => ({ ...r, _id: r.id }));
    return { data, total };
  }

  static async createOutboxEvent(
    eventId: string,
    userId: string,
    eventType: string,
    payload: any,
    client?: any
  ): Promise<AccountDeletionOutboxEntity> {
    const db = client || getDb();
    const res = await db.query(
      `INSERT INTO auth.account_deletion_outbox (event_id, user_id, event_type, payload, status, attempts)
       VALUES ($1, $2, $3, $4, 'PENDING', 0)
       ON CONFLICT (event_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [eventId, userId, eventType, JSON.stringify(payload)]
    );
    const row = res.rows[0];
    return { ...row, _id: row.id };
  }

  static async findPendingOutbox(limit: number = 10): Promise<AccountDeletionOutboxEntity[]> {
    const pool = getDb();
    const res = await pool.query(
      `SELECT * FROM auth.account_deletion_outbox
       WHERE status = 'PENDING' AND attempts < 5
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );
    return res.rows.map(r => ({ ...r, _id: r.id }));
  }

  static async updateOutboxStatus(
    id: string,
    status: 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'DLQ',
    attempts?: number,
    client?: any
  ): Promise<void> {
    const db = client || getDb();
    if (attempts !== undefined) {
      await db.query(
        `UPDATE auth.account_deletion_outbox
         SET status = $1, attempts = $2, updated_at = NOW()
         WHERE id = $3`,
        [status, attempts, id]
      );
    } else {
      await db.query(
        `UPDATE auth.account_deletion_outbox
         SET status = $1, updated_at = NOW()
         WHERE id = $2`,
        [status, id]
      );
    }
  }
}
