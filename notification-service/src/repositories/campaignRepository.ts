import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface CampaignEntity {
  id: string;
  _id: string;
  title: string;
  message: string;
  app: 'customer' | 'provider' | 'both';
  audience_type: 'all' | 'specific' | 'filter';
  audience_filter: any;
  type: string;
  action_type: string;
  action_value?: string;
  image_url?: string;
  sound_enabled?: boolean;
  sound?: 'default' | 'job_alert' | 'booking' | 'silent' | string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed';
  scheduled_at?: Date | null;
  sent_at?: Date | null;
  recipients_count: number;
  delivered_count: number;
  opened_count: number;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TemplateEntity {
  id: string;
  _id: string;
  name: string;
  app: 'customer' | 'provider' | 'both';
  type: string;
  title: string;
  message: string;
  image_url?: string;
  action_type: string;
  action_value?: string;
  created_at: Date;
  updated_at: Date;
}

const mapCampaignRow = (r: any): CampaignEntity => ({
  id: String(r.id),
  _id: String(r.id),
  title: r.title,
  message: r.message,
  app: r.app,
  audience_type: r.audience_type,
  audience_filter: r.audience_filter || {},
  type: r.type,
  action_type: r.action_type || 'open_home',
  action_value: r.action_value || '',
  image_url: r.image_url || undefined,
  sound_enabled: r.sound_enabled !== false,
  sound: r.sound || 'default',
  status: r.status,
  scheduled_at: r.scheduled_at ? new Date(r.scheduled_at) : null,
  sent_at: r.sent_at ? new Date(r.sent_at) : null,
  recipients_count: Number(r.recipients_count) || 0,
  delivered_count: Number(r.delivered_count) || 0,
  opened_count: Number(r.opened_count) || 0,
  created_by: r.created_by || 'Admin',
  created_at: new Date(r.created_at),
  updated_at: new Date(r.updated_at),
});

const mapTemplateRow = (r: any): TemplateEntity => ({
  id: String(r.id),
  _id: String(r.id),
  name: r.name,
  app: r.app,
  type: r.type,
  title: r.title,
  message: r.message,
  image_url: r.image_url || undefined,
  action_type: r.action_type || 'open_home',
  action_value: r.action_value || '',
  created_at: new Date(r.created_at),
  updated_at: new Date(r.updated_at),
});

export class CampaignRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async createCampaign(data: {
    title: string;
    message: string;
    app?: string;
    audience_type?: string;
    audience_filter?: any;
    type?: string;
    action_type?: string;
    action_value?: string;
    image_url?: string;
    sound_enabled?: boolean;
    sound?: string;
    status?: string;
    scheduled_at?: string | Date | null;
    recipients_count?: number;
    created_by?: string;
  }): Promise<CampaignEntity> {
    const scheduled = data.scheduled_at ? new Date(data.scheduled_at) : null;
    const res = await this.pool.query(
      `INSERT INTO notification.campaigns (
        title, message, app, audience_type, audience_filter,
        type, action_type, action_value, image_url, sound_enabled, sound, status,
        scheduled_at, recipients_count, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        data.title,
        data.message,
        data.app || 'customer',
        data.audience_type || 'all',
        JSON.stringify(data.audience_filter || {}),
        data.type || 'PROMOTIONAL',
        data.action_type || 'open_home',
        data.action_value || null,
        data.image_url || null,
        data.sound_enabled !== false,
        data.sound || 'default',
        data.status || 'draft',
        scheduled,
        data.recipients_count || 0,
        data.created_by || 'Admin',
      ]
    );
    return mapCampaignRow(res.rows[0]);
  }

  static async getCampaigns(params: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: CampaignEntity[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];

    if (params.status && params.status !== 'all') {
      values.push(params.status);
      conditions.push(`status = $${values.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM notification.campaigns ${where}`,
      values
    );
    const total = countRes.rows[0]?.count || 0;

    values.push(limit, offset);
    const res = await this.pool.query(
      `SELECT * FROM notification.campaigns
       ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return {
      data: res.rows.map(mapCampaignRow),
      total,
    };
  }

  static async getCampaignById(id: string): Promise<CampaignEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM notification.campaigns WHERE id::text = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapCampaignRow(res.rows[0]) : null;
  }

  static async updateCampaign(id: string, updates: Partial<CampaignEntity>): Promise<CampaignEntity | null> {
    const fields: string[] = ['updated_at = NOW()'];
    const values: any[] = [id];

    const allowed = [
      'title', 'message', 'app', 'audience_type', 'audience_filter',
      'type', 'action_type', 'action_value', 'image_url', 'sound_enabled', 'sound', 'status',
      'scheduled_at', 'sent_at', 'recipients_count', 'delivered_count', 'opened_count'
    ];

    for (const [k, v] of Object.entries(updates)) {
      if (allowed.includes(k) && v !== undefined) {
        values.push(k.includes('filter') ? JSON.stringify(v) : v);
        fields.push(`${k} = $${values.length}`);
      }
    }

    const res = await this.pool.query(
      `UPDATE notification.campaigns SET ${fields.join(', ')} WHERE id::text = $1 RETURNING *`,
      values
    );
    return res.rows[0] ? mapCampaignRow(res.rows[0]) : null;
  }

  static async deleteCampaign(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM notification.campaigns WHERE id::text = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async estimateAudience(app: string, audience_type: string, filter?: any): Promise<number> {
    if (audience_type === 'specific') {
      const ids = filter?.specific_ids || filter?.target_ids || [];
      return Array.isArray(ids) ? ids.length : 1;
    }

    let customerCount = 0;
    let providerCount = 0;

    if (app === 'customer' || app === 'both') {
      const conditions: string[] = ["u.role = 'customer'"];
      const values: any[] = [];
      if (filter?.city) {
        values.push(`%${filter.city}%`);
        conditions.push(`EXISTS (SELECT 1 FROM auth.addresses a WHERE a.user_id = u.id AND a.city ILIKE $${values.length})`);
      }
      if (filter?.status === 'inactive') {
        conditions.push(`u.created_at < NOW() - INTERVAL '30 days'`);
      } else if (filter?.status === 'new') {
        conditions.push(`u.created_at >= NOW() - INTERVAL '7 days'`);
      }
      const cRes = await this.pool.query(
        `SELECT COUNT(*)::int AS count FROM auth.users u WHERE ${conditions.join(' AND ')}`,
        values
      );
      customerCount = cRes.rows[0]?.count || 0;
    }

    if (app === 'provider' || app === 'both') {
      const conditions: string[] = ["1 = 1"];
      const values: any[] = [];
      if (filter?.city) {
        values.push(`%${filter.city}%`);
        conditions.push(`EXISTS (SELECT 1 FROM auth.addresses a WHERE a.user_id = p.user_id AND a.city ILIKE $${values.length})`);
      }
      if (filter?.status === 'active') {
        conditions.push(`p.status = 'approved'`);
      } else if (filter?.status === 'online') {
        conditions.push(`p.is_online = true`);
      } else if (filter?.status === 'offline') {
        conditions.push(`p.is_online = false`);
      }
      const pRes = await this.pool.query(
        `SELECT COUNT(*)::int AS count FROM provider.providers p WHERE ${conditions.join(' AND ')}`,
        values
      );
      providerCount = pRes.rows[0]?.count || 0;
    }

    return customerCount + providerCount;
  }

  static async getAudienceRecipients(
    app: string,
    audience_type: string,
    filter?: any
  ): Promise<Array<{ id: string; role: 'customer' | 'provider'; token?: string }>> {
    const recipients: Array<{ id: string; role: 'customer' | 'provider'; token?: string }> = [];

    if (app === 'customer' || app === 'both') {
      const conditions: string[] = ["u.role = 'customer'"];
      const values: any[] = [];
      if (filter?.city) {
        values.push(`%${filter.city}%`);
        conditions.push(`EXISTS (SELECT 1 FROM auth.addresses a WHERE a.user_id = u.id AND a.city ILIKE $${values.length})`);
      }
      if (filter?.status === 'inactive') {
        conditions.push(`u.created_at < NOW() - INTERVAL '30 days'`);
      } else if (filter?.status === 'new') {
        conditions.push(`u.created_at >= NOW() - INTERVAL '7 days'`);
      }
      const cRes = await this.pool.query(
        `SELECT u.id, dt.token 
         FROM auth.users u
         LEFT JOIN notification.device_tokens dt ON u.id = dt.user_id AND dt.is_active = true
         WHERE ${conditions.join(' AND ')}`,
        values
      );
      cRes.rows.forEach(r => {
        recipients.push({ id: String(r.id), role: 'customer', token: r.token });
      });
    }

    if (app === 'provider' || app === 'both') {
      const conditions: string[] = ["1 = 1"];
      const values: any[] = [];
      if (filter?.city) {
        values.push(`%${filter.city}%`);
        conditions.push(`EXISTS (SELECT 1 FROM auth.addresses a WHERE a.user_id = p.user_id AND a.city ILIKE $${values.length})`);
      }
      if (filter?.status === 'active') {
        conditions.push(`p.status = 'approved'`);
      } else if (filter?.status === 'online') {
        conditions.push(`p.is_online = true`);
      } else if (filter?.status === 'offline') {
        conditions.push(`p.is_online = false`);
      }
      const pRes = await this.pool.query(
        `SELECT p.id, dt.token 
         FROM provider.providers p
         JOIN auth.users u ON p.user_id = u.id
         LEFT JOIN notification.device_tokens dt ON u.id = dt.user_id AND dt.is_active = true
         WHERE ${conditions.join(' AND ')}`,
        values
      );
      pRes.rows.forEach(r => {
        recipients.push({ id: String(r.id), role: 'provider', token: r.token });
      });
    }

    return recipients;
  }

  static async recordDeliveries(
    campaignId: string,
    recipients: Array<{ id: string; role: string; token?: string }>,
    initialStatus: string = 'sent'
  ): Promise<number> {
    if (!recipients || recipients.length === 0) return 0;

    let insertedCount = 0;
    const chunkSize = 500;
    for (let i = 0; i < recipients.length; i += chunkSize) {
      const chunk = recipients.slice(i, i + chunkSize);
      const values: any[] = [];
      const valuePlaceholders: string[] = [];

      chunk.forEach((rec, idx) => {
        const offset = idx * 4;
        valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        values.push(campaignId, rec.id, rec.role, initialStatus);
      });

      const query = `
        INSERT INTO notification.notification_deliveries (campaign_id, recipient_id, recipient_role, status)
        VALUES ${valuePlaceholders.join(', ')}
        ON CONFLICT (campaign_id, recipient_id) DO NOTHING
      `;
      const res = await this.pool.query(query, values);
      insertedCount += res.rowCount ?? 0;
    }
    return insertedCount;
  }

  static async markDeliveryStatus(
    campaignId: string,
    recipientId: string,
    status: 'delivered' | 'opened' | 'failed',
    failureReason?: string
  ): Promise<void> {
    const timestampCol = status === 'delivered' ? 'delivered_at = NOW(),' : status === 'opened' ? 'opened_at = NOW(),' : '';
    await this.pool.query(
      `UPDATE notification.notification_deliveries 
       SET status = $1, ${timestampCol} failure_reason = $2 
       WHERE campaign_id::text = $3 AND recipient_id::text = $4`,
      [status, failureReason || null, campaignId, recipientId]
    );
  }

  static async syncCampaignCounters(campaignId: string): Promise<void> {
    await this.pool.query(
      `UPDATE notification.campaigns
       SET 
         recipients_count = (SELECT COUNT(*)::int FROM notification.notification_deliveries WHERE campaign_id::text = $1),
         delivered_count = (SELECT COUNT(*)::int FROM notification.notification_deliveries WHERE campaign_id::text = $1 AND status IN ('delivered', 'sent', 'opened')),
         opened_count = (SELECT COUNT(*)::int FROM notification.notification_deliveries WHERE campaign_id::text = $1 AND status = 'opened'),
         updated_at = NOW()
       WHERE id::text = $1`,
      [campaignId]
    );
  }

  static async claimDueScheduledCampaigns(): Promise<CampaignEntity[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `SELECT * FROM notification.campaigns
         WHERE status = 'scheduled' AND scheduled_at <= NOW()
         ORDER BY scheduled_at ASC
         LIMIT 5
         FOR UPDATE SKIP LOCKED`
      );

      if (res.rows.length === 0) {
        await client.query('COMMIT');
        return [];
      }

      const campaignIds = res.rows.map(r => r.id);
      await client.query(
        `UPDATE notification.campaigns SET status = 'sending', updated_at = NOW() WHERE id = ANY($1::uuid[])`,
        [campaignIds]
      );
      await client.query('COMMIT');

      return res.rows.map(mapCampaignRow);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async cancelScheduledCampaign(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE notification.campaigns 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE id::text = $1 AND status = 'scheduled'`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async registerDeviceToken(userId: string, role: string, token: string, deviceType: string = 'android'): Promise<void> {
    await this.pool.query(
      `INSERT INTO notification.device_tokens (user_id, role, token, device_type, is_active, last_active_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       ON CONFLICT (token) DO UPDATE 
       SET user_id = EXCLUDED.user_id, role = EXCLUDED.role, is_active = true, last_active_at = NOW()`,
      [userId, role, token, deviceType]
    );
  }

  static async deactivateDeviceToken(token: string): Promise<void> {
    await this.pool.query(
      `UPDATE notification.device_tokens SET is_active = false WHERE token = $1`,
      [token]
    );
  }

  static async getTestTargets(role?: string): Promise<Array<{ id: string; name: string; email: string; phone: string; type: string }>> {
    const targets: Array<{ id: string; name: string; email: string; phone: string; type: string }> = [];

    if (!role || role === 'customer' || role === 'both') {
      const res = await this.pool.query(
        `SELECT id, name, email, phone FROM auth.users WHERE role = 'customer' AND (phone IS NOT NULL OR email IS NOT NULL) ORDER BY created_at DESC LIMIT 5`
      );
      res.rows.forEach(r => targets.push({
        id: String(r.id),
        name: r.name || 'Customer User',
        email: r.email || '',
        phone: r.phone || '',
        type: 'Customer'
      }));
    }

    if (!role || role === 'provider' || role === 'both') {
      const res = await this.pool.query(
        `SELECT p.id, u.name, u.email, u.phone FROM provider.providers p JOIN auth.users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 5`
      );
      res.rows.forEach(r => targets.push({
        id: String(r.id),
        name: r.name || 'Partner Provider',
        email: r.email || '',
        phone: r.phone || '',
        type: 'Partner'
      }));
    }

    return targets;
  }

  // ── Templates ───────────────────────────────────────────────────────
  static async getTemplates(app?: string): Promise<TemplateEntity[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    if (app && app !== 'all') {
      values.push(app);
      conditions.push(`(app = $1 OR app = 'both')`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await this.pool.query(
      `SELECT * FROM notification.templates ${where} ORDER BY created_at ASC`,
      values
    );
    return res.rows.map(mapTemplateRow);
  }

  static async createTemplate(data: {
    name: string;
    app: string;
    type?: string;
    title: string;
    message: string;
    image_url?: string;
    action_type?: string;
    action_value?: string;
  }): Promise<TemplateEntity> {
    const res = await this.pool.query(
      `INSERT INTO notification.templates (
        name, app, type, title, message, image_url, action_type, action_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.name,
        data.app || 'customer',
        data.type || 'PROMOTIONAL',
        data.title,
        data.message,
        data.image_url || null,
        data.action_type || 'open_home',
        data.action_value || null,
      ]
    );
    return mapTemplateRow(res.rows[0]);
  }

  static async updateTemplate(id: string, data: Partial<TemplateEntity>): Promise<TemplateEntity | null> {
    const fields: string[] = ['updated_at = NOW()'];
    const values: any[] = [id];
    const allowed = ['name', 'app', 'type', 'title', 'message', 'image_url', 'action_type', 'action_value'];

    for (const [k, v] of Object.entries(data)) {
      if (allowed.includes(k) && v !== undefined) {
        values.push(v);
        fields.push(`${k} = $${values.length}`);
      }
    }

    const res = await this.pool.query(
      `UPDATE notification.templates SET ${fields.join(', ')} WHERE id::text = $1 RETURNING *`,
      values
    );
    return res.rows[0] ? mapTemplateRow(res.rows[0]) : null;
  }

  static async deleteTemplate(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM notification.templates WHERE id::text = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
