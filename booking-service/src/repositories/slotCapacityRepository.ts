import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface SlotCapacityEntity {
  id: string;
  _id: string;
  provider_id: string;
  providerId: string;
  slot_date: string;
  slotDate: string;
  slot: string;
  booked_count: number;
  bookedCount: number;
  max_capacity: number;
  maxCapacity: number;
  created_at: Date;
  updated_at: Date;
}

export const mapSlotCapacityRow = (row: any): SlotCapacityEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const provIdStr = String(row.provider_id);
  const slotDateStr = typeof row.slot_date === 'string'
    ? row.slot_date
    : (row.slot_date instanceof Date ? row.slot_date.toISOString().split('T')[0] : String(row.slot_date));

  return {
    id: idStr,
    _id: idStr,
    provider_id: provIdStr,
    providerId: provIdStr,
    slot_date: slotDateStr,
    slotDate: slotDateStr,
    slot: row.slot,
    booked_count: Number(row.booked_count) || 0,
    bookedCount: Number(row.booked_count) || 0,
    max_capacity: Number(row.max_capacity) || 8,
    maxCapacity: Number(row.max_capacity) || 8,
    created_at: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
  };
};

export class SlotCapacityRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async getCapacity(providerId: string, slotDate: string, slot: string): Promise<SlotCapacityEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM booking.slot_capacities
       WHERE (provider_id::text = $1 OR legacy_mongo_id = $1)
         AND slot_date = $2::date
         AND slot = $3
       LIMIT 1`,
      [providerId, slotDate, slot]
    );
    return res.rows[0] ? mapSlotCapacityRow(res.rows[0]) : null;
  }

  static async findBySlot(providerId: string, slotDate: string | Date, slot: string): Promise<SlotCapacityEntity | null> {
    const dateStr = slotDate instanceof Date ? slotDate.toISOString().split('T')[0] : String(slotDate);
    return this.getCapacity(providerId, dateStr, slot);
  }

  static async checkAvailability(providerId: string, slotDate: string, slot: string): Promise<boolean> {
    const cap = await this.getCapacity(providerId, slotDate, slot);
    if (!cap) return true; // not booked yet
    return cap.booked_count < cap.max_capacity;
  }

  /**
   * Atomically increment booked_count using PostgreSQL UPSERT with check constraint guard.
   * Returns updated entity if successful, or null if capacity exceeded.
   */
  static async incrementCapacity(
    providerId: string,
    slotDate: string,
    slot: string,
    maxCapacity: number = 8
  ): Promise<SlotCapacityEntity | null> {
    try {
      const res = await this.pool.query(
        `INSERT INTO booking.slot_capacities (
           provider_id, slot_date, slot, booked_count, max_capacity
         ) VALUES (
           (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
           $2::date, $3, 1, $4
         )
         ON CONFLICT (provider_id, slot_date, slot)
         DO UPDATE SET
           booked_count = booking.slot_capacities.booked_count + 1,
           updated_at = NOW()
         WHERE booking.slot_capacities.booked_count < booking.slot_capacities.max_capacity
         RETURNING *`,
        [providerId, slotDate, slot, maxCapacity]
      );

      return res.rows[0] ? mapSlotCapacityRow(res.rows[0]) : null;
    } catch (err: any) {
      // 23514 is check_violation (e.g. booked_count <= max_capacity)
      if (err.code === '23514') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Atomically decrement booked_count, bounded at 0.
   */
  static async decrementCapacity(providerId: string, slotDate: string, slot: string): Promise<SlotCapacityEntity | null> {
    const res = await this.pool.query(
      `UPDATE booking.slot_capacities
       SET booked_count = GREATEST(0, booked_count - 1),
           updated_at = NOW()
       WHERE (provider_id::text = $1 OR legacy_mongo_id = $1)
         AND slot_date = $2::date
         AND slot = $3
       RETURNING *`,
      [providerId, slotDate, slot]
    );
    return res.rows[0] ? mapSlotCapacityRow(res.rows[0]) : null;
  }
}
