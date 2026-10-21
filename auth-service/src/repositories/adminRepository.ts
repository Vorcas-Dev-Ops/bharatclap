import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface AdminEntity {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  password_hash: string;
  totp_secret?: string | null;
  two_factor_enabled?: boolean;
  two_factor_recovery?: string[];
  failed_otp_attempts?: number;
  otp_locked_until?: Date | null;
  last_login?: Date | null;
  admin_role: 'super_admin' | 'operations_admin' | 'support_admin' | 'finance_admin';
  status: 'active' | 'blocked';
  token_version: number;
  permissions?: string[];
  created_by?: string | null;
  created_at: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

const mapAdminRow = (row: any): AdminEntity => ({
  id: row.id,
  email: row.email,
  name: row.name,
  phone: row.phone,
  password_hash: row.password_hash,
  totp_secret: row.totp_secret,
  two_factor_enabled: Boolean(row.totp_secret),
  two_factor_recovery: row.two_factor_recovery || [],
  failed_otp_attempts: row.failed_otp_attempts || 0,
  otp_locked_until: row.otp_locked_until,
  last_login: row.last_login,
  admin_role: row.admin_role,
  status: row.status,
  token_version: row.token_version ?? 0,
  permissions: row.permissions || [],
  created_by: row.created_by,
  created_at: row.created_at,
  updated_at: row.updated_at,
  deleted_at: row.deleted_at,
});

export class AdminRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findById(id: string): Promise<AdminEntity | null> {
    try {
      const res = await this.pool.query(
        `SELECT a.id, a.email, a.name, a.phone, a.password_hash, a.totp_secret, a.admin_role,
                a.two_factor_recovery, a.failed_otp_attempts, a.otp_locked_until, a.last_login,
                a.status, a.token_version, a.created_by, a.created_at, a.updated_at, a.deleted_at,
                COALESCE(array_remove(array_agg(p.permission), NULL), '{}') as permissions
         FROM auth.admins a
         LEFT JOIN auth.admin_permissions p ON p.admin_id = a.id
         WHERE a.id = $1 AND a.deleted_at IS NULL
         GROUP BY a.id
         LIMIT 1`,
        [id]
      );
      return res.rows[0] ? mapAdminRow(res.rows[0]) : null;
    } catch (err: any) {
      if (err.code === '42P01') {
        return null;
      }
      throw err;
    }
  }

  static async findByEmail(email: string): Promise<AdminEntity | null> {
    try {
      const res = await this.pool.query(
        `SELECT a.id, a.email, a.name, a.phone, a.password_hash, a.totp_secret, a.admin_role,
                a.two_factor_recovery, a.failed_otp_attempts, a.otp_locked_until, a.last_login,
                a.status, a.token_version, a.created_by, a.created_at, a.updated_at, a.deleted_at,
                COALESCE(array_remove(array_agg(p.permission), NULL), '{}') as permissions
         FROM auth.admins a
         LEFT JOIN auth.admin_permissions p ON p.admin_id = a.id
         WHERE LOWER(a.email) = LOWER($1) AND a.deleted_at IS NULL
         GROUP BY a.id
         LIMIT 1`,
        [email]
      );
      return res.rows[0] ? mapAdminRow(res.rows[0]) : null;
    } catch (err: any) {
      if (err.code === '42P01') {
        return null;
      }
      throw err;
    }
  }

  static async create(data: {
    name: string;
    email: string;
    phone?: string | null;
    password_hash: string;
    admin_role?: string;
    permissions?: string[];
    status?: string;
    created_by?: string | null;
  }): Promise<AdminEntity> {
    const res = await this.pool.query(
      `INSERT INTO auth.admins (
        name, email, phone, password_hash, admin_role, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.name,
        data.email.toLowerCase(),
        data.phone || null,
        data.password_hash,
        data.admin_role || 'support_admin',
        data.status || 'active',
        data.created_by || null,
      ]
    );
    const newAdmin = res.rows[0];
    if (data.permissions && data.permissions.length > 0) {
      for (const perm of data.permissions) {
        await this.pool.query(
          `INSERT INTO auth.admin_permissions (admin_id, permission) VALUES ($1, $2)`,
          [newAdmin.id, perm]
        );
      }
    }
    return (await this.findById(newAdmin.id))!;
  }

  static async update(id: string, updates: Record<string, any>): Promise<AdminEntity | null> {
    const allowedCols = [
      'name', 'email', 'phone', 'password_hash', 'totp_secret',
      'two_factor_recovery', 'failed_otp_attempts', 'otp_locked_until',
      'last_login', 'admin_role', 'status', 'token_version', 'deleted_at'
    ];
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [id];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'permissions') continue;
      if (allowedCols.includes(key)) {
        values.push(value);
        setClauses.push(`${key} = $${values.length}`);
      }
    }

    if (setClauses.length > 1) {
      await this.pool.query(
        `UPDATE auth.admins SET ${setClauses.join(', ')} WHERE id = $1 AND deleted_at IS NULL`,
        values
      );
    }

    if (updates.permissions !== undefined && Array.isArray(updates.permissions)) {
      await this.pool.query(`DELETE FROM auth.admin_permissions WHERE admin_id = $1`, [id]);
      for (const perm of updates.permissions) {
        await this.pool.query(
          `INSERT INTO auth.admin_permissions (admin_id, permission) VALUES ($1, $2)`,
          [id, perm]
        );
      }
    }

    return this.findById(id);
  }

  static async listAdmins(): Promise<AdminEntity[]> {
    try {
      const res = await this.pool.query(
        `SELECT a.id, a.email, a.name, a.phone, a.password_hash, a.totp_secret, a.admin_role,
                a.two_factor_recovery, a.failed_otp_attempts, a.otp_locked_until, a.last_login,
                a.status, a.token_version, a.created_by, a.created_at, a.updated_at, a.deleted_at,
                COALESCE(array_remove(array_agg(p.permission), NULL), '{}') as permissions
         FROM auth.admins a
         LEFT JOIN auth.admin_permissions p ON p.admin_id = a.id
         WHERE a.deleted_at IS NULL
         GROUP BY a.id
         ORDER BY a.created_at DESC`
      );
      return res.rows.map(mapAdminRow);
    } catch (err: any) {
      if (err.code === '42P01') {
        return [];
      }
      throw err;
    }
  }

  static async incrementTokenVersion(id: string): Promise<number> {
    try {
      const res = await this.pool.query(
        `UPDATE auth.admins 
         SET token_version = token_version + 1, updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING token_version`,
        [id]
      );
      return res.rows[0]?.token_version ?? 0;
    } catch (err: any) {
      if (err.code === '42P01') {
        return 0;
      }
      throw err;
    }
  }
}
