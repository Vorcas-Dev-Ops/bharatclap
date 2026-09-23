import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface OfferEntity {
  id: string;
  _id: string;
  title: string;
  description?: string;
  discount_value?: number;
  discountValue?: number;
  start_date?: Date;
  startDate?: Date;
  end_date?: Date;
  endDate?: Date;
  expiry_date?: Date;
  expiryDate?: Date;
  image?: string;
  status: 'active' | 'inactive';
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export const mapOfferRow = (row: any): OfferEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const discountVal = row.discount_value !== null && row.discount_value !== undefined ? parseFloat(row.discount_value) : undefined;
  const endDate = row.end_date ? new Date(row.end_date) : undefined;

  return {
    id: idStr,
    _id: idStr,
    title: row.title,
    description: row.description || undefined,
    discount_value: discountVal,
    discountValue: discountVal,
    start_date: row.start_date ? new Date(row.start_date) : undefined,
    startDate: row.start_date ? new Date(row.start_date) : undefined,
    end_date: endDate,
    endDate: endDate,
    expiry_date: endDate,
    expiryDate: endDate,
    image: row.image || undefined,
    status: row.status || 'active',
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
};

export class OfferRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findWithFilters(options: {
    activeOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<OfferEntity[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (options.activeOnly) {
      conditions.push(`status = 'active' AND (end_date IS NULL OR end_date >= NOW())`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    values.push(limit, offset);
    const limitClause = `LIMIT $${values.length - 1} OFFSET $${values.length}`;

    const res = await this.pool.query(
      `SELECT * FROM catalog.offers
       ${where}
       ORDER BY created_at DESC
       ${limitClause}`,
      values
    );
    return res.rows.map(mapOfferRow);
  }

  static async findAll(activeOnly: boolean = false): Promise<OfferEntity[]> {
    const where = activeOnly ? `WHERE status = 'active' AND (end_date IS NULL OR end_date >= NOW())` : '';
    const res = await this.pool.query(
      `SELECT * FROM catalog.offers ${where} ORDER BY created_at DESC`
    );
    return res.rows.map(mapOfferRow);
  }

  static async findById(id: string): Promise<OfferEntity | null> {
    if (!id) return null;
    const res = await this.pool.query(
      `SELECT * FROM catalog.offers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapOfferRow(res.rows[0]) : null;
  }

  static async create(data: {
    title: string;
    description?: string;
    discount_value?: number;
    discountValue?: number;
    start_date?: Date | string;
    startDate?: Date | string;
    end_date?: Date | string;
    endDate?: Date | string;
    expiry_date?: Date | string;
    expiryDate?: Date | string;
    image?: string;
    status?: string;
  }): Promise<OfferEntity> {
    const discount = data.discount_value !== undefined ? data.discount_value : data.discountValue;
    const startDate = data.start_date || data.startDate || null;
    const endDate = data.end_date || data.endDate || data.expiry_date || data.expiryDate || null;

    const res = await this.pool.query(
      `INSERT INTO catalog.offers (title, description, discount_value, start_date, end_date, image, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.title,
        data.description || null,
        discount || null,
        startDate,
        endDate,
        data.image || null,
        data.status || 'active',
      ]
    );
    return mapOfferRow(res.rows[0]);
  }

  static async update(id: string, updates: Record<string, any>): Promise<OfferEntity | null> {
    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      discount_value: 'discount_value',
      discountValue: 'discount_value',
      start_date: 'start_date',
      startDate: 'start_date',
      end_date: 'end_date',
      endDate: 'end_date',
      expiry_date: 'end_date',
      expiryDate: 'end_date',
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

    const res = await this.pool.query(
      `UPDATE catalog.offers SET ${setClauses.join(', ')} WHERE id::text = $1 OR legacy_mongo_id = $1 RETURNING *`,
      values
    );
    return res.rows[0] ? mapOfferRow(res.rows[0]) : null;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM catalog.offers WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
