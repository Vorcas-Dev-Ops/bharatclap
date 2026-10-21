import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface LocationRecord {
  id: string;
  _id: string;
  name: string;
  city: string;
  state: string;
  pincode?: string;
  latitude: number;
  longitude: number;
  serviceRadius: number;
  service_radius: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const mapLocationRow = (row: any): LocationRecord => {
  if (!row) return null as any;
  const idStr = String(row.id);
  return {
    id: idStr,
    _id: idStr,
    name: row.name,
    city: row.city,
    state: row.state,
    pincode: row.pincode || undefined,
    latitude: Number(row.latitude) || 0,
    longitude: Number(row.longitude) || 0,
    serviceRadius: row.service_radius || 10000,
    service_radius: row.service_radius || 10000,
    status: row.status || 'active',
    createdAt: new Date(row.created_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
};

export class LocationRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findAllActive(): Promise<LocationRecord[]> {
    const res = await this.pool.query(
      `SELECT * FROM auth.locations WHERE status = 'active' ORDER BY name ASC`
    );
    return res.rows.map(mapLocationRow);
  }

  static async findById(id: string): Promise<LocationRecord | null> {
    const res = await this.pool.query(
      `SELECT * FROM auth.locations WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapLocationRow(res.rows[0]) : null;
  }

  static async findNearby(lat: number, lng: number): Promise<LocationRecord[]> {
    const res = await this.pool.query(
      `SELECT *,
              ST_Distance(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance
       FROM auth.locations
       WHERE status = 'active'
         AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, service_radius)
       ORDER BY distance ASC`,
      [lat, lng]
    );
    return res.rows.map(mapLocationRow);
  }

  static async create(data: {
    name: string;
    city: string;
    state: string;
    pincode?: string;
    latitude: number;
    longitude: number;
    serviceRadius?: number;
    status?: 'active' | 'inactive';
  }): Promise<LocationRecord> {
    const lat = data.latitude || 0;
    const lng = data.longitude || 0;
    const res = await this.pool.query(
      `INSERT INTO auth.locations (
        name, city, state, pincode, latitude, longitude, service_radius, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING *`,
      [
        data.name,
        data.city,
        data.state,
        data.pincode || null,
        lat,
        lng,
        data.serviceRadius || 10000,
        data.status || 'active',
      ]
    );
    return mapLocationRow(res.rows[0]);
  }

  static async findLocations(filter: { status?: string; city?: string; search?: string }): Promise<LocationRecord[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (filter.status) {
      values.push(filter.status);
      conditions.push(`status = $${values.length}`);
    }
    if (filter.city) {
      const cityNorm = filter.city.trim();
      if (/^(bengaluru|bangalore)$/i.test(cityNorm)) {
        conditions.push(`city ILIKE ANY(ARRAY['%bengaluru%', '%bangalore%'])`);
      } else {
        values.push(cityNorm);
        conditions.push(`city ILIKE $${values.length}`);
      }
    }
    if (filter.search) {
      values.push(`%${filter.search.trim()}%`);
      const idx = values.length;
      conditions.push(`(name ILIKE $${idx} OR city ILIKE $${idx} OR pincode ILIKE $${idx})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await this.pool.query(
      `SELECT * FROM auth.locations ${whereClause} ORDER BY name ASC`,
      values
    );
    return res.rows.map(mapLocationRow);
  }

  static async update(id: string, updates: Partial<LocationRecord>): Promise<LocationRecord | null> {
    const fieldMap: Record<string, string> = {
      name: 'name',
      city: 'city',
      state: 'state',
      pincode: 'pincode',
      status: 'status',
      serviceRadius: 'service_radius',
      service_radius: 'service_radius',
      latitude: 'latitude',
      longitude: 'longitude',
    };

    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [id];

    for (const [key, val] of Object.entries(updates)) {
      const col = fieldMap[key];
      if (col) {
        values.push(val);
        setClauses.push(`${col} = $${values.length}`);
      }
    }

    if (updates.latitude !== undefined && updates.longitude !== undefined) {
      values.push(updates.longitude, updates.latitude);
      const lngIdx = values.length - 1;
      const latIdx = values.length;
      setClauses.push(`location = ST_SetSRID(ST_MakePoint($${lngIdx}, $${latIdx}), 4326)::geography`);
    }

    const res = await this.pool.query(
      `UPDATE auth.locations SET ${setClauses.join(', ')} WHERE id::text = $1 OR legacy_mongo_id = $1 RETURNING *`,
      values
    );
    return res.rows[0] ? mapLocationRow(res.rows[0]) : null;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE auth.locations SET status = 'inactive', updated_at = NOW() WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async findByIds(ids: string[]): Promise<LocationRecord[]> {
    if (!ids || ids.length === 0) return [];
    const res = await this.pool.query(
      `SELECT * FROM auth.locations WHERE id::text = ANY($1) OR legacy_mongo_id = ANY($1)`,
      [ids]
    );
    return res.rows.map(mapLocationRow);
  }
}
