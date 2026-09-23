import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface MembershipEntity {
  id: string;
  _id: string;
  name: string;
  price: number;
  currency: string;
  duration_days: number;
  durationDays: number;
  benefits: any;
  status: 'active' | 'inactive';
  role: string;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export const mapMembershipRow = (row: any): MembershipEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  return {
    id: idStr,
    _id: idStr,
    name: row.name,
    price: parseFloat(row.price || 0),
    currency: row.currency || 'INR',
    duration_days: Number(row.duration_days) || 30,
    durationDays: Number(row.duration_days) || 30,
    benefits: typeof row.benefits === 'string' ? JSON.parse(row.benefits) : (row.benefits || []),
    status: row.status || 'active',
    role: 'user',
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
};

export class MembershipRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findAll(role?: string): Promise<MembershipEntity[]> {
    const res = await this.pool.query(
      `SELECT * FROM catalog.memberships ORDER BY price ASC, created_at DESC`
    );
    const rows = res.rows.map(mapMembershipRow);
    if (role && role !== 'all') {
      return rows.filter(r => r.role === role);
    }
    return rows;
  }

  static async findById(id: string): Promise<MembershipEntity | null> {
    if (!id) return null;
    const res = await this.pool.query(
      `SELECT * FROM catalog.memberships WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapMembershipRow(res.rows[0]) : null;
  }

  static async count(role?: string): Promise<number> {
    const res = await this.pool.query(`SELECT COUNT(*)::int AS count FROM catalog.memberships`);
    return res.rows[0]?.count || 0;
  }

  static async create(data: {
    name: string;
    price: number;
    currency?: string;
    duration_days?: number;
    durationDays?: number;
    benefits?: any;
    status?: string;
    role?: string;
  }): Promise<MembershipEntity> {
    const res = await this.pool.query(
      `INSERT INTO catalog.memberships (name, price, currency, duration_days, benefits, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.name,
        data.price,
        data.currency || 'INR',
        data.duration_days ?? data.durationDays ?? 30,
        JSON.stringify(data.benefits || []),
        data.status || 'active',
      ]
    );
    return mapMembershipRow(res.rows[0]);
  }

  static async update(id: string, updates: Record<string, any>): Promise<MembershipEntity | null> {
    const fieldMap: Record<string, string> = {
      name: 'name',
      price: 'price',
      currency: 'currency',
      duration_days: 'duration_days',
      durationDays: 'duration_days',
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

    if (updates.benefits !== undefined) {
      values.push(JSON.stringify(updates.benefits));
      setClauses.push(`benefits = $${values.length}`);
    }

    const res = await this.pool.query(
      `UPDATE catalog.memberships SET ${setClauses.join(', ')} WHERE id::text = $1 OR legacy_mongo_id = $1 RETURNING *`,
      values
    );
    return res.rows[0] ? mapMembershipRow(res.rows[0]) : null;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM catalog.memberships WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
