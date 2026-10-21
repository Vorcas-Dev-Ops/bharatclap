import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';

export interface RefreshTokenRecord {
  id: string;
  user_id?: string | null;
  admin_id?: string | null;
  token_hash: string;
  device_info: string;
  ip_address: string;
  revoked: boolean;
  revoked_reason?: string | null;
  expires_at: Date;
  rotated_at?: Date | null;
  replaced_by_hash?: string | null;
  replacement_access_token?: string | null;
  created_at: Date;
  updated_at: Date;
}

export class RefreshTokenRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async saveToken(data: {
    userId?: string;
    adminId?: string;
    tokenHash: string;
    deviceInfo?: string;
    ipAddress?: string;
    expiresAt: Date;
  }, client?: Pool | PoolClient): Promise<RefreshTokenRecord> {
    const db = client || this.pool;
    try {
      const res = await db.query(
        `INSERT INTO auth.refresh_tokens (
          user_id, admin_id, token_hash, device_info, ip_address, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (token_hash) DO NOTHING
        RETURNING *`,
        [
          data.adminId ? null : (data.userId || null),
          data.adminId ?? null,
          data.tokenHash,
          data.deviceInfo || 'Unknown Device',
          data.ipAddress || 'Unknown IP',
          data.expiresAt,
        ]
      );
      if (!res.rows[0]) {
        throw new Error('Refresh token hash already recorded');
      }
      return res.rows[0];
    } catch (err: any) {
      if (err.code === '42703') {
        // Fallback before admin_id column exists
        const fallbackRes = await db.query(
          `INSERT INTO auth.refresh_tokens (
            user_id, token_hash, device_info, ip_address, expires_at
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (token_hash) DO NOTHING
          RETURNING *`,
          [
            data.userId,
            data.tokenHash,
            data.deviceInfo || 'Unknown Device',
            data.ipAddress || 'Unknown IP',
            data.expiresAt,
          ]
        );
        if (!fallbackRes.rows[0]) {
          throw new Error('Refresh token hash already recorded');
        }
        return fallbackRes.rows[0];
      }
      throw err;
    }
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

  static async revokeAllForAdmin(adminId: string): Promise<number> {
    try {
      const res = await this.pool.query(
        `UPDATE auth.refresh_tokens SET revoked = TRUE, updated_at = NOW() WHERE admin_id = $1 AND revoked = FALSE`,
        [adminId]
      );
      return res.rowCount ?? 0;
    } catch (err: any) {
      if (err.code === '42703') return 0;
      throw err;
    }
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
