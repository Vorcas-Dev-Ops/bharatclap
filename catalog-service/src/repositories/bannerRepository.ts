import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface BannerTemplateConfig {
  template: 'split' | 'full_background' | 'image_left' | 'centered_promo' | 'highlight_deal';
  badge_text?: string | null;
  badge_style?: 'pill' | 'rounded' | null;
  highlight_text?: string | null;
  bg_gradient?: string | null;
  bg_pattern?: string | null;
  bg_image?: string | null;
  overlay?: {
    type?: 'none' | 'dark' | 'light' | 'gradient';
    opacity?: number;
  } | null;
}

export interface BannerEntity {
  id: string;
  _id: string;
  title: string;
  subtitle?: string;
  image?: string;
  image_url?: string;
  link?: string;
  redirect_url?: string;
  redirect_type?: string;
  button_text?: string;
  background_color?: string;
  backgroundColor?: string;
  text_color?: string;
  textColor?: string;
  template_config: BannerTemplateConfig;
  templateConfig: BannerTemplateConfig;
  audience: 'user' | 'provider' | 'website' | 'both' | 'all';
  role: string;
  placement: string;
  position: number;
  display_order: number;
  status: 'active' | 'inactive';
  start_date?: Date | null;
  end_date?: Date | null;
  startDate?: string | null;
  endDate?: string | null;
  isDeleted: boolean;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export const mapBannerRow = (row: any): BannerEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const img = row.image || undefined;
  const lnk = row.link || undefined;
  const pos = Number(row.position) || 0;
  const isInactive = row.status === 'inactive';
  const audience = (row.audience || 'both') as 'user' | 'provider' | 'website' | 'both' | 'all';
  const bgColor = row.background_color || '#5E2FD9';
  const txtColor = row.text_color || '#FFFFFF';

  // ponytail: ensure backward compatibility: missing/invalid template_config defaults to split
  let tmplConfig: BannerTemplateConfig = { template: 'split' };
  if (row.template_config) {
    if (typeof row.template_config === 'object') {
      tmplConfig = { template: 'split', ...row.template_config };
    } else if (typeof row.template_config === 'string') {
      try {
        tmplConfig = { template: 'split', ...JSON.parse(row.template_config) };
      } catch (_) {}
    }
  }

  return {
    id: idStr,
    _id: idStr,
    title: row.title,
    subtitle: row.subtitle || undefined,
    image: img,
    image_url: img,
    link: lnk,
    redirect_url: lnk,
    redirect_type: row.redirect_type || 'url',
    button_text: row.button_text || undefined,
    background_color: bgColor,
    backgroundColor: bgColor,
    text_color: txtColor,
    textColor: txtColor,
    template_config: tmplConfig,
    templateConfig: tmplConfig,
    audience,
    role: audience,
    placement: row.placement || 'homepage_after_categories',
    position: pos,
    display_order: pos,
    status: row.status || 'active',
    start_date: row.start_date ? new Date(row.start_date) : null,
    end_date: row.end_date ? new Date(row.end_date) : null,
    startDate: row.start_date ? new Date(row.start_date).toISOString() : null,
    endDate: row.end_date ? new Date(row.end_date).toISOString() : null,
    isDeleted: isInactive,
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
};

export class BannerRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findWithFilters(options: {
    role?: string;
    audience?: string;
    placement?: string;
    status?: string;
    activeOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<BannerEntity[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    const aud = options.audience || options.role;
    if (aud && aud !== 'all') {
      if (aud === 'user') {
        conditions.push(`audience IN ('user', 'both', 'all')`);
      } else if (aud === 'provider') {
        conditions.push(`audience IN ('provider', 'both', 'all')`);
      } else if (aud === 'website') {
        conditions.push(`audience IN ('website', 'both', 'all')`);
      } else if (aud === 'both') {
        conditions.push(`audience IN ('both', 'all')`);
      } else {
        values.push(aud);
        conditions.push(`audience = $${values.length}`);
      }
    }

    if (options.placement && options.placement !== 'all') {
      values.push(options.placement);
      conditions.push(`placement = $${values.length}`);
    }

    if (options.activeOnly) {
      conditions.push(`status = 'active'`);
      conditions.push(`(start_date IS NULL OR start_date <= NOW())`);
      conditions.push(`(end_date IS NULL OR end_date >= NOW())`);
    } else if (options.status && options.status !== 'all') {
      values.push(options.status);
      conditions.push(`status = $${values.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = options.page || 1;
    const limit = options.limit || 100;
    const offset = (page - 1) * limit;

    values.push(limit, offset);
    const limitClause = `LIMIT $${values.length - 1} OFFSET $${values.length}`;

    const res = await this.pool.query(
      `SELECT * FROM catalog.banners
       ${where}
       ORDER BY placement ASC, position ASC, created_at DESC
       ${limitClause}`,
      values
    );

    return res.rows.map(mapBannerRow);
  }

  static async findAll(activeOnly: boolean = false, placement?: string, audience: string = 'user'): Promise<BannerEntity[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (activeOnly) {
      conditions.push(`status = 'active'`);
      if (audience === 'user') {
        conditions.push(`audience IN ('user', 'both', 'all')`);
      } else if (audience === 'provider') {
        conditions.push(`audience IN ('provider', 'both', 'all')`);
      } else if (audience === 'website') {
        conditions.push(`audience IN ('website', 'both', 'all')`);
      } else if (audience !== 'all') {
        values.push(audience);
        conditions.push(`audience = $${values.length}`);
      }
      conditions.push(`(start_date IS NULL OR start_date <= NOW())`);
      conditions.push(`(end_date IS NULL OR end_date >= NOW())`);
    }

    if (placement) {
      values.push(placement);
      conditions.push(`placement = $${values.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await this.pool.query(
      `SELECT * FROM catalog.banners ${where} ORDER BY position ASC, created_at DESC`,
      values
    );
    return res.rows.map(mapBannerRow);
  }

  static async findById(id: string): Promise<BannerEntity | null> {
    if (!id) return null;
    const res = await this.pool.query(
      `SELECT * FROM catalog.banners WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapBannerRow(res.rows[0]) : null;
  }

  static async create(data: {
    title: string;
    subtitle?: string;
    image?: string;
    image_url?: string;
    link?: string;
    redirect_url?: string;
    redirect_type?: string;
    button_text?: string;
    background_color?: string;
    backgroundColor?: string;
    text_color?: string;
    textColor?: string;
    template_config?: BannerTemplateConfig | any;
    templateConfig?: BannerTemplateConfig | any;
    audience?: string;
    role?: string;
    placement?: string;
    position?: number;
    display_order?: number;
    displayOrder?: number;
    status?: string;
    start_date?: string | Date | null;
    end_date?: string | Date | null;
  }): Promise<BannerEntity> {
    const img = data.image || data.image_url || null;
    const lnk = data.link || data.redirect_url || null;
    const pos = data.position ?? data.display_order ?? data.displayOrder ?? 0;
    const aud = data.audience || data.role || 'both';
    const place = data.placement || 'homepage_after_categories';
    const start = data.start_date ? new Date(data.start_date) : null;
    const end = data.end_date ? new Date(data.end_date) : null;
    const bgColor = data.background_color || data.backgroundColor || '#5E2FD9';
    const txtColor = data.text_color || data.textColor || '#FFFFFF';
    const tmpl = data.template_config || data.templateConfig || { template: 'split' };

    const res = await this.pool.query(
      `INSERT INTO catalog.banners (
        title, subtitle, image, link, button_text, audience, placement, redirect_type, position, status, start_date, end_date, background_color, text_color, template_config
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        data.title,
        data.subtitle || null,
        img,
        lnk,
        data.button_text || null,
        aud,
        place,
        data.redirect_type || 'url',
        pos,
        data.status || 'active',
        start,
        end,
        bgColor,
        txtColor,
        JSON.stringify(tmpl),
      ]
    );
    return mapBannerRow(res.rows[0]);
  }

  static async update(id: string, updates: Record<string, any>): Promise<BannerEntity | null> {
    const fieldMap: Record<string, string> = {
      title: 'title',
      subtitle: 'subtitle',
      image: 'image',
      image_url: 'image',
      link: 'link',
      redirect_url: 'link',
      redirect_type: 'redirect_type',
      button_text: 'button_text',
      background_color: 'background_color',
      backgroundColor: 'background_color',
      text_color: 'text_color',
      textColor: 'text_color',
      template_config: 'template_config',
      templateConfig: 'template_config',
      audience: 'audience',
      role: 'audience',
      placement: 'placement',
      position: 'position',
      display_order: 'position',
      displayOrder: 'position',
      status: 'status',
      start_date: 'start_date',
      startDate: 'start_date',
      end_date: 'end_date',
      endDate: 'end_date',
    };

    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [id];
    const assignedColumns = new Set<string>();

    for (const [key, val] of Object.entries(updates)) {
      const col = fieldMap[key];
      if (col !== undefined && val !== undefined && !assignedColumns.has(col)) {
        assignedColumns.add(col);
        let cleanVal = val;
        if ((col === 'start_date' || col === 'end_date') && val) {
          cleanVal = new Date(val);
        } else if ((col === 'start_date' || col === 'end_date') && !val) {
          cleanVal = null;
        } else if (col === 'template_config' && typeof val === 'object' && val !== null) {
          cleanVal = JSON.stringify(val);
        }
        values.push(cleanVal);
        setClauses.push(`${col} = $${values.length}`);
      }
    }

    const res = await this.pool.query(
      `UPDATE catalog.banners SET ${setClauses.join(', ')} WHERE id::text = $1 OR legacy_mongo_id = $1 RETURNING *`,
      values
    );
    return res.rows[0] ? mapBannerRow(res.rows[0]) : null;
  }

  static async reorder(items: { id: string; position: number }[]): Promise<boolean> {
    if (!items || items.length === 0) return true;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        await client.query(
          `UPDATE catalog.banners SET position = $1, updated_at = NOW() WHERE id::text = $2`,
          [item.position, String(item.id)]
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async softDelete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE catalog.banners SET status = 'inactive', updated_at = NOW() WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM catalog.banners WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
