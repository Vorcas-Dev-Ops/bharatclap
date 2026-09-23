import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface UserEntity {
  id: string;
  _id: string;
  name: string;
  email: string | null;
  phone: string | null;
  password?: string;
  password_hash?: string;
  role: 'admin' | 'customer' | 'provider';
  admin_role?: 'super_admin' | 'operations_admin' | 'support_admin' | 'finance_admin';
  permissions: string[];
  profile_image?: string;
  status: 'active' | 'blocked';
  gender?: string;
  date_of_birth?: Date;
  isDeleted: boolean;
  deleted_at?: Date | null;
  lastLogin?: Date | null;
  last_login?: Date | null;
  isEmailVerified: boolean;
  is_email_verified: boolean;
  isPhoneVerified: boolean;
  is_phone_verified: boolean;
  tokenVersion: number;
  token_version: number;
  googleId?: string;
  google_id?: string;
  authProvider?: 'local' | 'google';
  auth_provider?: 'local' | 'google';
  referralCode?: string;
  referral_code?: string;
  twoFactorEnabled?: boolean;
  two_factor_enabled?: boolean;
  twoFactorSecret?: string;
  two_factor_secret?: string;
  twoFactorRecoveryCodes?: string[];
  two_factor_recovery?: string[];
  failedOtpAttempts: number;
  failed_otp_attempts: number;
  otpLockedUntil?: Date | null;
  otp_locked_until?: Date | null;
  deletion_requested_at?: Date | null;
  deletion_scheduled_at?: Date | null;
  is_anonymized?: boolean;
  consent_given_at?: Date | null;
  consent_version?: string;
  legacy_mongo_id?: string | null;
  version: number;
  createdAt: Date;
  created_at: Date;
  updatedAt: Date;
  updated_at: Date;
}

export const mapUserRow = (row: any): UserEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const isDel = row.deleted_at !== null && row.deleted_at !== undefined;

  return {
    id: idStr,
    _id: idStr,
    name: row.name || '',
    email: row.email || null,
    phone: row.phone || null,
    password: row.password_hash || undefined,
    password_hash: row.password_hash || undefined,
    role: row.role || 'customer',
    admin_role: row.admin_role || undefined,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    profile_image: row.profile_image || '',
    status: row.status || 'active',
    gender: row.gender || undefined,
    date_of_birth: row.date_of_birth ? new Date(row.date_of_birth) : undefined,
    isDeleted: isDel,
    deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
    lastLogin: row.last_login ? new Date(row.last_login) : null,
    last_login: row.last_login ? new Date(row.last_login) : null,
    isEmailVerified: Boolean(row.is_email_verified),
    is_email_verified: Boolean(row.is_email_verified),
    isPhoneVerified: Boolean(row.is_phone_verified),
    is_phone_verified: Boolean(row.is_phone_verified),
    tokenVersion: row.token_version ?? 0,
    token_version: row.token_version ?? 0,
    googleId: row.google_id || undefined,
    google_id: row.google_id || undefined,
    authProvider: row.auth_provider || 'local',
    auth_provider: row.auth_provider || 'local',
    referralCode: row.referral_code || undefined,
    referral_code: row.referral_code || undefined,
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    two_factor_enabled: Boolean(row.two_factor_enabled),
    twoFactorSecret: row.two_factor_secret || undefined,
    two_factor_secret: row.two_factor_secret || undefined,
    twoFactorRecoveryCodes: Array.isArray(row.two_factor_recovery) ? row.two_factor_recovery : [],
    two_factor_recovery: Array.isArray(row.two_factor_recovery) ? row.two_factor_recovery : [],
    failedOtpAttempts: row.failed_otp_attempts ?? 0,
    failed_otp_attempts: row.failed_otp_attempts ?? 0,
    otpLockedUntil: row.otp_locked_until ? new Date(row.otp_locked_until) : null,
    otp_locked_until: row.otp_locked_until ? new Date(row.otp_locked_until) : null,
    deletion_requested_at: row.deletion_requested_at ? new Date(row.deletion_requested_at) : null,
    deletion_scheduled_at: row.deletion_scheduled_at ? new Date(row.deletion_scheduled_at) : null,
    is_anonymized: Boolean(row.is_anonymized),
    consent_given_at: row.consent_given_at ? new Date(row.consent_given_at) : null,
    consent_version: row.consent_version || 'v1.0',
    legacy_mongo_id: row.legacy_mongo_id || null,
    version: row.version ?? 1,
    createdAt: new Date(row.created_at || Date.now()),
    created_at: new Date(row.created_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
  };
};

export class UserRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findById(id: string): Promise<UserEntity | null> {
    if (!id) return null;
    const res = await this.pool.query(
      `SELECT * FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  }

  static async findByEmail(email: string): Promise<UserEntity | null> {
    if (!email) return null;
    const res = await this.pool.query(
      `SELECT * FROM auth.users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
      [email.trim()]
    );
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  }

  static async findByPhone(phone: string): Promise<UserEntity | null> {
    if (!phone) return null;
    const res = await this.pool.query(
      `SELECT * FROM auth.users WHERE phone = $1 AND deleted_at IS NULL LIMIT 1`,
      [phone.trim()]
    );
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  }

  static async findByEmailOrPhone(email?: string, phone?: string): Promise<UserEntity | null> {
    if (!email && !phone) return null;
    const conditions: string[] = [];
    const values: any[] = [];

    if (email) {
      values.push(email.trim().toLowerCase());
      conditions.push(`LOWER(email) = $${values.length}`);
    }
    if (phone) {
      values.push(phone.trim());
      conditions.push(`phone = $${values.length}`);
    }

    const res = await this.pool.query(
      `SELECT * FROM auth.users WHERE (${conditions.join(' OR ')}) AND deleted_at IS NULL LIMIT 1`,
      values
    );
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  }

  static async findByGoogleId(googleId: string): Promise<UserEntity | null> {
    if (!googleId) return null;
    const res = await this.pool.query(
      `SELECT * FROM auth.users WHERE google_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [googleId]
    );
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  }

  static async findByReferralCode(code: string): Promise<UserEntity | null> {
    if (!code) return null;
    const res = await this.pool.query(
      `SELECT * FROM auth.users WHERE UPPER(referral_code) = UPPER($1) AND deleted_at IS NULL LIMIT 1`,
      [code.trim()]
    );
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  }

  static async create(data: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    password?: string;
    password_hash?: string;
    role?: 'admin' | 'customer' | 'provider';
    admin_role?: string;
    permissions?: string[];
    profile_image?: string;
    status?: 'active' | 'blocked';
    gender?: string;
    date_of_birth?: Date;
    auth_provider?: 'local' | 'google';
    google_id?: string;
    referral_code?: string;
    is_phone_verified?: boolean;
    is_email_verified?: boolean;
  }): Promise<UserEntity> {
    const pwdHash = data.password_hash || data.password || null;
    const res = await this.pool.query(
      `INSERT INTO auth.users (
        name, email, phone, password_hash, role, admin_role, permissions,
        profile_image, status, gender, date_of_birth, auth_provider,
        google_id, referral_code, is_phone_verified, is_email_verified
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING *`,
      [
        data.name || null,
        data.email ? data.email.trim().toLowerCase() : null,
        data.phone ? data.phone.trim() : null,
        pwdHash,
        data.role || 'customer',
        data.admin_role || null,
        data.permissions || [],
        data.profile_image || '',
        data.status || 'active',
        data.gender || null,
        data.date_of_birth || null,
        data.auth_provider || 'local',
        data.google_id || null,
        data.referral_code || null,
        Boolean(data.is_phone_verified),
        Boolean(data.is_email_verified),
      ]
    );
    return mapUserRow(res.rows[0]);
  }

  static async update(id: string, updates: Record<string, any>): Promise<UserEntity | null> {
    if (!id) return null;

    const fieldMap: Record<string, string> = {
      name: 'name',
      email: 'email',
      phone: 'phone',
      password: 'password_hash',
      password_hash: 'password_hash',
      role: 'role',
      admin_role: 'admin_role',
      permissions: 'permissions',
      profile_image: 'profile_image',
      status: 'status',
      gender: 'gender',
      date_of_birth: 'date_of_birth',
      lastLogin: 'last_login',
      last_login: 'last_login',
      isEmailVerified: 'is_email_verified',
      is_email_verified: 'is_email_verified',
      isPhoneVerified: 'is_phone_verified',
      is_phone_verified: 'is_phone_verified',
      tokenVersion: 'token_version',
      token_version: 'token_version',
      googleId: 'google_id',
      google_id: 'google_id',
      referralCode: 'referral_code',
      referral_code: 'referral_code',
      twoFactorEnabled: 'two_factor_enabled',
      two_factor_enabled: 'two_factor_enabled',
      twoFactorSecret: 'two_factor_secret',
      two_factor_secret: 'two_factor_secret',
      twoFactorRecoveryCodes: 'two_factor_recovery',
      two_factor_recovery: 'two_factor_recovery',
      failedOtpAttempts: 'failed_otp_attempts',
      failed_otp_attempts: 'failed_otp_attempts',
      otpLockedUntil: 'otp_locked_until',
      otp_locked_until: 'otp_locked_until',
      deletion_requested_at: 'deletion_requested_at',
      deletion_scheduled_at: 'deletion_scheduled_at',
      is_anonymized: 'is_anonymized',
      consent_given_at: 'consent_given_at',
      consent_version: 'consent_version',
      deleted_at: 'deleted_at',
    };

    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [id];

    for (const [key, val] of Object.entries(updates)) {
      const col = fieldMap[key];
      if (col) {
        values.push(val);
        setClauses.push(`${col} = $${values.length}`);
      }
    }

    if (setClauses.length === 1) {
      return this.findById(id);
    }

    const query = `
      UPDATE auth.users
      SET ${setClauses.join(', ')}
      WHERE id::text = $1 OR legacy_mongo_id = $1
      RETURNING *
    `;
    const res = await this.pool.query(query, values);
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  }

  static async recordLogin(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE auth.users SET last_login = NOW(), updated_at = NOW() WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [id]
    );
  }

  static async incrementTokenVersion(id: string): Promise<number> {
    const res = await this.pool.query(
      `UPDATE auth.users SET token_version = token_version + 1, updated_at = NOW() WHERE id::text = $1 OR legacy_mongo_id = $1 RETURNING token_version`,
      [id]
    );
    return res.rows[0]?.token_version ?? 0;
  }

  static async softDelete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE auth.users SET deleted_at = NOW(), status = 'blocked', updated_at = NOW() WHERE (id::text = $1 OR legacy_mongo_id = $1) AND deleted_at IS NULL`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async listAdmins(): Promise<UserEntity[]> {
    const res = await this.pool.query(
      `SELECT * FROM auth.users WHERE role = 'admin' AND deleted_at IS NULL ORDER BY created_at DESC`
    );
    return res.rows.map(mapUserRow);
  }

  static async findWithPagination(options: {
    page?: number;
    limit?: number;
    role?: string;
    status?: string;
    search?: string;
  }): Promise<{ users: UserEntity[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['deleted_at IS NULL'];
    const values: any[] = [];

    if (options.role) {
      values.push(options.role);
      conditions.push(`role = $${values.length}`);
    }
    if (options.status) {
      values.push(options.status);
      conditions.push(`status = $${values.length}`);
    }
    if (options.search) {
      values.push(`%${options.search.trim()}%`);
      const idx = values.length;
      conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx} OR phone ILIKE $${idx})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM auth.users ${whereClause}`,
      values
    );
    const total = countRes.rows[0]?.total ?? 0;

    values.push(limit, offset);
    const query = `
      SELECT * FROM auth.users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `;
    const res = await this.pool.query(query, values);
    return {
      users: res.rows.map(mapUserRow),
      total
    };
  }

  static async getUserStats(): Promise<{ totalCustomers: number; totalProviders: number; totalAdmins: number }> {
    const res = await this.pool.query(
      `SELECT role, COUNT(*)::int AS count
       FROM auth.users
       WHERE deleted_at IS NULL
       GROUP BY role`
    );
    let totalCustomers = 0, totalProviders = 0, totalAdmins = 0;
    for (const row of res.rows) {
      if (row.role === 'customer') totalCustomers = row.count;
      else if (row.role === 'provider') totalProviders = row.count;
      else if (row.role === 'admin') totalAdmins = row.count;
    }
    return { totalCustomers, totalProviders, totalAdmins };
  }

  static async findByIds(ids: string[]): Promise<UserEntity[]> {
    if (!ids || ids.length === 0) return [];
    const res = await this.pool.query(
      `SELECT * FROM auth.users WHERE (id::text = ANY($1) OR legacy_mongo_id = ANY($1)) AND deleted_at IS NULL`,
      [ids]
    );
    return res.rows.map(mapUserRow);
  }

  static async searchUsers(keyword: string): Promise<UserEntity[]> {
    if (!keyword || !keyword.trim()) return [];
    const term = `%${keyword.trim()}%`;
    const res = await this.pool.query(
      `SELECT * FROM auth.users
       WHERE deleted_at IS NULL
         AND (name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
       LIMIT 100`,
      [term]
    );
    return res.rows.map(mapUserRow);
  }
}
