import { Pool } from 'pg';
import { getDb } from '../config/db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (val: unknown): val is string => typeof val === 'string' && UUID_REGEX.test(val);

export class OutboxRepository {
  private static get pool(): Pool {
    return getDb();
  }

  // --- EVENT OUTBOX ---
  static async insertEventOutbox(event: {
    eventId: string;
    eventType: string;
    payload: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO booking.event_outbox (event_id, event_type, payload, status)
       VALUES ($1, $2, $3, 'PENDING')
       ON CONFLICT (event_id) DO NOTHING`,
      [event.eventId, event.eventType, event.payload]
    );
  }

  static async fetchPendingEvents(limit: number = 50): Promise<any[]> {
    const res = await this.pool.query(
      `UPDATE booking.event_outbox
       SET status = 'PROCESSING',
           attempts = attempts + 1,
           last_attempted_at = NOW(),
           lease_expires_at = NOW() + INTERVAL '1 minute'
       WHERE id IN (
         SELECT id FROM booking.event_outbox
         WHERE status = 'PENDING'
            OR (status = 'PROCESSING' AND lease_expires_at < NOW())
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       ) RETURNING *`,
      [limit]
    );
    return res.rows;
  }

  static async markEventPublished(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE booking.event_outbox
       SET status = 'PUBLISHED', published_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  static async markEventFailed(id: string, errorMessage: string): Promise<void> {
    await this.pool.query(
      `UPDATE booking.event_outbox
       SET status = CASE WHEN attempts >= 5 THEN 'DLQ'::character varying ELSE 'PENDING'::character varying END,
           error_message = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [id, errorMessage]
    );
  }

  // --- SETTLEMENT OUTBOX ---
  static async insertSettlementOutbox(data: {
    eventId: string;
    bookingId: string;
    providerId: string;
    amount: number;
    currency?: string;
  }): Promise<void> {
    const bookingSubquery = isUuid(data.bookingId)
      ? `(SELECT id FROM booking.bookings WHERE id = $2 LIMIT 1)`
      : `(SELECT id FROM booking.bookings WHERE legacy_mongo_id = $2 LIMIT 1)`;

    await this.pool.query(
      `INSERT INTO booking.settlement_outbox (
         event_id, booking_id, provider_id, amount, currency, status
       ) VALUES (
         $1,
         ${bookingSubquery},
         $3::uuid,
         $4, $5, 'PENDING'
       ) ON CONFLICT (event_id) DO NOTHING`,
      [data.eventId, data.bookingId, data.providerId, data.amount, data.currency || 'INR']
    );
  }

  static async fetchPendingSettlements(limit: number = 50): Promise<any[]> {
    const res = await this.pool.query(
      `UPDATE booking.settlement_outbox
       SET status = 'PROCESSING', attempts = attempts + 1, updated_at = NOW()
       WHERE id IN (
         SELECT id FROM booking.settlement_outbox
         WHERE status = 'PENDING'
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       ) RETURNING *`,
      [limit]
    );
    return res.rows;
  }

  static async markSettlementPublished(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE booking.settlement_outbox
       SET status = 'PUBLISHED', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  static async markSettlementFailed(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE booking.settlement_outbox
       SET status = CASE WHEN attempts >= 5 THEN 'DLQ'::character varying ELSE 'PENDING'::character varying END,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  // --- LEAD REFUND OUTBOX ---
  static async insertLeadRefundOutbox(data: {
    eventId: string;
    bookingId: string;
    providerId: string;
    amount: number;
    reason?: string;
  }): Promise<void> {
    const bookingSubquery = isUuid(data.bookingId)
      ? `(SELECT id FROM booking.bookings WHERE id = $2 LIMIT 1)`
      : `(SELECT id FROM booking.bookings WHERE legacy_mongo_id = $2 LIMIT 1)`;
    const userSubquery = isUuid(data.providerId)
      ? `(SELECT id FROM auth.users WHERE id = $3 LIMIT 1)`
      : `(SELECT id FROM auth.users WHERE legacy_mongo_id = $3 LIMIT 1)`;

    await this.pool.query(
      `INSERT INTO booking.lead_refund_outbox (
         event_id, booking_id, provider_id, amount, reason, status
       ) VALUES (
         $1,
         ${bookingSubquery},
         ${userSubquery},
         $4, $5, 'PENDING'
       ) ON CONFLICT (event_id) DO NOTHING`,
      [data.eventId, data.bookingId, data.providerId, data.amount, data.reason || null]
    );
  }

  static async fetchPendingLeadRefunds(limit: number = 50): Promise<any[]> {
    const res = await this.pool.query(
      `UPDATE booking.lead_refund_outbox
       SET status = 'PROCESSING', attempts = attempts + 1, updated_at = NOW()
       WHERE id IN (
         SELECT id FROM booking.lead_refund_outbox
         WHERE status = 'PENDING'
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       ) RETURNING *`,
      [limit]
    );
    return res.rows;
  }

  static async markLeadRefundPublished(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE booking.lead_refund_outbox
       SET status = 'PUBLISHED', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  // --- RATING OUTBOX ---
  static async insertRatingOutbox(data: {
    bookingId: string;
    providerId: string;
    rating: number;
    review?: string;
  }): Promise<void> {
    const bookingSubquery = isUuid(data.bookingId)
      ? `(SELECT id FROM booking.bookings WHERE id = $1 LIMIT 1)`
      : `(SELECT id FROM booking.bookings WHERE legacy_mongo_id = $1 LIMIT 1)`;
    const userSubquery = isUuid(data.providerId)
      ? `(SELECT id FROM auth.users WHERE id = $2 LIMIT 1)`
      : `(SELECT id FROM auth.users WHERE legacy_mongo_id = $2 LIMIT 1)`;

    await this.pool.query(
      `INSERT INTO booking.rating_outbox (booking_id, provider_id, rating, review, status)
       VALUES (
         ${bookingSubquery},
         ${userSubquery},
         $3, $4, 'PENDING'
       )`,
      [data.bookingId, data.providerId, data.rating, data.review || null]
    );
  }

  static async fetchPendingRatings(limit: number = 50): Promise<any[]> {
    const res = await this.pool.query(
      `UPDATE booking.rating_outbox
       SET status = 'PROCESSING', attempts = attempts + 1, updated_at = NOW()
       WHERE id IN (
         SELECT id FROM booking.rating_outbox
         WHERE status = 'PENDING'
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       ) RETURNING *`,
      [limit]
    );
    return res.rows;
  }

  static async markRatingPublished(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE booking.rating_outbox
       SET status = 'PUBLISHED', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }
}
