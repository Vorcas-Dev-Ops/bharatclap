import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface AccessoryEntity {
  id: string;
  _id: string;
  name: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  category_id?: string;
  categoryId?: string;
  category?: {
    id: string;
    _id: string;
    category_name: string;
  };
  image?: string;
  status: 'active' | 'inactive';
  isDeleted: boolean;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export const mapAccessoryRow = (row: any): AccessoryEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const catIdStr = row.category_id ? String(row.category_id) : undefined;
  const isInactive = row.status === 'inactive';

  return {
    id: idStr,
    _id: idStr,
    name: row.name,
    title: row.name,
    description: row.description || undefined,
    price: parseFloat(row.price || 0),
    currency: row.currency || 'INR',
    category_id: catIdStr,
    categoryId: catIdStr,
    category: row.category_name ? {
      id: catIdStr!,
      _id: catIdStr!,
      category_name: row.category_name,
    } : undefined,
    image: row.image || undefined,
    status: row.status || 'active',
    isDeleted: isInactive,
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
};

export class AccessoryRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findWithFilters(options: {
    category?: string;
    status?: string;
    includeAll?: boolean;
    page?: number;
    limit?: number;
  }): Promise<AccessoryEntity[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (options.category) {
      values.push(options.category);
      conditions.push(`(a.category_id::text = $${values.length} OR c.legacy_mongo_id = $${values.length})`);
    }

    if (options.status) {
      values.push(options.status);
      conditions.push(`a.status = $${values.length}`);
    } else if (!options.includeAll) {
      conditions.push(`a.status = 'active'`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = options.page || 1;
    const limit = options.limit || 100;
    const offset = (page - 1) * limit;

    values.push(limit, offset);
    const limitClause = `LIMIT $${values.length - 1} OFFSET $${values.length}`;

    const res = await this.pool.query(
      `SELECT a.*, c.name AS category_name
       FROM catalog.accessories a
       LEFT JOIN catalog.categories c ON c.id = a.category_id
       ${where}
       ORDER BY a.created_at DESC
       ${limitClause}`,
      values
    );
    return res.rows.map(mapAccessoryRow);
  }

  static async findAll(activeOnly: boolean = false): Promise<AccessoryEntity[]> {
    const where = activeOnly ? `WHERE a.status = 'active'` : '';
    const res = await this.pool.query(
      `SELECT a.*, c.name AS category_name
       FROM catalog.accessories a
       LEFT JOIN catalog.categories c ON c.id = a.category_id
       ${where}
       ORDER BY a.created_at DESC`
    );
    return res.rows.map(mapAccessoryRow);
  }

  static async findById(id: string): Promise<AccessoryEntity | null> {
    if (!id) return null;
    const res = await this.pool.query(
      `SELECT a.*, c.name AS category_name
       FROM catalog.accessories a
       LEFT JOIN catalog.categories c ON c.id = a.category_id
       WHERE a.id::text = $1 OR a.legacy_mongo_id = $1
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapAccessoryRow(res.rows[0]) : null;
  }

  static async findByCategoryId(categoryId: string): Promise<AccessoryEntity[]> {
    const res = await this.pool.query(
      `SELECT a.*, c.name AS category_name
       FROM catalog.accessories a
       LEFT JOIN catalog.categories c ON c.id = a.category_id
       WHERE a.category_id::text = $1 OR c.legacy_mongo_id = $1
       ORDER BY a.created_at DESC`,
      [categoryId]
    );
    return res.rows.map(mapAccessoryRow);
  }

  static async create(data: {
    title?: string;
    name?: string;
    description?: string;
    price: number;
    category?: string;
    categoryId?: string;
    image?: string;
    status?: string;
  }): Promise<AccessoryEntity> {
    const catId = data.category || data.categoryId || null;
    const res = await this.pool.query(
      `INSERT INTO catalog.accessories (name, description, price, category_id, image, status)
       VALUES (
         $1, $2, $3,
         (SELECT id FROM catalog.categories WHERE id::text = $4 OR legacy_mongo_id = $4 LIMIT 1),
         $5, $6
       ) RETURNING *`,
      [
        data.title || data.name || '',
        data.description || null,
        data.price,
        catId,
        data.image || null,
        data.status || 'active',
      ]
    );
    return this.findById(res.rows[0].id) as Promise<AccessoryEntity>;
  }

  static async update(id: string, updates: Record<string, any>): Promise<AccessoryEntity | null> {
    const fieldMap: Record<string, string> = {
      title: 'name',
      name: 'name',
      description: 'description',
      price: 'price',
      image: 'image',
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

    if (updates.category !== undefined || updates.categoryId !== undefined) {
      const catVal = updates.category ?? updates.categoryId;
      values.push(catVal);
      setClauses.push(`category_id = (SELECT id FROM catalog.categories WHERE id::text = $${values.length} OR legacy_mongo_id = $${values.length} LIMIT 1)`);
    }

    const res = await this.pool.query(
      `UPDATE catalog.accessories SET ${setClauses.join(', ')} WHERE id::text = $1 OR legacy_mongo_id = $1 RETURNING *`,
      values
    );
    return res.rows[0] ? this.findById(res.rows[0].id) : null;
  }

  static async softDelete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE catalog.accessories SET status = 'inactive', updated_at = NOW() WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM catalog.accessories WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
