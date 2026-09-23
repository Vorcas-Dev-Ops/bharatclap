import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface CommissionEntity {
  id: string;
  _id: string;
  category_id: string;
  categoryId: string;
  category_name?: string;
  categoryName?: string;
  percentage: number;
  rate: number;
  status: 'active' | 'inactive';
  isDeleted: boolean;
  category?: {
    id: string;
    _id: string;
    name: string;
    category_name: string;
  };
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export const mapCommissionRow = (row: any): CommissionEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const catIdStr = String(row.category_id);
  const pct = parseFloat(row.percentage || 0);
  const catName = row.category_name || '';

  return {
    id: idStr,
    _id: idStr,
    category_id: catIdStr,
    categoryId: catIdStr,
    category_name: catName,
    categoryName: catName,
    percentage: pct,
    rate: pct,
    status: 'active',
    isDeleted: false,
    category: {
      id: catIdStr,
      _id: catIdStr,
      name: catName,
      category_name: catName,
    },
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
};

export class CommissionRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findAll(): Promise<CommissionEntity[]> {
    const res = await this.pool.query(
      `SELECT cm.*, c.name AS category_name
       FROM catalog.commissions cm
       LEFT JOIN catalog.categories c ON c.id = cm.category_id
       ORDER BY cm.created_at DESC`
    );
    return res.rows.map(mapCommissionRow);
  }

  static async findById(id: string): Promise<CommissionEntity | null> {
    if (!id) return null;
    const res = await this.pool.query(
      `SELECT cm.*, c.name AS category_name
       FROM catalog.commissions cm
       LEFT JOIN catalog.categories c ON c.id = cm.category_id
       WHERE cm.id::text = $1 OR cm.legacy_mongo_id = $1
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapCommissionRow(res.rows[0]) : null;
  }

  static async findByCategoryId(categoryId: string): Promise<CommissionEntity | null> {
    const res = await this.pool.query(
      `SELECT cm.*, c.name AS category_name
       FROM catalog.commissions cm
       LEFT JOIN catalog.categories c ON c.id = cm.category_id
       WHERE cm.category_id::text = $1 OR c.legacy_mongo_id = $1
       LIMIT 1`,
      [categoryId]
    );
    return res.rows[0] ? mapCommissionRow(res.rows[0]) : null;
  }

  static async create(data: {
    category_name?: string;
    categoryId?: string;
    rate?: number;
    percentage?: number;
    status?: string;
  }): Promise<CommissionEntity> {
    const pct = data.rate !== undefined ? data.rate : (data.percentage || 0);

    const res = await this.pool.query(
      `INSERT INTO catalog.commissions (category_id, percentage)
       VALUES (
         COALESCE(
           (SELECT id FROM catalog.categories WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
           (SELECT id FROM catalog.categories WHERE LOWER(name) = LOWER($2) LIMIT 1)
         ),
         $3
       ) RETURNING *`,
      [
        data.categoryId || null,
        data.category_name || '',
        pct,
      ]
    );
    return this.findById(res.rows[0].id) as Promise<CommissionEntity>;
  }

  static async bulkUpdateAll(rate: number): Promise<number> {
    // Upsert commission for every active category
    const res = await this.pool.query(
      `INSERT INTO catalog.commissions (category_id, percentage)
       SELECT id, $1 FROM catalog.categories WHERE deleted_at IS NULL
       ON CONFLICT (id) DO UPDATE SET percentage = EXCLUDED.percentage, updated_at = NOW()`,
      [rate]
    );
    return res.rowCount || 0;
  }

  static async update(id: string, updates: {
    category_name?: string;
    categoryId?: string;
    rate?: number;
    percentage?: number;
    status?: string;
  }): Promise<CommissionEntity | null> {
    const pct = updates.rate !== undefined ? updates.rate : updates.percentage;

    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [id];

    if (pct !== undefined) {
      values.push(pct);
      setClauses.push(`percentage = $${values.length}`);
    }

    if (updates.categoryId || updates.category_name) {
      values.push(updates.categoryId || null, updates.category_name || null);
      setClauses.push(`category_id = COALESCE(
        (SELECT id FROM catalog.categories WHERE id::text = $${values.length - 1} OR legacy_mongo_id = $${values.length - 1} LIMIT 1),
        (SELECT id FROM catalog.categories WHERE LOWER(name) = LOWER($${values.length}) LIMIT 1),
        category_id
      )`);
    }

    const res = await this.pool.query(
      `UPDATE catalog.commissions SET ${setClauses.join(', ')} WHERE id::text = $1 OR legacy_mongo_id = $1 RETURNING *`,
      values
    );
    return res.rows[0] ? this.findById(res.rows[0].id) : null;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM catalog.commissions WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
