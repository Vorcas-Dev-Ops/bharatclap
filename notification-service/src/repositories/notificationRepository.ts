import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface NotificationEntity {
  id: string;
  _id: string;
  recipient_id: string;
  recipientId: string;
  recipient_type: string;
  recipientType: string;
  title: string;
  message: string;
  type?: string;
  is_read: boolean;
  isRead: boolean;
  metadata?: any;
  created_at: Date;
  createdAt: Date;
}

export function normalizeRecipientType(t: string | undefined): 'customer' | 'provider' | 'admin' {
  const lower = (t || '').toLowerCase();
  if (lower === 'provider') return 'provider';
  if (lower === 'admin') return 'admin';
  return 'customer';
}

const mapNotificationRow = (r: any): NotificationEntity => ({
  id: String(r.id),
  _id: String(r.id),
  recipient_id: String(r.recipient_id),
  recipientId: String(r.recipient_id),
  recipient_type: r.recipient_type === 'customer' ? 'User' : r.recipient_type === 'provider' ? 'Provider' : 'Admin',
  recipientType: r.recipient_type,
  title: r.title,
  message: r.message,
  type: r.type,
  is_read: Boolean(r.is_read),
  isRead: Boolean(r.is_read),
  metadata: r.metadata || {},
  created_at: new Date(r.created_at),
  createdAt: new Date(r.created_at),
});

export class NotificationRepository {
  private static get pool(): Pool {
    return getDb();
  }

  // ── Notifications ──────────────────────────────────────────────────
  static async findUserNotifications(params: {
    userId: string;
    role: string;
    since?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ notifications: NotificationEntity[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const role = normalizeRecipientType(params.role);
    const conditions: string[] = [];
    const values: any[] = [params.userId, role];
    let idx = 3;

    conditions.push(`(
      (recipient_id::text = $1 OR recipient_id IN (SELECT id FROM auth.users WHERE legacy_mongo_id = $1)
       OR recipient_id IN (SELECT id FROM provider.providers WHERE legacy_mongo_id = $1))
      OR (recipient_id = '00000000-0000-0000-0000-000000000000'::uuid AND recipient_type = $2)
    )`);

    if (params.since) {
      conditions.push(`created_at >= $${idx}`);
      values.push(params.since);
      idx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int as count FROM notification.notifications ${whereClause}`,
      values
    );
    const total = countRes.rows[0]?.count || 0;

    const query = `
      SELECT * FROM notification.notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const res = await this.pool.query(query, values);
    return {
      notifications: res.rows.map(mapNotificationRow),
      total,
    };
  }

  static async findAdminNotifications(params: {
    page?: number;
    limit?: number;
  }): Promise<{ notifications: NotificationEntity[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int as count FROM notification.notifications WHERE recipient_type = 'admin'`
    );
    const total = countRes.rows[0]?.count || 0;

    const res = await this.pool.query(
      `SELECT * FROM notification.notifications
       WHERE recipient_type = 'admin'
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      notifications: res.rows.map(mapNotificationRow),
      total,
    };
  }

  static async createNotification(data: {
    recipient_id?: string;
    recipient_type?: string;
    title: string;
    message: string;
    type?: string;
    metadata?: any;
  }): Promise<NotificationEntity> {
    const recType = normalizeRecipientType(data.recipient_type);
    const recId = data.recipient_id || '00000000-0000-0000-0000-000000000000';

    const res = await this.pool.query(
      `INSERT INTO notification.notifications (
         recipient_id,
         recipient_type,
         title,
         message,
         type,
         metadata
       ) VALUES (
         COALESCE(
           (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
           (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
           CASE WHEN $1 ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN $1::uuid ELSE '00000000-0000-0000-0000-000000000000'::uuid END
         ),
         $2,
         $3,
         $4,
         $5,
         $6::jsonb
       ) RETURNING *`,
      [recId, recType, data.title, data.message, data.type || 'system_alert', JSON.stringify(data.metadata || {})]
    );

    return mapNotificationRow(res.rows[0]);
  }

  static async markAsRead(id: string, recipientId?: string, isAdmin?: boolean): Promise<NotificationEntity | null> {
    let res;
    if (isAdmin) {
      res = await this.pool.query(
        `UPDATE notification.notifications
         SET is_read = TRUE
         WHERE (id::text = $1 OR legacy_mongo_id = $1) AND recipient_type = 'admin'
         RETURNING *`,
        [id]
      );
    } else if (recipientId) {
      res = await this.pool.query(
        `UPDATE notification.notifications
         SET is_read = TRUE
         WHERE (id::text = $1 OR legacy_mongo_id = $1)
           AND (recipient_id::text = $2 OR recipient_id IN (SELECT id FROM auth.users WHERE legacy_mongo_id = $2)
                OR recipient_id IN (SELECT id FROM provider.providers WHERE legacy_mongo_id = $2))
         RETURNING *`,
        [id, recipientId]
      );
    } else {
      res = await this.pool.query(
        `UPDATE notification.notifications
         SET is_read = TRUE
         WHERE id::text = $1 OR legacy_mongo_id = $1
         RETURNING *`,
        [id]
      );
    }

    return res.rows[0] ? mapNotificationRow(res.rows[0]) : null;
  }

  static async deleteNotification(id: string, recipientId?: string, isAdmin?: boolean): Promise<boolean> {
    let res;
    if (isAdmin) {
      res = await this.pool.query(
        `DELETE FROM notification.notifications
         WHERE (id::text = $1 OR legacy_mongo_id = $1) AND recipient_type = 'admin'`,
        [id]
      );
    } else if (recipientId) {
      res = await this.pool.query(
        `DELETE FROM notification.notifications
         WHERE (id::text = $1 OR legacy_mongo_id = $1)
           AND (recipient_id::text = $2 OR recipient_id IN (SELECT id FROM auth.users WHERE legacy_mongo_id = $2)
                OR recipient_id IN (SELECT id FROM provider.providers WHERE legacy_mongo_id = $2))`,
        [id, recipientId]
      );
    } else {
      res = await this.pool.query(
        `DELETE FROM notification.notifications
         WHERE id::text = $1 OR legacy_mongo_id = $1`,
        [id]
      );
    }

    return (res.rowCount || 0) > 0;
  }

  static async markAllAsSeen(recipientId: string): Promise<number> {
    const res = await this.pool.query(
      `UPDATE notification.notifications
       SET is_read = TRUE
       WHERE (recipient_id::text = $1 OR recipient_id IN (SELECT id FROM auth.users WHERE legacy_mongo_id = $1)
              OR recipient_id IN (SELECT id FROM provider.providers WHERE legacy_mongo_id = $1))
         AND is_read = FALSE`,
      [recipientId]
    );
    return res.rowCount || 0;
  }

  // ── Processed Events (Idempotency) ─────────────────────────────────
  static async recordEventProcessed(eventId: string): Promise<boolean> {
    if (!eventId) return true;
    try {
      const res = await this.pool.query(
        `INSERT INTO notification.processed_events (event_id)
         VALUES ($1)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING id`,
        [eventId]
      );
      return (res.rowCount || 0) > 0;
    } catch {
      return false;
    }
  }

  // ── Admin Reports ──────────────────────────────────────────────────
  static async findReports(page = 1, limit = 20): Promise<any[]> {
    const offset = (page - 1) * limit;
    const res = await this.pool.query(
      `SELECT * FROM notification.admin_reports
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.rows.map(r => ({
      _id: String(r.id),
      id: String(r.id),
      type: r.report_type,
      data_json: r.data,
      created_at: r.created_at,
      createdAt: r.created_at,
    }));
  }

  static async createReport(type: string, dataJson: any): Promise<any> {
    const res = await this.pool.query(
      `INSERT INTO notification.admin_reports (report_type, data)
       VALUES ($1, $2::jsonb)
       RETURNING *`,
      [type, JSON.stringify(dataJson || {})]
    );
    const r = res.rows[0];
    return {
      _id: String(r.id),
      id: String(r.id),
      type: r.report_type,
      data_json: r.data,
      created_at: r.created_at,
      createdAt: r.created_at,
    };
  }

  static async deleteReport(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM notification.admin_reports WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [id]
    );
    return (res.rowCount || 0) > 0;
  }

  // ── System Settings ────────────────────────────────────────────────
  static async getSetting(key: string): Promise<any | null> {
    const res = await this.pool.query(
      `SELECT value FROM notification.system_settings WHERE key = $1 LIMIT 1`,
      [key]
    );
    return res.rows[0]?.value ?? null;
  }

  static async setSetting(key: string, value: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO notification.system_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  }
}
