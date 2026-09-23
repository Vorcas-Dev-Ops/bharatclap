import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface CouponEntity {
  id: string;
  _id: string;
  name: string;
  code: string;
  description: string;
  discount_type: 'flat' | 'percentage' | 'cashback';
  discountType: 'flat' | 'percentage' | 'cashback';
  discount_value: number;
  discountValue: number;
  currency: string;
  min_order_amount: number;
  minOrderAmount: number;
  max_discount_limit: number;
  maxDiscountLimit: number;
  usage_limit: number;
  usageLimit: number;
  per_user_limit: number;
  perUserLimit: number;
  current_global_usage: number;
  currentGlobalUsage: number;
  total_budget: number;
  totalBudget: number;
  current_budget_spent: number;
  currentBudgetSpent: number;
  auto_apply: boolean;
  autoApply: boolean;
  is_featured: boolean;
  isFeatured: boolean;
  badge_label?: string;
  badgeLabel?: string;
  highlight_gradient?: string;
  highlightGradient?: string;
  start_date: Date;
  startDate: Date;
  expiry_date: Date;
  expiryDate: Date;
  status: 'active' | 'inactive' | 'expired';
  is_first_order_only: boolean;
  isFirstOrderOnly: boolean;
  target_audience: string[];
  targetAudience: string[];
  allowed_services: string[];
  allowedServices: string[];
  allowed_categories: string[];
  allowedCategories: string[];
  allowed_memberships: string[];
  allowedMemberships: string[];
  isDeleted: boolean;
  legacy_mongo_id?: string | null;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export const mapCouponRow = (row: any): CouponEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const isDel = row.deleted_at !== null && row.deleted_at !== undefined;

  return {
    id: idStr,
    _id: idStr,
    name: row.name,
    code: row.code,
    description: row.description || '',
    discount_type: row.discount_type,
    discountType: row.discount_type,
    discount_value: parseFloat(row.discount_value || 0),
    discountValue: parseFloat(row.discount_value || 0),
    currency: row.currency || 'INR',
    min_order_amount: parseFloat(row.min_order_amount || 0),
    minOrderAmount: parseFloat(row.min_order_amount || 0),
    max_discount_limit: parseFloat(row.max_discount_limit || 0),
    maxDiscountLimit: parseFloat(row.max_discount_limit || 0),
    usage_limit: Number(row.usage_limit) || 99999,
    usageLimit: Number(row.usage_limit) || 99999,
    per_user_limit: Number(row.per_user_limit) || 1,
    perUserLimit: Number(row.per_user_limit) || 1,
    current_global_usage: Number(row.current_global_usage) || 0,
    currentGlobalUsage: Number(row.current_global_usage) || 0,
    total_budget: parseFloat(row.total_budget || 100000),
    totalBudget: parseFloat(row.total_budget || 100000),
    current_budget_spent: parseFloat(row.current_budget_spent || 0),
    currentBudgetSpent: parseFloat(row.current_budget_spent || 0),
    auto_apply: Boolean(row.auto_apply),
    autoApply: Boolean(row.auto_apply),
    is_featured: Boolean(row.is_featured),
    isFeatured: Boolean(row.is_featured),
    badge_label: row.badge_label || undefined,
    badgeLabel: row.badge_label || undefined,
    highlight_gradient: row.highlight_gradient || undefined,
    highlightGradient: row.highlight_gradient || undefined,
    start_date: new Date(row.start_date || Date.now()),
    startDate: new Date(row.start_date || Date.now()),
    expiry_date: new Date(row.expiry_date),
    expiryDate: new Date(row.expiry_date),
    status: row.status || 'active',
    is_first_order_only: Boolean(row.is_first_order_only),
    isFirstOrderOnly: Boolean(row.is_first_order_only),
    target_audience: Array.isArray(row.target_audience) ? row.target_audience : ['all'],
    targetAudience: Array.isArray(row.target_audience) ? row.target_audience : ['all'],
    allowed_services: Array.isArray(row.allowed_services) ? row.allowed_services : [],
    allowedServices: Array.isArray(row.allowed_services) ? row.allowed_services : [],
    allowed_categories: Array.isArray(row.allowed_categories) ? row.allowed_categories : [],
    allowedCategories: Array.isArray(row.allowed_categories) ? row.allowed_categories : [],
    allowed_memberships: Array.isArray(row.allowed_memberships) ? row.allowed_memberships : [],
    allowedMemberships: Array.isArray(row.allowed_memberships) ? row.allowed_memberships : [],
    isDeleted: isDel,
    legacy_mongo_id: row.legacy_mongo_id || null,
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
};

export class CouponRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findWithPaging(page: number = 1, limit: number = 20): Promise<CouponEntity[]> {
    const offset = (page - 1) * limit;
    const res = await this.pool.query(
      `SELECT c.*,
              COALESCE((SELECT array_agg(service_id::text) FROM catalog.coupon_allowed_services WHERE coupon_id = c.id), '{}') AS allowed_services,
              COALESCE((SELECT array_agg(category_id::text) FROM catalog.coupon_allowed_categories WHERE coupon_id = c.id), '{}') AS allowed_categories,
              COALESCE((SELECT array_agg(membership_id::text) FROM catalog.coupon_allowed_memberships WHERE coupon_id = c.id), '{}') AS allowed_memberships
       FROM catalog.coupons c
       WHERE c.deleted_at IS NULL
       ORDER BY c.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.rows.map(mapCouponRow);
  }

  static async findAll(activeOnly: boolean = false): Promise<CouponEntity[]> {
    const where = activeOnly
      ? `WHERE deleted_at IS NULL AND status = 'active' AND expiry_date >= NOW()`
      : `WHERE deleted_at IS NULL`;
    const res = await this.pool.query(
      `SELECT c.*,
              COALESCE((SELECT array_agg(service_id::text) FROM catalog.coupon_allowed_services WHERE coupon_id = c.id), '{}') AS allowed_services,
              COALESCE((SELECT array_agg(category_id::text) FROM catalog.coupon_allowed_categories WHERE coupon_id = c.id), '{}') AS allowed_categories,
              COALESCE((SELECT array_agg(membership_id::text) FROM catalog.coupon_allowed_memberships WHERE coupon_id = c.id), '{}') AS allowed_memberships
       FROM catalog.coupons c
       ${where}
       ORDER BY c.created_at DESC`
    );
    return res.rows.map(mapCouponRow);
  }

  static async findById(id: string): Promise<CouponEntity | null> {
    if (!id) return null;
    const res = await this.pool.query(
      `SELECT c.*,
              COALESCE((SELECT array_agg(service_id::text) FROM catalog.coupon_allowed_services WHERE coupon_id = c.id), '{}') AS allowed_services,
              COALESCE((SELECT array_agg(category_id::text) FROM catalog.coupon_allowed_categories WHERE coupon_id = c.id), '{}') AS allowed_categories,
              COALESCE((SELECT array_agg(membership_id::text) FROM catalog.coupon_allowed_memberships WHERE coupon_id = c.id), '{}') AS allowed_memberships
       FROM catalog.coupons c
       WHERE (c.id::text = $1 OR c.legacy_mongo_id = $1) AND c.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapCouponRow(res.rows[0]) : null;
  }

  static async findByCode(code: string): Promise<CouponEntity | null> {
    if (!code) return null;
    const res = await this.pool.query(
      `SELECT c.*,
              COALESCE((SELECT array_agg(service_id::text) FROM catalog.coupon_allowed_services WHERE coupon_id = c.id), '{}') AS allowed_services,
              COALESCE((SELECT array_agg(category_id::text) FROM catalog.coupon_allowed_categories WHERE coupon_id = c.id), '{}') AS allowed_categories,
              COALESCE((SELECT array_agg(membership_id::text) FROM catalog.coupon_allowed_memberships WHERE coupon_id = c.id), '{}') AS allowed_memberships
       FROM catalog.coupons c
       WHERE UPPER(c.code) = UPPER($1) AND c.deleted_at IS NULL
       LIMIT 1`,
      [code.trim()]
    );
    return res.rows[0] ? mapCouponRow(res.rows[0]) : null;
  }

  static async count(status?: string): Promise<number> {
    const where = status ? `WHERE deleted_at IS NULL AND status = $1` : `WHERE deleted_at IS NULL`;
    const values = status ? [status] : [];
    const res = await this.pool.query(`SELECT COUNT(*)::int AS count FROM catalog.coupons ${where}`, values);
    return res.rows[0]?.count || 0;
  }

  static async create(data: any): Promise<CouponEntity> {
    const res = await this.pool.query(
      `INSERT INTO catalog.coupons (
        name, code, description, discount_type, discount_value,
        min_order_amount, max_discount_limit, usage_limit, per_user_limit,
        total_budget, auto_apply, is_featured, badge_label, highlight_gradient,
        start_date, expiry_date, status, is_first_order_only, target_audience
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *`,
      [
        data.name || data.code || 'COUPON',
        data.code.trim().toUpperCase(),
        data.description || '',
        data.discount_type || data.discountType || 'flat',
        data.discount_value !== undefined ? data.discount_value : (data.discountValue || 0),
        data.min_order_amount !== undefined ? data.min_order_amount : (data.minOrderAmount || 0),
        data.max_discount_limit !== undefined ? data.max_discount_limit : (data.maxDiscountLimit || 0),
        data.usage_limit !== undefined ? data.usage_limit : (data.usageLimit || 99999),
        data.per_user_limit !== undefined ? data.per_user_limit : (data.perUserLimit || 1),
        data.total_budget !== undefined ? data.total_budget : (data.totalBudget || 100000),
        Boolean(data.auto_apply || data.autoApply),
        Boolean(data.is_featured || data.isFeatured),
        data.badge_label || data.badgeLabel || null,
        data.highlight_gradient || data.highlightGradient || null,
        data.start_date || data.startDate || new Date(),
        data.expiry_date || data.expiryDate || new Date(Date.now() + 30 * 86400000),
        data.status || 'active',
        Boolean(data.is_first_order_only || data.isFirstOrderOnly),
        data.target_audience || data.targetAudience || ['all'],
      ]
    );

    const coupon = res.rows[0];
    return this.findById(coupon.id) as Promise<CouponEntity>;
  }

  static async update(id: string, updates: Record<string, any>): Promise<CouponEntity | null> {
    const fieldMap: Record<string, string> = {
      name: 'name',
      code: 'code',
      description: 'description',
      discount_type: 'discount_type',
      discountType: 'discount_type',
      discount_value: 'discount_value',
      discountValue: 'discount_value',
      min_order_amount: 'min_order_amount',
      minOrderAmount: 'min_order_amount',
      max_discount_limit: 'max_discount_limit',
      maxDiscountLimit: 'max_discount_limit',
      usage_limit: 'usage_limit',
      usageLimit: 'usage_limit',
      per_user_limit: 'per_user_limit',
      perUserLimit: 'per_user_limit',
      current_global_usage: 'current_global_usage',
      total_budget: 'total_budget',
      totalBudget: 'total_budget',
      current_budget_spent: 'current_budget_spent',
      auto_apply: 'auto_apply',
      autoApply: 'auto_apply',
      is_featured: 'is_featured',
      isFeatured: 'is_featured',
      badge_label: 'badge_label',
      badgeLabel: 'badge_label',
      highlight_gradient: 'highlight_gradient',
      highlightGradient: 'highlight_gradient',
      start_date: 'start_date',
      startDate: 'start_date',
      expiry_date: 'expiry_date',
      expiryDate: 'expiry_date',
      status: 'status',
      is_first_order_only: 'is_first_order_only',
      isFirstOrderOnly: 'is_first_order_only',
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
      `UPDATE catalog.coupons
       SET ${setClauses.join(', ')}
       WHERE (id::text = $1 OR legacy_mongo_id = $1) AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    return res.rows[0] ? this.findById(res.rows[0].id) : null;
  }

  static async incrementUsage(id: string, discountNum: number): Promise<CouponEntity | null> {
    const res = await this.pool.query(
      `UPDATE catalog.coupons
       SET current_global_usage = current_global_usage + 1,
           current_budget_spent = current_budget_spent + $2,
           status = CASE
             WHEN (current_global_usage + 1 >= usage_limit OR current_budget_spent + $2 >= total_budget) THEN 'expired'::character varying
             ELSE status
           END,
           updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1) AND deleted_at IS NULL
       RETURNING *`,
      [id, discountNum]
    );
    return res.rows[0] ? this.findById(res.rows[0].id) : null;
  }

  static async softDelete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE catalog.coupons
       SET deleted_at = NOW(), status = 'inactive', updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1) AND deleted_at IS NULL`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
