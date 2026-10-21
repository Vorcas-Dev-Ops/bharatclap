import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface CategoryEntity {
  id: string;
  _id: string;
  name: string;
  category_name?: string;
  category_code?: string;
  code?: string;
  code_locked: boolean;
  codeLocked: boolean;
  slug: string;
  icon?: string;
  image?: string;
  description: string;
  requires_gender_selection: boolean;
  requiresGenderSelection: boolean;
  status: 'active' | 'inactive';
  isDeleted: boolean;
  legacy_mongo_id?: string | null;
  services_count?: number;
  subservices_count?: number;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export const mapCategoryRow = (row: any): CategoryEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const isDel = row.deleted_at !== null && row.deleted_at !== undefined;

  return {
    id: idStr,
    _id: idStr,
    name: row.name,
    category_name: row.name,
    category_code: row.category_code || undefined,
    code: row.category_code || undefined,
    code_locked: Boolean(row.code_locked),
    codeLocked: Boolean(row.code_locked),
    slug: row.slug || '',
    icon: row.icon || undefined,
    image: row.image || undefined,
    description: row.description || '',
    requires_gender_selection: Boolean(row.requires_gender_selection),
    requiresGenderSelection: Boolean(row.requires_gender_selection),
    status: row.status || 'active',
    isDeleted: isDel,
    legacy_mongo_id: row.legacy_mongo_id || null,
    services_count: row.services_count !== undefined ? Number(row.services_count) : 0,
    subservices_count: row.subservices_count !== undefined ? Number(row.subservices_count) : 0,
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
};

export class CategoryRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findAll(activeOnly: boolean = false): Promise<CategoryEntity[]> {
    const where = activeOnly ? `WHERE c.deleted_at IS NULL AND c.status = 'active'` : `WHERE c.deleted_at IS NULL`;
    const res = await this.pool.query(
      `SELECT c.*,
        COALESCE((
          SELECT COUNT(*)::int 
          FROM catalog.services s 
          WHERE s.category_id = c.id 
            AND s.deleted_at IS NULL
        ), 0) AS services_count,
        COALESCE((
          SELECT COUNT(*)::int 
          FROM catalog.subservices sub
          JOIN catalog.services s2 ON sub.service_id = s2.id
          WHERE s2.category_id = c.id 
            AND sub.deleted_at IS NULL
            AND s2.deleted_at IS NULL
        ), 0) AS subservices_count
      FROM catalog.categories c 
      ${where} 
      ORDER BY c.created_at DESC`
    );
    return res.rows.map(mapCategoryRow);
  }

  static async findById(id: string): Promise<CategoryEntity | null> {
    if (!id) return null;
    const res = await this.pool.query(
      `SELECT c.*,
        COALESCE((
          SELECT COUNT(*)::int 
          FROM catalog.services s 
          WHERE s.category_id = c.id 
            AND s.deleted_at IS NULL
        ), 0) AS services_count,
        COALESCE((
          SELECT COUNT(*)::int 
          FROM catalog.subservices sub
          JOIN catalog.services s2 ON sub.service_id = s2.id
          WHERE s2.category_id = c.id 
            AND sub.deleted_at IS NULL
            AND s2.deleted_at IS NULL
        ), 0) AS subservices_count
      FROM catalog.categories c 
      WHERE (c.id::text = $1 OR c.legacy_mongo_id = $1) AND c.deleted_at IS NULL 
      LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapCategoryRow(res.rows[0]) : null;
  }

  static async findByName(name: string): Promise<CategoryEntity | null> {
    if (!name) return null;
    const res = await this.pool.query(
      `SELECT * FROM catalog.categories WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
      [name.trim()]
    );
    return res.rows[0] ? mapCategoryRow(res.rows[0]) : null;
  }

  static async findByIds(ids: string[]): Promise<CategoryEntity[]> {
    if (!ids || ids.length === 0) return [];
    const res = await this.pool.query(
      `SELECT * FROM catalog.categories WHERE (id::text = ANY($1) OR legacy_mongo_id = ANY($1)) AND deleted_at IS NULL`,
      [ids]
    );
    return res.rows.map(mapCategoryRow);
  }

  static async create(data: {
    name: string;
    code?: string;
    slug?: string;
    icon?: string;
    image?: string;
    description: string;
    requiresGenderSelection?: boolean;
    status?: string;
  }): Promise<CategoryEntity> {
    const res = await this.pool.query(
      `INSERT INTO catalog.categories (
        name, category_code, slug, icon, image, description,
        requires_gender_selection, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.name,
        data.code || null,
        data.slug || null,
        data.icon || null,
        data.image || null,
        data.description,
        Boolean(data.requiresGenderSelection),
        data.status || 'active',
      ]
    );
    return mapCategoryRow(res.rows[0]);
  }

  static async update(id: string, updates: Partial<CategoryEntity>): Promise<CategoryEntity | null> {
    const fieldMap: Record<string, string> = {
      name: 'name',
      category_name: 'name',
      code: 'category_code',
      category_code: 'category_code',
      slug: 'slug',
      icon: 'icon',
      image: 'image',
      description: 'description',
      requiresGenderSelection: 'requires_gender_selection',
      requires_gender_selection: 'requires_gender_selection',
      codeLocked: 'code_locked',
      code_locked: 'code_locked',
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
      `UPDATE catalog.categories
       SET ${setClauses.join(', ')}
       WHERE (id::text = $1 OR legacy_mongo_id = $1) AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    return res.rows[0] ? mapCategoryRow(res.rows[0]) : null;
  }

  static async softDelete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE catalog.categories
       SET deleted_at = NOW(), status = 'inactive', updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1) AND deleted_at IS NULL`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
