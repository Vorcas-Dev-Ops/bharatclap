import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface TimeSlotRuleEntity {
  id: string;
  _id: string;
  category_id?: string;
  categoryId?: string;
  categoryName?: string;
  ruleName: string;
  day_of_week?: number;
  dayOfWeek?: number;
  daysOfWeek: number[];
  start_time: string;
  startTime: string;
  end_time: string;
  endTime: string;
  multiplier: number;
  extraCharge: number;
  pricingType: 'PERCENTAGE_SURCHARGE' | 'FIXED_SURCHARGE' | 'PERCENTAGE_DISCOUNT' | 'FIXED_DISCOUNT';
  priority: number;
  isStackable: boolean;
  isExclusive: boolean;
  is_active: boolean;
  isActive: boolean;
  status: 'draft' | 'scheduled' | 'active' | 'expired' | 'disabled' | 'archived';
  version: number;
  created_at: Date;
  updated_at: Date;
}

export const mapTimeSlotRuleRow = (row: any): TimeSlotRuleEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const catIdStr = row.category_id ? String(row.category_id) : undefined;
  const mult = parseFloat(row.multiplier || 1.0);
  const isActive = Boolean(row.is_active);
  const day = row.day_of_week !== null && row.day_of_week !== undefined ? Number(row.day_of_week) : undefined;

  return {
    id: idStr,
    _id: idStr,
    category_id: catIdStr,
    categoryId: catIdStr,
    categoryName: row.category_name || undefined,
    ruleName: row.rule_name || (row.category_name ? `${row.category_name} Slot Rule` : 'Standard Time Slot Rule'),
    day_of_week: day,
    dayOfWeek: day,
    daysOfWeek: day !== undefined ? [day] : [],
    start_time: row.start_time,
    startTime: row.start_time,
    end_time: row.end_time,
    endTime: row.end_time,
    multiplier: mult,
    extraCharge: mult >= 1.0 ? Math.round((mult - 1.0) * 100) : Math.round((1.0 - mult) * 100),
    pricingType: mult >= 1.0 ? 'PERCENTAGE_SURCHARGE' : 'PERCENTAGE_DISCOUNT',
    priority: 10,
    isStackable: true,
    isExclusive: false,
    is_active: isActive,
    isActive: isActive,
    status: isActive ? 'active' : 'disabled',
    version: 1,
    created_at: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
  };
};

export class TimeSlotRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async find(filter?: { categoryId?: string; status?: string }): Promise<TimeSlotRuleEntity[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (filter?.categoryId) {
      values.push(filter.categoryId);
      conditions.push(`(t.category_id::text = $${values.length} OR c.legacy_mongo_id = $${values.length})`);
    }

    if (filter?.status === 'active') {
      conditions.push('t.is_active = TRUE');
    } else if (filter?.status === 'disabled') {
      conditions.push('t.is_active = FALSE');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await this.pool.query(
      `SELECT t.*, c.name AS category_name
       FROM catalog.time_slot_rules t
       LEFT JOIN catalog.categories c ON c.id = t.category_id
       ${where}
       ORDER BY t.created_at DESC`,
      values
    );
    return res.rows.map(mapTimeSlotRuleRow);
  }

  static async findAll(activeOnly: boolean = false): Promise<TimeSlotRuleEntity[]> {
    const where = activeOnly ? `WHERE t.is_active = TRUE` : '';
    const res = await this.pool.query(
      `SELECT t.*, c.name AS category_name
       FROM catalog.time_slot_rules t
       LEFT JOIN catalog.categories c ON c.id = t.category_id
       ${where}
       ORDER BY t.day_of_week ASC, t.start_time ASC`
    );
    return res.rows.map(mapTimeSlotRuleRow);
  }

  static async findById(id: string): Promise<TimeSlotRuleEntity | null> {
    if (!id) return null;
    const res = await this.pool.query(
      `SELECT t.*, c.name AS category_name
       FROM catalog.time_slot_rules t
       LEFT JOIN catalog.categories c ON c.id = t.category_id
       WHERE t.id::text = $1 OR t.legacy_mongo_id = $1
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapTimeSlotRuleRow(res.rows[0]) : null;
  }

  static async findActiveRules(): Promise<TimeSlotRuleEntity[]> {
    const res = await this.pool.query(
      `SELECT t.*, c.name AS category_name
       FROM catalog.time_slot_rules t
       LEFT JOIN catalog.categories c ON c.id = t.category_id
       WHERE t.is_active = TRUE
       ORDER BY t.created_at DESC`
    );
    return res.rows.map(mapTimeSlotRuleRow);
  }

  static async create(data: {
    categoryId?: string;
    dayOfWeek?: number;
    startTime: string;
    endTime: string;
    multiplier?: number;
    extraCharge?: number;
    pricingType?: string;
    isActive?: boolean;
    status?: string;
  }): Promise<TimeSlotRuleEntity> {
    let multiplier = data.multiplier;
    if (multiplier === undefined && data.extraCharge !== undefined) {
      if (data.pricingType === 'PERCENTAGE_DISCOUNT' || data.pricingType === 'FIXED_DISCOUNT') {
        multiplier = Math.max(0, 1.0 - (data.extraCharge / 100));
      } else {
        multiplier = 1.0 + (data.extraCharge / 100);
      }
    }
    if (multiplier === undefined) multiplier = 1.0;

    const isActive = data.isActive !== undefined ? Boolean(data.isActive) : (data.status !== 'disabled');

    const res = await this.pool.query(
      `INSERT INTO catalog.time_slot_rules (category_id, day_of_week, start_time, end_time, multiplier, is_active)
       VALUES (
         (SELECT id FROM catalog.categories WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         $2, $3, $4, $5, $6
       ) RETURNING *`,
      [
        data.categoryId || null,
        data.dayOfWeek !== undefined ? data.dayOfWeek : null,
        data.startTime,
        data.endTime,
        multiplier,
        isActive,
      ]
    );
    return this.findById(res.rows[0].id) as Promise<TimeSlotRuleEntity>;
  }

  static async update(id: string, updates: Record<string, any>): Promise<TimeSlotRuleEntity | null> {
    const fieldMap: Record<string, string> = {
      categoryId: 'category_id',
      category_id: 'category_id',
      dayOfWeek: 'day_of_week',
      day_of_week: 'day_of_week',
      startTime: 'start_time',
      start_time: 'start_time',
      endTime: 'end_time',
      end_time: 'end_time',
      multiplier: 'multiplier',
      isActive: 'is_active',
      is_active: 'is_active',
    };

    let mult = updates.multiplier;
    if (mult === undefined && updates.extraCharge !== undefined) {
      if (updates.pricingType === 'PERCENTAGE_DISCOUNT' || updates.pricingType === 'FIXED_DISCOUNT') {
        mult = Math.max(0, 1.0 - (updates.extraCharge / 100));
      } else {
        mult = 1.0 + (updates.extraCharge / 100);
      }
      updates.multiplier = mult;
    }

    if (updates.status !== undefined && updates.isActive === undefined) {
      updates.isActive = updates.status === 'active';
    }

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
      `UPDATE catalog.time_slot_rules SET ${setClauses.join(', ')} WHERE id::text = $1 OR legacy_mongo_id = $1 RETURNING *`,
      values
    );
    return res.rows[0] ? this.findById(res.rows[0].id) : null;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM catalog.time_slot_rules WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async recordAudit(data: {
    ruleId: string;
    fieldChanged: string;
    oldValue?: any;
    newValue?: any;
    changedBy?: string;
  }): Promise<void> {
    const isUuid = data.changedBy && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(data.changedBy);
    const changedByUuid = isUuid ? data.changedBy : null;

    const oldValStr = typeof data.oldValue === 'object' ? JSON.stringify(data.oldValue) : String(data.oldValue ?? '');
    const newValStr = typeof data.newValue === 'object' ? JSON.stringify(data.newValue) : String(data.newValue ?? '');

    try {
      await this.pool.query(
        `INSERT INTO catalog.time_slot_pricing_audits (rule_id, field_changed, old_value, new_value, changed_by)
         VALUES (
           (SELECT id FROM catalog.time_slot_rules WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
           $2, $3, $4, $5
         )`,
        [
          data.ruleId,
          data.fieldChanged,
          oldValStr || null,
          newValStr || null,
          changedByUuid,
        ]
      );
    } catch (err: any) {
      console.warn('[TimeSlotRepository.recordAudit] Warning: audit insert failed:', err.message);
    }
  }
}
