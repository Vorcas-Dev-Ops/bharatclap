import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface ReviewEntity {
  id: string;
  _id: string;
  booking_id: string;
  bookingId: string;
  user_id: string;
  userId: string;
  provider_id: string;
  providerId: string;
  service_id: string;
  serviceId: string;
  subservice_id: string;
  subserviceId: string;
  rating: number;
  comment?: string;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export const mapReviewRow = (row: any): ReviewEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);

  return {
    id: idStr,
    _id: idStr,
    booking_id: String(row.booking_id),
    bookingId: String(row.booking_id),
    user_id: String(row.user_id),
    userId: String(row.user_id),
    provider_id: String(row.provider_id),
    providerId: String(row.provider_id),
    service_id: String(row.service_id),
    serviceId: String(row.service_id),
    subservice_id: String(row.subservice_id),
    subserviceId: String(row.subservice_id),
    rating: Number(row.rating),
    comment: row.comment || undefined,
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
};

export class ReviewRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findByBookingId(bookingId: string): Promise<ReviewEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM booking.reviews
       WHERE booking_id::text = $1 OR legacy_mongo_id = $1
       LIMIT 1`,
      [bookingId]
    );
    return res.rows[0] ? mapReviewRow(res.rows[0]) : null;
  }

  static async findByProviderId(providerId: string, limit: number = 50): Promise<ReviewEntity[]> {
    const res = await this.pool.query(
      `SELECT * FROM booking.reviews
       WHERE provider_id::text = $1 OR provider_id = (SELECT id FROM auth.users WHERE legacy_mongo_id = $1 LIMIT 1)
       ORDER BY created_at DESC
       LIMIT $2`,
      [providerId, limit]
    );
    return res.rows.map(mapReviewRow);
  }

  static async create(data: {
    bookingId: string;
    userId: string;
    providerId: string;
    serviceId: string;
    subserviceId: string;
    rating: number;
    comment?: string;
  }): Promise<ReviewEntity> {
    const res = await this.pool.query(
      `INSERT INTO booking.reviews (
         booking_id, user_id, provider_id, service_id, subservice_id, rating, comment
       ) VALUES (
         (SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
         (SELECT id FROM auth.users WHERE id::text = $3 OR legacy_mongo_id = $3 LIMIT 1),
         (SELECT id FROM catalog.services WHERE id::text = $4 OR legacy_mongo_id = $4 LIMIT 1),
         (SELECT id FROM catalog.subservices WHERE id::text = $5 OR legacy_mongo_id = $5 LIMIT 1),
         $6, $7
       ) RETURNING *`,
      [
        data.bookingId,
        data.userId,
        data.providerId,
        data.serviceId,
        data.subserviceId,
        data.rating,
        data.comment || null,
      ]
    );

    // Update booking review flag
    await this.pool.query(
      `UPDATE booking.bookings SET is_reviewed = TRUE WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [data.bookingId]
    );

    return mapReviewRow(res.rows[0]);
  }

  static async getProviderRatingSummary(providerId: string): Promise<{ avgRating: number; totalReviews: number }> {
    const res = await this.pool.query(
      `SELECT COALESCE(AVG(rating), 0)::numeric(3,2) AS avg_rating,
              COUNT(*)::int AS total_reviews
       FROM booking.reviews
       WHERE provider_id::text = $1
          OR provider_id = (SELECT id FROM auth.users WHERE legacy_mongo_id = $1 LIMIT 1)`,
      [providerId]
    );
    return {
      avgRating: parseFloat(res.rows[0]?.avg_rating || 0),
      totalReviews: Number(res.rows[0]?.total_reviews || 0),
    };
  }
}
