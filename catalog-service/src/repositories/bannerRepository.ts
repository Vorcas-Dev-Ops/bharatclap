import { Pool } from 'pg';
import { getDb } from '../config/db';

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
  redirect_id?: string;
  button_text?: string;
  position: number;
  display_order: number;
  status: 'active' | 'inactive';
  role: string;
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

  return {
    id: idStr,
    _id: idStr,
    title: row.title,
    subtitle: undefined,
    image: img,
    image_url: img,
    link: lnk,
    redirect_url: lnk,
    position: pos,
    display_order: pos,
    status: row.status || 'active',
    role: 'user', // Default or extracted if supported
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
    activeOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<BannerEntity[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (options.activeOnly) {
      conditions.push(`status = 'active'`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    values.push(limit, offset);
    const limitClause = `LIMIT $${values.length - 1} OFFSET $${values.length}`;

    const res = await this.pool.query(
      `SELECT * FROM catalog.banners
       ${where}
       ORDER BY position ASC, created_at DESC
       ${limitClause}`,
      values
    );

    return res.rows.map(mapBannerRow).map(b => ({
      ...b,
      role: options.role === 'provider' ? 'provider' : 'user',
    }));
  }

  static async findAll(activeOnly: boolean = false): Promise<BannerEntity[]> {
    const where = activeOnly ? `WHERE status = 'active'` : '';
    const res = await this.pool.query(
      `SELECT * FROM catalog.banners ${where} ORDER BY position ASC, created_at DESC`
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
    redirect_id?: string;
    button_text?: string;
    position?: number;
    display_order?: number;
    displayOrder?: number;
    status?: string;
    role?: string;
  }): Promise<BannerEntity> {
    const img = data.image || data.image_url || null;
    const lnk = data.link || data.redirect_url || null;
    const pos = data.position ?? data.display_order ?? data.displayOrder ?? 0;

    const res = await this.pool.query(
      `INSERT INTO catalog.banners (title, image, link, position, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.title,
        img,
        lnk,
        pos,
        data.status || 'active',
      ]
    );
    const banner = mapBannerRow(res.rows[0]);
    if (data.role) banner.role = data.role;
    return banner;
  }

  static async update(id: string, updates: Record<string, any>): Promise<BannerEntity | null> {
    const fieldMap: Record<string, string> = {
      title: 'title',
      image: 'image',
      image_url: 'image',
      link: 'link',
      redirect_url: 'link',
      position: 'position',
      display_order: 'position',
      displayOrder: 'position',
      status: 'status',
    };

    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [id];

    for (const [key, val] of Object.entries(updates)) {
      const col = fieldMap[key];
      if (col !== undefined && val !== undefined) {
        values.push(val);
        setClauses.push(`${col} = $${values.length}`);
      }
    }

    const res = await this.pool.query(
      `UPDATE catalog.banners SET ${setClauses.join(', ')} WHERE id::text = $1 OR legacy_mongo_id = $1 RETURNING *`,
      values
    );
    return res.rows[0] ? mapBannerRow(res.rows[0]) : null;
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
