import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  device_info: string;
  ip_address: string;
  revoked: boolean;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export class RefreshTokenRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async saveToken(data: {
    userId: string;
    tokenHash: string;
    deviceInfo?: string;
    ipAddress?: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    const res = await this.pool.query(
      `INSERT INTO auth.refresh_tokens (
        user_id, token_hash, device_info, ip_address, expires_at
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (token_hash) DO UPDATE
      SET device_info = EXCLUDED.device_info,
          ip_address = EXCLUDED.ip_address,
          expires_at = EXCLUDED.expires_at,
          revoked = FALSE,
          updated_at = NOW()
      RETURNING *`,
      [
        data.userId,
        data.tokenHash,
        data.deviceInfo || 'Unknown Device',
        data.ipAddress || 'Unknown IP',
        data.expiresAt,
      ]
    );
    return res.rows[0];
  }

  static async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const res = await this.pool.query(
      `SELECT * FROM auth.refresh_tokens WHERE token_hash = $1 LIMIT 1`,
      [tokenHash]
    );
    return res.rows[0] || null;
  }

  static async revokeToken(tokenHash: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE auth.refresh_tokens SET revoked = TRUE, updated_at = NOW() WHERE token_hash = $1`,
      [tokenHash]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async revokeAllForUser(userId: string): Promise<number> {
    const res = await this.pool.query(
      `UPDATE auth.refresh_tokens SET revoked = TRUE, updated_at = NOW() WHERE user_id::text = $1 AND revoked = FALSE`,
      [userId]
    );
    return res.rowCount ?? 0;
  }

  static async getActiveSessions(userId: string): Promise<RefreshTokenRecord[]> {
    const res = await this.pool.query(
      `SELECT * FROM auth.refresh_tokens
       WHERE user_id::text = $1
         AND revoked = FALSE
         AND expires_at > NOW()
       ORDER BY updated_at DESC`,
      [userId]
    );
    return res.rows;
  }

  static async deleteSessionById(sessionId: string, userId: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM auth.refresh_tokens WHERE (id::text = $1 OR legacy_mongo_id = $1) AND user_id::text = $2`,
      [sessionId, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async deleteAllForUser(userId: string): Promise<number> {
    const res = await this.pool.query(
      `DELETE FROM auth.refresh_tokens WHERE user_id::text = $1`,
      [userId]
    );
    return res.rowCount ?? 0;
  }
}
