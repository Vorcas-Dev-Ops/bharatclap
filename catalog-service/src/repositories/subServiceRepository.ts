import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface SubServiceEntity {
  id: string;
  _id: string;
  service_id: string;
  subservice_name: string;
  name: string;
  description: string;
  has_packages: boolean;
  hasPackages: boolean;
  base_price?: number;
  basePrice?: number;
  currency: string;
  duration?: number;
  image?: string;
  status: 'active' | 'inactive';
  isDeleted: boolean;
  legacy_mongo_id?: string | null;
  variants: any[];
  packages: any[];
  service_preparations: any[];
  servicePreparations: any[];
  service?: {
    id: string;
    _id: string;
    service_name: string;
    image?: string;
    images?: string[];
    category_id?: {
      id: string;
      _id: string;
      category_name: string;
    };
  };
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export const mapSubServiceRow = (row: any): SubServiceEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const isDel = row.deleted_at !== null && row.deleted_at !== undefined;

  const basePrice = row.base_price !== null && row.base_price !== undefined ? parseFloat(row.base_price) : undefined;
  const duration = row.duration !== null && row.duration !== undefined ? Number(row.duration) : undefined;

  const entity: SubServiceEntity = {
    id: idStr,
    _id: idStr,
    service_id: String(row.service_id),
    subservice_name: row.subservice_name,
    name: row.subservice_name,
    description: row.description || '',
    has_packages: Boolean(row.has_packages),
    hasPackages: Boolean(row.has_packages),
    base_price: basePrice,
    basePrice: basePrice,
    currency: row.currency || 'INR',
    duration,
    image: row.image || (Array.isArray(row.service_images) && row.service_images[0]) || row.category_icon || undefined,
    status: row.status || 'active',
    isDeleted: isDel,
    legacy_mongo_id: row.legacy_mongo_id || null,
    variants: Array.isArray(row.variants) ? row.variants : [],
    packages: Array.isArray(row.packages) ? row.packages : [],
    service_preparations: Array.isArray(row.service_preparations) ? row.service_preparations : [],
    servicePreparations: Array.isArray(row.service_preparations) ? row.service_preparations : [],
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };

  if (row.service_name) {
    const sImages = Array.isArray(row.service_images) ? row.service_images : [];
    entity.service = {
      id: String(row.service_id),
      _id: String(row.service_id),
      service_name: row.service_name,
      images: sImages,
      image: sImages[0] || row.category_icon || '',
      category_id: row.category_id ? {
        id: String(row.category_id),
        _id: String(row.category_id),
        category_name: row.category_name || '',
      } : undefined,
    };
  }

  return entity;
};

export class SubServiceRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findSubServices(options: {
    serviceId?: string;
    categoryId?: string;
    subserviceIds?: string[];
    includeInactive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<SubServiceEntity[]> {
    const conditions: string[] = ['ss.deleted_at IS NULL'];
    const values: any[] = [];

    if (!options.includeInactive) {
      conditions.push(`ss.status = 'active'`);
    }

    if (options.serviceId && options.serviceId !== 'all') {
      values.push(options.serviceId);
      conditions.push(`(ss.service_id::text = $${values.length} OR s.legacy_mongo_id = $${values.length})`);
    }

    if (options.categoryId && options.categoryId !== 'all') {
      values.push(options.categoryId);
      conditions.push(`(s.category_id::text = $${values.length} OR c.legacy_mongo_id = $${values.length})`);
    }

    if (options.subserviceIds) {
      if (options.subserviceIds.length === 0) return [];
      values.push(options.subserviceIds);
      conditions.push(`(ss.id::text = ANY($${values.length}) OR ss.legacy_mongo_id = ANY($${values.length}))`);
    }

    const page = options.page || 1;
    const limit = options.limit || 100;
    const offset = (page - 1) * limit;

    values.push(limit, offset);

    const query = `
      SELECT ss.*,
             s.service_name,
             s.images AS service_images,
             s.category_id,
             c.name AS category_name,
             c.icon AS category_icon,
             COALESCE((
               SELECT json_agg(json_build_object(
                 'id', v.id, '_id', v.id, 'name', v.name,
                 'price', v.price, 'currency', v.currency, 'duration', v.duration
               ))
               FROM catalog.subservice_variants v
               WHERE v.subservice_id = ss.id
             ), '[]'::json) AS variants,
             COALESCE((
               SELECT json_agg(json_build_object(
                 'id', p.id, '_id', p.id, 'name', p.name,
                 'base_price', p.base_price, 'currency', p.currency, 'duration', p.duration
               ))
               FROM catalog.subservice_packages p
               WHERE p.subservice_id = ss.id
             ), '[]'::json) AS packages,
             COALESCE((
               SELECT json_agg(json_build_object(
                 'id', sp.id, '_id', sp.id, 'title', sp.title, 'is_mandatory', sp.is_mandatory
               ))
               FROM catalog.service_preparations sp
               WHERE sp.subservice_id = ss.id
             ), '[]'::json) AS service_preparations
      FROM catalog.subservices ss
      JOIN catalog.services s ON s.id = ss.service_id AND s.deleted_at IS NULL
      LEFT JOIN catalog.categories c ON c.id = s.category_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ss.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `;

    const res = await this.pool.query(query, values);
    return res.rows.map(mapSubServiceRow);
  }

  static async findById(id: string): Promise<SubServiceEntity | null> {
    if (!id) return null;
    const res = await this.pool.query(
      `SELECT ss.*,
              s.service_name,
              s.images AS service_images,
              s.category_id,
              c.name AS category_name,
              c.icon AS category_icon,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', v.id, '_id', v.id, 'name', v.name,
                  'price', v.price, 'currency', v.currency, 'duration', v.duration
                ))
                FROM catalog.subservice_variants v
                WHERE v.subservice_id = ss.id
              ), '[]'::json) AS variants,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', p.id, '_id', p.id, 'name', p.name,
                  'base_price', p.base_price, 'currency', p.currency, 'duration', p.duration
                ))
                FROM catalog.subservice_packages p
                WHERE p.subservice_id = ss.id
              ), '[]'::json) AS packages,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', sp.id, '_id', sp.id, 'title', sp.title, 'is_mandatory', sp.is_mandatory
                ))
                FROM catalog.service_preparations sp
                WHERE sp.subservice_id = ss.id
              ), '[]'::json) AS service_preparations
       FROM catalog.subservices ss
       JOIN catalog.services s ON s.id = ss.service_id AND s.deleted_at IS NULL
       LEFT JOIN catalog.categories c ON c.id = s.category_id
       WHERE (ss.id::text = $1 OR ss.legacy_mongo_id = $1 OR LOWER(ss.subservice_name) = LOWER($1)) AND ss.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapSubServiceRow(res.rows[0]) : null;
  }

  static async findByIds(ids: string[]): Promise<SubServiceEntity[]> {
    if (!ids || ids.length === 0) return [];
    const res = await this.pool.query(
      `SELECT ss.*,
              s.service_name,
              s.images AS service_images,
              s.category_id,
              c.name AS category_name,
              c.icon AS category_icon,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', v.id, '_id', v.id, 'name', v.name,
                  'price', v.price, 'currency', v.currency, 'duration', v.duration
                ))
                FROM catalog.subservice_variants v
                WHERE v.subservice_id = ss.id
              ), '[]'::json) AS variants,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', p.id, '_id', p.id, 'name', p.name,
                  'base_price', p.base_price, 'currency', p.currency, 'duration', p.duration
                ))
                FROM catalog.subservice_packages p
                WHERE p.subservice_id = ss.id
              ), '[]'::json) AS packages
       FROM catalog.subservices ss
       JOIN catalog.services s ON s.id = ss.service_id AND s.deleted_at IS NULL
       LEFT JOIN catalog.categories c ON c.id = s.category_id
       WHERE (ss.id::text = ANY($1) OR ss.legacy_mongo_id = ANY($1)) AND ss.deleted_at IS NULL`,
      [ids]
    );
    return res.rows.map(mapSubServiceRow);
  }

  static async create(data: {
    serviceId: string;
    subserviceName: string;
    description: string;
    hasPackages?: boolean;
    basePrice?: number;
    duration?: number;
    image?: string;
    status?: string;
    variants?: any[];
    packages?: any[];
    service_preparations?: any[];
  }): Promise<SubServiceEntity> {
    const res = await this.pool.query(
      `INSERT INTO catalog.subservices (
        service_id, subservice_name, description, has_packages,
        base_price, duration, image, status
      ) VALUES (
        (SELECT id FROM catalog.services WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
        $2, $3, $4, $5, $6, $7, $8
      ) RETURNING id`,
      [
        data.serviceId,
        data.subserviceName,
        data.description,
        Boolean(data.hasPackages),
        data.basePrice ?? null,
        data.duration ?? null,
        data.image || null,
        data.status || 'active',
      ]
    );
    const subserviceId = res.rows[0].id;

    if (Array.isArray(data.variants) && data.variants.length > 0) {
      for (const v of data.variants) {
        if (v.name && v.price !== undefined) {
          await this.pool.query(
            `INSERT INTO catalog.subservice_variants (subservice_id, name, price, duration)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (subservice_id, name) DO NOTHING`,
            [subserviceId, v.name, v.price, v.duration || 30]
          );
        }
      }
    }

    if (Array.isArray(data.packages) && data.packages.length > 0) {
      for (const p of data.packages) {
        if (p.name && (p.base_price !== undefined || p.basePrice !== undefined)) {
          await this.pool.query(
            `INSERT INTO catalog.subservice_packages (subservice_id, name, base_price, duration)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (subservice_id, name) DO NOTHING`,
            [subserviceId, p.name, p.base_price ?? p.basePrice, p.duration || 30]
          );
        }
      }
    }

    if (Array.isArray(data.service_preparations) && data.service_preparations.length > 0) {
      for (const prep of data.service_preparations) {
        if (prep.title) {
          await this.pool.query(
            `INSERT INTO catalog.service_preparations (subservice_id, title, is_mandatory)
             VALUES ($1, $2, $3)`,
            [subserviceId, prep.title, Boolean(prep.is_mandatory ?? prep.isMandatory)]
          );
        }
      }
    }

    return this.findById(subserviceId) as Promise<SubServiceEntity>;
  }

  static async update(id: string, updates: Record<string, any>): Promise<SubServiceEntity | null> {
    const fieldMap: Record<string, string> = {
      subservice_name: 'subservice_name',
      name: 'subservice_name',
      subserviceName: 'subservice_name',
      description: 'description',
      has_packages: 'has_packages',
      hasPackages: 'has_packages',
      base_price: 'base_price',
      basePrice: 'base_price',
      duration: 'duration',
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

    if (updates.service_id || updates.serviceId) {
      const sId = updates.service_id ?? updates.serviceId;
      values.push(sId);
      setClauses.push(`service_id = (SELECT id FROM catalog.services WHERE id::text = $${values.length} OR legacy_mongo_id = $${values.length} LIMIT 1)`);
    }

    const res = await this.pool.query(
      `UPDATE catalog.subservices
       SET ${setClauses.join(', ')}
       WHERE (id::text = $1 OR legacy_mongo_id = $1) AND deleted_at IS NULL
       RETURNING id`,
      values
    );

    if (res.rows.length === 0) return null;
    const subserviceId = res.rows[0].id;

    if (Array.isArray(updates.variants)) {
      await this.pool.query(`DELETE FROM catalog.subservice_variants WHERE subservice_id = $1`, [subserviceId]);
      for (const v of updates.variants) {
        if (v.name && v.price !== undefined) {
          await this.pool.query(
            `INSERT INTO catalog.subservice_variants (subservice_id, name, price, duration)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (subservice_id, name) DO NOTHING`,
            [subserviceId, v.name, v.price, v.duration || 30]
          );
        }
      }
    }

    if (Array.isArray(updates.packages)) {
      await this.pool.query(`DELETE FROM catalog.subservice_packages WHERE subservice_id = $1`, [subserviceId]);
      for (const p of updates.packages) {
        if (p.name && (p.base_price !== undefined || p.basePrice !== undefined)) {
          await this.pool.query(
            `INSERT INTO catalog.subservice_packages (subservice_id, name, base_price, duration)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (subservice_id, name) DO NOTHING`,
            [subserviceId, p.name, p.base_price ?? p.basePrice, p.duration || 30]
          );
        }
      }
    }

    if (Array.isArray(updates.service_preparations)) {
      await this.pool.query(`DELETE FROM catalog.service_preparations WHERE subservice_id = $1`, [subserviceId]);
      for (const prep of updates.service_preparations) {
        if (prep.title) {
          await this.pool.query(
            `INSERT INTO catalog.service_preparations (subservice_id, title, is_mandatory)
             VALUES ($1, $2, $3)`,
            [subserviceId, prep.title, Boolean(prep.is_mandatory ?? prep.isMandatory)]
          );
        }
      }
    }

    return this.findById(subserviceId);
  }

  static async softDelete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE catalog.subservices
       SET deleted_at = NOW(), status = 'inactive', updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1) AND deleted_at IS NULL`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
