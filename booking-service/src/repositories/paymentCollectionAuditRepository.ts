import { Pool } from 'pg';
import { getDb } from '../config/db';

export class PaymentCollectionAuditRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async log(data: {
    bookingId: string;
    action: string;
    actor?: string;
    oldStatus?: string;
    newStatus?: string;
    details?: any;
    amount?: number;
    timestamp?: Date;
  }): Promise<void> {
    try {
      const detailsObj = data.details || {};
      if (data.amount !== undefined) detailsObj.amount = data.amount;
      if (data.actor) detailsObj.actor = data.actor;

      await this.pool.query(
        `INSERT INTO booking.payment_collection_audits (
           booking_id, action, old_status, new_status, performed_by, details, created_at
         ) VALUES (
           COALESCE((SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1 LIMIT 1), $1::uuid),
           $2, $3, $4, $5, $6, $7
         )`,
        [
          data.bookingId,
          data.action,
          data.oldStatus || null,
          data.newStatus || null,
          data.actor || 'system',
          JSON.stringify(detailsObj),
          data.timestamp || new Date()
        ]
      );
    } catch (err: any) {
      console.error('[PAYMENT AUDIT LOG ERROR]', err.message);
    }
  }

  static async findByBookingId(bookingId: string): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT * FROM booking.payment_collection_audits
       WHERE booking_id::text = $1
          OR booking_id = (SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1 LIMIT 1)
       ORDER BY created_at ASC`,
      [bookingId]
    );
    return res.rows;
  }
}
