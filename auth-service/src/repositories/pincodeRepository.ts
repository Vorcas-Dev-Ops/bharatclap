import { getDb } from '../config/db';

export interface PincodeCacheEntity {
  id: string;
  pincode: string;
  city?: string;
  state?: string;
  created_at: Date;
}

export class PincodeRepository {
  static async findByPincode(pincode: string): Promise<PincodeCacheEntity | null> {
    const pool = getDb();
    const res = await pool.query(
      `SELECT * FROM auth.pincode_cache WHERE pincode = $1 LIMIT 1`,
      [pincode]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  static async cachePincode(pincode: string, city?: string, state?: string): Promise<PincodeCacheEntity> {
    const pool = getDb();
    const res = await pool.query(
      `INSERT INTO auth.pincode_cache (pincode, city, state)
       VALUES ($1, $2, $3)
       ON CONFLICT (pincode) DO UPDATE SET city = EXCLUDED.city, state = EXCLUDED.state
       RETURNING *`,
      [pincode, city || null, state || null]
    );
    return res.rows[0];
  }
}
