import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface AddressRecord {
  id: string;
  _id: string;
  userId: string;
  user_id: string;
  addressType: string;
  address_type: string;
  label?: string;
  houseNoBuilding: string;
  house_no_building: string;
  addressLine1: string;
  address_line_1: string;
  addressLine2?: string;
  address_line_2?: string;
  areaLocality: string;
  area_locality: string;
  landmark?: string;
  city: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
  deliveryNotes?: string;
  delivery_notes?: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  formatted_address: string;
  isDefault: boolean;
  is_default: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const mapAddressRow = (row: any): AddressRecord => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const userIdStr = String(row.user_id);

  return {
    id: idStr,
    _id: idStr,
    userId: userIdStr,
    user_id: userIdStr,
    addressType: row.address_type || 'Home',
    address_type: row.address_type || 'Home',
    label: row.label || undefined,
    houseNoBuilding: row.house_no_building || '',
    house_no_building: row.house_no_building || '',
    addressLine1: row.address_line_1 || '',
    address_line_1: row.address_line_1 || '',
    addressLine2: row.address_line_2 || undefined,
    address_line_2: row.address_line_2 || undefined,
    areaLocality: row.area_locality || '',
    area_locality: row.area_locality || '',
    landmark: row.landmark || undefined,
    city: row.city || '',
    district: row.district || '',
    state: row.state || '',
    country: row.country || 'India',
    pincode: row.pincode || '',
    deliveryNotes: row.delivery_notes || undefined,
    delivery_notes: row.delivery_notes || undefined,
    latitude: Number(row.latitude) || 0,
    longitude: Number(row.longitude) || 0,
    formattedAddress: row.formatted_address || '',
    formatted_address: row.formatted_address || '',
    isDefault: Boolean(row.is_default),
    is_default: Boolean(row.is_default),
    createdAt: new Date(row.created_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
};

export class AddressRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findByUserId(userId: string): Promise<AddressRecord[]> {
    const res = await this.pool.query(
      `SELECT * FROM auth.addresses
       WHERE user_id::text = $1 AND deleted_at IS NULL
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
    return res.rows.map(mapAddressRow);
  }

  static async findById(id: string, userId?: string): Promise<AddressRecord | null> {
    const params: any[] = [id];
    let query = `SELECT * FROM auth.addresses WHERE (id::text = $1 OR legacy_mongo_id = $1) AND deleted_at IS NULL`;
    if (userId) {
      params.push(userId);
      query += ` AND user_id::text = $2`;
    }
    const res = await this.pool.query(query, params);
    return res.rows[0] ? mapAddressRow(res.rows[0]) : null;
  }

  static async create(data: {
    userId: string;
    addressType?: string;
    label?: string;
    houseNoBuilding: string;
    addressLine1: string;
    addressLine2?: string;
    areaLocality: string;
    landmark?: string;
    city: string;
    district?: string;
    state: string;
    country?: string;
    pincode: string;
    deliveryNotes?: string;
    latitude: number;
    longitude: number;
    formattedAddress: string;
    isDefault?: boolean;
  }): Promise<AddressRecord> {
    if (data.isDefault) {
      await this.pool.query(
        `UPDATE auth.addresses SET is_default = FALSE WHERE user_id::text = $1`,
        [data.userId]
      );
    }

    const lat = data.latitude || 0;
    const lng = data.longitude || 0;

    const res = await this.pool.query(
      `INSERT INTO auth.addresses (
        user_id, address_type, label, house_no_building, address_line_1, address_line_2,
        area_locality, landmark, city, district, state, country, pincode, delivery_notes,
        latitude, longitude, location, formatted_address, is_default
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, ST_SetSRID(ST_MakePoint($16, $15), 4326)::geography, $17, $18
      ) RETURNING *`,
      [
        data.userId,
        data.addressType || 'Home',
        data.label || null,
        data.houseNoBuilding,
        data.addressLine1,
        data.addressLine2 || null,
        data.areaLocality,
        data.landmark || null,
        data.city,
        data.district || data.city,
        data.state,
        data.country || 'India',
        data.pincode,
        data.deliveryNotes || null,
        lat,
        lng,
        data.formattedAddress,
        Boolean(data.isDefault),
      ]
    );
    return mapAddressRow(res.rows[0]);
  }

  static async update(id: string, userId: string, updates: Partial<AddressRecord>): Promise<AddressRecord | null> {
    if (updates.isDefault || updates.is_default) {
      await this.pool.query(
        `UPDATE auth.addresses SET is_default = FALSE WHERE user_id::text = $1 AND id::text != $2`,
        [userId, id]
      );
    }

    const fieldMap: Record<string, string> = {
      addressType: 'address_type',
      address_type: 'address_type',
      label: 'label',
      houseNoBuilding: 'house_no_building',
      house_no_building: 'house_no_building',
      addressLine1: 'address_line_1',
      address_line_1: 'address_line_1',
      addressLine2: 'address_line_2',
      address_line_2: 'address_line_2',
      areaLocality: 'area_locality',
      area_locality: 'area_locality',
      landmark: 'landmark',
      city: 'city',
      district: 'district',
      state: 'state',
      country: 'country',
      pincode: 'pincode',
      deliveryNotes: 'delivery_notes',
      delivery_notes: 'delivery_notes',
      latitude: 'latitude',
      longitude: 'longitude',
      formattedAddress: 'formatted_address',
      formatted_address: 'formatted_address',
      isDefault: 'is_default',
      is_default: 'is_default',
    };

    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [id, userId];

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
      `UPDATE auth.addresses
       SET ${setClauses.join(', ')}
       WHERE (id::text = $1 OR legacy_mongo_id = $1) AND user_id::text = $2 AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    return res.rows[0] ? mapAddressRow(res.rows[0]) : null;
  }

  static async setDefault(id: string, userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE auth.addresses SET is_default = FALSE WHERE user_id::text = $1`,
      [userId]
    );
    await this.pool.query(
      `UPDATE auth.addresses SET is_default = TRUE, updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1) AND user_id::text = $2 AND deleted_at IS NULL`,
      [id, userId]
    );
  }

  static async softDelete(id: string, userId: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE auth.addresses SET deleted_at = NOW(), updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1) AND user_id::text = $2 AND deleted_at IS NULL`,
      [id, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async countByUserId(userId: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM auth.addresses WHERE user_id::text = $1 AND deleted_at IS NULL`,
      [userId]
    );
    return res.rows[0]?.count ?? 0;
  }

  static async findByIds(ids: string[]): Promise<AddressRecord[]> {
    if (!ids || ids.length === 0) return [];
    const res = await this.pool.query(
      `SELECT * FROM auth.addresses WHERE (id::text = ANY($1) OR legacy_mongo_id = ANY($1)) AND deleted_at IS NULL`,
      [ids]
    );
    return res.rows.map(mapAddressRow);
  }
}
