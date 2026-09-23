import { Request, Response } from 'express';
import { ReviewRepository } from '../repositories/reviewRepository';
import { AuthRequest } from '../middleware/authMiddleware';
import { getDb } from '../config/db';
import { withTransaction } from '@bharatclap/shared';
import {
  getUsersBatch,
  getCatalogBatch,
  getProviderByUserId,
  sendAdminNotification,
  sendProviderNotification,
  getProvidersBatch
} from '../utils/internalApi';

const populateReviews = async (reviews: any[]) => {
  if (!reviews || reviews.length === 0) return [];

  const userIds    = [...new Set(reviews.map(r => r.user_id?.toString()).filter(Boolean))];
  const serviceIds = [...new Set(reviews.map(r => r.service_id?.toString()).filter(Boolean))];

  const [users, catalogData] = await Promise.all([
    getUsersBatch(userIds),
    getCatalogBatch([], serviceIds, [], [])
  ]);

  const userMap    = new Map(users.map((u: any) => [String(u._id), u]));
  const serviceMap = new Map(catalogData.services.map((s: any) => [String(s._id), s]));

  return reviews.map(r => ({
    ...r,
    user_id:    userMap.get(String(r.user_id))    || r.user_id,
    service_id: serviceMap.get(String(r.service_id)) || r.service_id
  }));
};

// @desc    Get reviews for a provider
// @route   GET /api/reviews/provider/:providerId
// @access  Public
export const getProviderReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const db = getDb();
    const offset = (page - 1) * limit;
    const resRev = await db.query(
      `SELECT * FROM booking.reviews
       WHERE provider_id::text = $1 OR provider_id = (SELECT id FROM auth.users WHERE legacy_mongo_id = $1 LIMIT 1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.providerId, limit, offset]
    );

    const populated = await populateReviews(resRev.rows);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a review
// @route   POST /api/reviews
// @access  Private
export const createReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { booking_id, provider_id, service_id, subservice_id, rating, comment } = req.body;
    const db = getDb();

    const exists = await ReviewRepository.findByBookingId(String(booking_id));
    if (exists) {
      res.status(400).json({ message: 'You have already reviewed this booking' });
      return;
    }

    const review = await withTransaction(db, async (client) => {
      const insRes = await client.query(
        `INSERT INTO booking.reviews (
           booking_id, user_id, provider_id, service_id, subservice_id, rating, comment
         ) VALUES (
           COALESCE((SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1 LIMIT 1), $1::uuid),
           COALESCE((SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1), $2::uuid),
           COALESCE((SELECT id FROM auth.users WHERE id::text = $3 OR legacy_mongo_id = $3 LIMIT 1), $3::uuid),
           COALESCE((SELECT id FROM catalog.services WHERE id::text = $4 OR legacy_mongo_id = $4 LIMIT 1), $4::uuid),
           COALESCE((SELECT id FROM catalog.subservices WHERE id::text = $5 OR legacy_mongo_id = $5 LIMIT 1), $5::uuid),
           $6, $7
         ) RETURNING *`,
        [booking_id, req.user?._id, provider_id, service_id, subservice_id, rating, comment || null]
      );

      const revRow = insRes.rows[0];

      await client.query(
        `INSERT INTO booking.rating_outbox (event_id, booking_id, provider_id, rating, review, status)
         VALUES ($1, $2, (SELECT id FROM auth.users WHERE id::text = $3 OR legacy_mongo_id = $3 LIMIT 1), $4, $5, 'PENDING')
         ON CONFLICT (event_id) DO NOTHING`,
        [`rating_${revRow.id}`, revRow.booking_id, provider_id, rating, comment || null]
      );

      await client.query(
        `UPDATE booking.bookings SET is_reviewed = TRUE WHERE id = $1`,
        [revRow.booking_id]
      );

      return revRow;
    });

    await sendAdminNotification(
      'New Service Review',
      `A new ${rating}-star review was submitted for a service booking.`,
      'status_update',
      { review_id: review.id, booking_id, provider_id }
    );

    try {
      const providers = await getProvidersBatch([provider_id.toString()]);
      const provider = providers.length > 0 ? providers[0] : null;
      if (provider && provider.user_id) {
        sendProviderNotification(
          provider.user_id.toString(),
          'New Review Received',
          `You have received a new ${rating}-star review for your service.`,
          'status_update',
          { review_id: review.id, booking_id }
        ).catch(() => {});
      }
    } catch (notifErr: any) {
      console.error('[NOTIFICATION] Failed to send review notification to provider:', notifErr.message);
    }

    res.status(201).json(review);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private/Admin
export const deleteReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const revRes = await db.query(
      `SELECT * FROM booking.reviews WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [req.params.id]
    );

    const review = revRes.rows[0];
    if (!review) {
      res.status(404).json({ message: 'Review not found' });
      return;
    }

    if (String(review.user_id) !== String(req.user?._id) && req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    await db.query(`DELETE FROM booking.reviews WHERE id = $1`, [review.id]);
    res.json({ message: 'Review deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get my reviews (Provider)
// @route   GET /api/reviews/my
// @access  Private/Provider
export const getMyReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await getProviderByUserId(req.user!._id);
    if (!provider) {
      res.json([]);
      return;
    }
    const providerId = (provider as any)._id;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const db = getDb();
    const revRes = await db.query(
      `SELECT * FROM booking.reviews
       WHERE provider_id::text = $1 OR provider_id = (SELECT id FROM auth.users WHERE legacy_mongo_id = $1 LIMIT 1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [String(providerId), limit, offset]
    );

    const populated = await populateReviews(revRes.rows);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
