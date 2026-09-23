import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface ServiceEntity {
  id: string;
  _id: string;
  category_id: string;
  service_name: string;
  name: string;
  slug: string;
  description: string;
  base_price: number;
  currency: string;
  duration: number;
  images: string[];
  is_featured: boolean;
  isFeatured: boolean;
  avg_rating: number;
  total_reviews: number;
  gender_applicability: 'men' | 'women';
  genderApplicability: 'men' | 'women';
  status: 'active' | 'inactive';
  isDeleted: boolean;
  legacy_mongo_id?: string | null;
  category?: any;
  subservices_count?: number;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export const mapServiceRow = (row: any): ServiceEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const isDel = row.deleted_at !== null && row.deleted_at !== undefined;

  const entity: ServiceEntity = {
    id: idStr,
    _id: idStr,
    category_id: String(row.category_id),
    service_name: row.service_name,
    name: row.service_name,
    slug: row.slug,
    description: row.description || '',
    base_price: parseFloat(row.base_price || 0),
    currency: row.currency || 'INR',
    duration: Number(row.duration) || 0,
    images: Array.isArray(row.images) ? row.images : [],
    is_featured: Boolean(row.is_featured),
    isFeatured: Boolean(row.is_featured),
    avg_rating: parseFloat(row.avg_rating || 0),
    total_reviews: Number(row.total_reviews) || 0,
    gender_applicability: row.gender_applicability || 'men',
    genderApplicability: row.gender_applicability || 'men',
    status: row.status || 'active',
    isDeleted: isDel,
    legacy_mongo_id: row.legacy_mongo_id || null,
    subservices_count: row.subservices_count !== undefined ? Number(row.subservices_count) : 0,
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };

  if (row.category_name) {
    entity.category = {
      _id: String(row.category_id),
      id: String(row.category_id),
      name: row.category_name,
      category_name: row.category_name,
      icon: row.category_icon || '',
      requiresGenderSelection: Boolean(row.category_requires_gender_selection),
    };
  }

  return entity;
};

export class ServiceRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findServices(options: {
    categoryId?: string;
    gender?: string;
    includeInactive?: boolean;
    page?: number;
    limit?: number;
    featured?: boolean;
  }): Promise<ServiceEntity[]> {
    const conditions: string[] = ['s.deleted_at IS NULL'];
    const values: any[] = [];

    if (!options.includeInactive) {
      conditions.push(`s.status = 'active'`);
    }

    if (options.categoryId && options.categoryId !== 'all') {
      values.push(options.categoryId);
      conditions.push(`(s.category_id::text = $${values.length} OR c.legacy_mongo_id = $${values.length})`);
    }

    if (options.gender && ['men', 'women'].includes(options.gender)) {
      values.push(options.gender);
      conditions.push(`s.gender_applicability = $${values.length}`);
    }

    if (options.featured) {
      conditions.push(`s.is_featured = TRUE`);
    }

    const page = options.page || 1;
    const limit = options.limit || 100;
    const offset = (page - 1) * limit;

    values.push(limit, offset);

    const query = `
      SELECT s.*,
             c.name AS category_name,
             c.icon AS category_icon,
             c.requires_gender_selection AS category_requires_gender_selection,
             (SELECT COUNT(*)::int FROM catalog.subservices ss WHERE ss.service_id = s.id AND ss.deleted_at IS NULL) AS subservices_count
      FROM catalog.services s
      LEFT JOIN catalog.categories c ON c.id = s.category_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY s.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `;

    const res = await this.pool.query(query, values);
    return res.rows.map(mapServiceRow);
  }

  static async findById(id: string): Promise<ServiceEntity | null> {
    if (!id) return null;
    const res = await this.pool.query(
      `SELECT s.*,
              c.name AS category_name,
              c.icon AS category_icon,
              c.requires_gender_selection AS category_requires_gender_selection,
              (SELECT COUNT(*)::int FROM catalog.subservices ss WHERE ss.service_id = s.id AND ss.deleted_at IS NULL) AS subservices_count
       FROM catalog.services s
       LEFT JOIN catalog.categories c ON c.id = s.category_id
       WHERE (s.id::text = $1 OR s.legacy_mongo_id = $1) AND s.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapServiceRow(res.rows[0]) : null;
  }

  static async findByIds(ids: string[]): Promise<ServiceEntity[]> {
    if (!ids || ids.length === 0) return [];
    const res = await this.pool.query(
      `SELECT s.*,
              c.name AS category_name,
              c.icon AS category_icon,
              c.requires_gender_selection AS category_requires_gender_selection
       FROM catalog.services s
       LEFT JOIN catalog.categories c ON c.id = s.category_id
       WHERE (s.id::text = ANY($1) OR s.legacy_mongo_id = ANY($1)) AND s.deleted_at IS NULL`,
      [ids]
    );
    return res.rows.map(mapServiceRow);
  }

  static async create(data: {
    categoryId: string;
    serviceName: string;
    slug?: string;
    description: string;
    basePrice: number;
    duration: number;
    images?: string[];
    isFeatured?: boolean;
    genderApplicability?: string;
    status?: string;
  }): Promise<ServiceEntity> {
    const slug = data.slug || data.serviceName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    const res = await this.pool.query(
      `INSERT INTO catalog.services (
        category_id, service_name, slug, description, base_price, duration,
        images, is_featured, gender_applicability, status
      ) VALUES (
        (SELECT id FROM catalog.categories WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
        $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING *`,
      [
        data.categoryId,
        data.serviceName,
        slug,
        data.description,
        data.basePrice,
        data.duration,
        data.images || [],
        Boolean(data.isFeatured),
        data.genderApplicability || 'men',
        data.status || 'active',
      ]
    );
    return mapServiceRow(res.rows[0]);
  }

  static async update(id: string, updates: Record<string, any>): Promise<ServiceEntity | null> {
    const fieldMap: Record<string, string> = {
      service_name: 'service_name',
      name: 'service_name',
      serviceName: 'service_name',
      category_id: 'category_id',
      categoryId: 'category_id',
      slug: 'slug',
      description: 'description',
      base_price: 'base_price',
      basePrice: 'basePrice',
      duration: 'duration',
      images: 'images',
      is_featured: 'is_featured',
      isFeatured: 'is_featured',
      avg_rating: 'avg_rating',
      total_reviews: 'total_reviews',
      gender_applicability: 'gender_applicability',
      genderApplicability: 'gender_applicability',
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
      `UPDATE catalog.services
       SET ${setClauses.join(', ')}
       WHERE (id::text = $1 OR legacy_mongo_id = $1) AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    return res.rows[0] ? mapServiceRow(res.rows[0]) : null;
  }

  static async softDelete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE catalog.services
       SET deleted_at = NOW(), status = 'inactive', updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1) AND deleted_at IS NULL`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
