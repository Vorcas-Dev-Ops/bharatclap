import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface OtpChallengeRecord {
  id: string;
  identifier: string;
  purpose: string;
  otp_hash: string;
  role: string;
  status: 'active' | 'consumed' | 'locked';
  attempts: number;
  consumed_at?: Date | null;
  locked_at?: Date | null;
  expires_at: Date;
  created_at: Date;
}

export class OtpRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async createChallenge(data: {
    identifier: string;
    purpose?: string;
    otpHash: string;
    role?: string;
    expiresAt: Date;
  }): Promise<OtpChallengeRecord> {
    const purpose = data.purpose || 'LOGIN_REGISTRATION';
    // Consume any existing active challenge for this identifier + purpose
    await this.pool.query(
      `UPDATE auth.otp_challenges
       SET status = 'consumed', consumed_at = NOW()
       WHERE identifier = $1 AND purpose = $2 AND status = 'active'`,
      [data.identifier, purpose]
    );

    const res = await this.pool.query(
      `INSERT INTO auth.otp_challenges (
        identifier, purpose, otp_hash, role, status, expires_at
      ) VALUES ($1, $2, $3, $4, 'active', $5)
      RETURNING *`,
      [
        data.identifier,
        purpose,
        data.otpHash,
        data.role || 'customer',
        data.expiresAt,
      ]
    );
    return res.rows[0];
  }

  static async findActive(identifier: string, purpose: string = 'LOGIN_REGISTRATION'): Promise<OtpChallengeRecord | null> {
    const res = await this.pool.query(
      `SELECT * FROM auth.otp_challenges
       WHERE identifier = $1
         AND purpose = $2
         AND status = 'active'
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [identifier, purpose]
    );
    return res.rows[0] || null;
  }

  static async findLatest(identifier: string, purpose: string = 'LOGIN_REGISTRATION'): Promise<OtpChallengeRecord | null> {
    const res = await this.pool.query(
      `SELECT * FROM auth.otp_challenges
       WHERE identifier = $1
         AND purpose = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [identifier, purpose]
    );
    return res.rows[0] || null;
  }

  static async incrementAttempts(id: string): Promise<number> {
    const res = await this.pool.query(
      `UPDATE auth.otp_challenges
       SET attempts = attempts + 1
       WHERE id::text = $1
       RETURNING attempts`,
      [id]
    );
    return res.rows[0]?.attempts ?? 0;
  }

  static async consume(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE auth.otp_challenges
       SET status = 'consumed', consumed_at = NOW()
       WHERE id::text = $1`,
      [id]
    );
  }

  static async lock(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE auth.otp_challenges
       SET status = 'locked', locked_at = NOW()
       WHERE id::text = $1`,
      [id]
    );
  }
}
