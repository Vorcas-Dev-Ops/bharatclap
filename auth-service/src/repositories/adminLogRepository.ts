import { Pool } from 'pg';
import { getDb } from '../config/db';

export class AdminLogRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async createLog(data: {
    adminId?: string | null;
    adminName: string;
    action: string;
    targetId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO auth.admin_activity_logs (
        admin_id, admin_name, action, target_id, details, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.adminId || null,
        data.adminName,
        data.action,
        data.targetId || null,
        data.details ? JSON.stringify(data.details) : null,
        data.ipAddress || null,
        data.userAgent || null,
      ]
    );
  }

  static async listLogs(options: {
    adminId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (options.adminId) {
      values.push(options.adminId);
      conditions.push(`admin_id::text = $${values.length}`);
    }
    if (options.action) {
      values.push(options.action);
      conditions.push(`action = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const countRes = await this.pool.query(
      `SELECT COUNT(*) FROM auth.admin_activity_logs ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0].count, 10);

    values.push(limit, offset);
    const dataRes = await this.pool.query(
      `SELECT * FROM auth.admin_activity_logs ${whereClause} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return { logs: dataRes.rows, total };
  }
}
