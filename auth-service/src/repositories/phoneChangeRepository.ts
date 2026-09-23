import { getDb } from '../config/db';

export interface PendingPhoneChangeEntity {
  id: string;
  _id: string;
  user_id: string;
  new_phone: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export class PhoneChangeRepository {
  static async createPendingChange(userId: string, newPhone: string): Promise<PendingPhoneChangeEntity> {
    const pool = getDb();
    // Invalidate existing pending changes
    await pool.query(
      `UPDATE auth.pending_phone_changes SET status = 'cancelled', updated_at = NOW() WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );

    const res = await pool.query(
      `INSERT INTO auth.pending_phone_changes (user_id, new_phone, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [userId, newPhone]
    );
    const row = res.rows[0];
    return { ...row, _id: row.id };
  }

  static async findPendingChange(userId: string): Promise<PendingPhoneChangeEntity | null> {
    const pool = getDb();
    const res = await pool.query(
      `SELECT * FROM auth.pending_phone_changes WHERE user_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return { ...row, _id: row.id };
  }

  static async countChangesToday(userId: string, since: Date): Promise<number> {
    const pool = getDb();
    const res = await pool.query(
      `SELECT COUNT(*)::int AS count FROM auth.phone_change_history WHERE user_id = $1 AND created_at >= $2`,
      [userId, since]
    );
    return res.rows[0].count;
  }

  static async recordHistory(client: any, userId: string, oldPhone: string, newPhone: string): Promise<void> {
    await client.query(
      `INSERT INTO auth.phone_change_history (user_id, old_phone, new_phone)
       VALUES ($1, $2, $3)`,
      [userId, oldPhone, newPhone]
    );
  }

  static async markPendingVerified(client: any, id: string): Promise<void> {
    await client.query(
      `UPDATE auth.pending_phone_changes SET status = 'verified', updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  static async cancelPending(userId: string): Promise<void> {
    const pool = getDb();
    await pool.query(
      `DELETE FROM auth.pending_phone_changes WHERE user_id = $1`,
      [userId]
    );
  }
}
