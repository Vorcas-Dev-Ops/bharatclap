import { Router, Request, Response } from 'express';
import { emitToUser, emitTrackingEnded } from '../services/socketService';
import { getDb } from '../config/db';

const router = Router();

/**
 * Internal service-to-service endpoint.
 * Allows other microservices to push Socket.io events to a specific user room.
 *
 * POST /api/internal/emit
 * Headers: x-internal-service-key: <INTERNAL_SERVICE_KEY>
 * Body: { userId: string, event: string, data: object }
 */
router.post('/emit', (req: Request, res: Response): void => {
  const internalKey = process.env.INTERNAL_SERVICE_KEY;

  if (!internalKey) {
    res.status(503).json({ message: 'Service misconfigured: internal key not set' });
    return;
  }

  const providedKey = req.headers['x-internal-service-key'];
  if (!providedKey || providedKey !== internalKey) {
    res.status(403).json({ message: 'Forbidden: invalid or missing internal service key' });
    return;
  }

  const { userId, event, data } = req.body;

  if (!userId || !event) {
    res.status(400).json({ message: 'userId and event are required' });
    return;
  }

  emitToUser(userId.toString(), event, data || {});
  res.json({ success: true });
});

/**
 * Internal service-to-service endpoint.
 * Updates provider availability and busy status from booking lifecycle events.
 *
 * POST /api/internal/provider/status
 * Headers: x-internal-service-key: <INTERNAL_SERVICE_KEY>
 * Body: { providerId: string, isBusy?: boolean, availability_status?: string }
 */
router.post('/provider/status', async (req: Request, res: Response): Promise<void> => {
  const internalKey = process.env.INTERNAL_SERVICE_KEY;
  if (!internalKey || req.headers['x-internal-service-key'] !== internalKey) {
    res.status(403).json({ message: 'Forbidden: invalid or missing internal service key' });
    return;
  }

  const { providerId, isBusy, availability_status } = req.body;
  if (!providerId) {
    res.status(400).json({ message: 'providerId is required' });
    return;
  }

  try {
    const db = getDb();
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [providerId];

    if (typeof isBusy === 'boolean') {
      values.push(isBusy);
      setClauses.push(`is_busy = $${values.length}`);
    }
    if (availability_status) {
      values.push(availability_status);
      setClauses.push(`availability_status = $${values.length}`);
    }

    await db.query(
      `UPDATE provider.providers
       SET ${setClauses.join(', ')}
       WHERE (id::text = $1 OR legacy_mongo_id = $1)`,
      values
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Internal service-to-service endpoint.
 * Cleans up booking tracking room and emits tracking_ended event when a job is completed or cancelled.
 *
 * POST /api/internal/booking/cleanup-tracking
 * Headers: x-internal-service-key: <INTERNAL_SERVICE_KEY>
 * Body: { booking_id: string }
 */
router.post('/booking/cleanup-tracking', (req: Request, res: Response): void => {
  const internalKey = process.env.INTERNAL_SERVICE_KEY;
  if (!internalKey || req.headers['x-internal-service-key'] !== internalKey) {
    res.status(403).json({ message: 'Forbidden: invalid or missing internal service key' });
    return;
  }

  const { booking_id } = req.body;
  if (booking_id) {
    emitTrackingEnded(booking_id.toString());
  }
  res.json({ success: true });
});

/**
 * Internal service-to-service endpoint.
 * Expires all pending job requests for a batch of booking IDs.
 *
 * POST /api/internal/job-requests/expire-batch
 * Headers: x-internal-service-key: <INTERNAL_SERVICE_KEY>
 * Body: { bookingIds: string[] }
 */
router.post('/job-requests/expire-batch', async (req: Request, res: Response): Promise<void> => {
  const internalKey = process.env.INTERNAL_SERVICE_KEY;
  if (!internalKey || req.headers['x-internal-service-key'] !== internalKey) {
    res.status(403).json({ message: 'Forbidden: invalid or missing internal service key' });
    return;
  }

  const { bookingIds } = req.body;
  if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
    res.json({ expired: 0 });
    return;
  }

  try {
    const db = getDb();
    const result = await db.query(
      `UPDATE provider.job_requests
       SET status = 'expired', updated_at = NOW()
       WHERE booking_id = ANY($1) AND status = 'pending'`,
      [bookingIds]
    );

    res.json({ expired: result.rowCount || 0, providersReleased: 0 });
  } catch (err: any) {
    console.error('[INTERNAL] expire-batch error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * Internal service-to-service endpoint for stage-based lead refund on booking cancellation.
 *
 * POST /api/providers/internal/lead-refund
 */
router.post('/lead-refund', async (req: Request, res: Response): Promise<void> => {
  try {
    const internalKey = process.env.INTERNAL_SERVICE_KEY;
    const providedKey = req.headers['x-internal-service-key'];

    if (internalKey && providedKey !== internalKey) {
      res.status(403).json({ message: 'Forbidden: invalid or missing internal service key' });
      return;
    }

    const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body.idempotency_key;
    const correlationId = (req.headers['x-correlation-id'] as string) || req.body.correlation_id;

    const { provider_id, booking_id, booking_stage, cancelled_by } = req.body;

    if (!provider_id || !booking_id || !booking_stage) {
      res.status(400).json({ message: 'provider_id, booking_id, and booking_stage are required' });
      return;
    }

    const { refundLead } = await import('../services/leadService');

    const result = await refundLead(
      provider_id,
      String(booking_id),
      booking_stage,
      cancelled_by || 'customer',
      correlationId,
      idempotencyKey
    );

    res.json({ success: true, result });
  } catch (error: any) {
    console.error('[INTERNAL LEAD REFUND ERROR]', error.message);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Internal service-to-service endpoint.
 * Atomically processes a rating for a provider. Idempotent via review_id dedup.
 *
 * POST /api/internal/provider/submit-rating
 * Headers: x-internal-service-key: <INTERNAL_SERVICE_KEY>
 * Body: { providerId: string, rating: number, reviewId: string }
 */
router.post('/provider/submit-rating', async (req: Request, res: Response): Promise<void> => {
  const internalKey = process.env.INTERNAL_SERVICE_KEY;
  if (!internalKey || req.headers['x-internal-service-key'] !== internalKey) {
    res.status(403).json({ message: 'Forbidden: invalid or missing internal service key' });
    return;
  }

  const { providerId, rating, reviewId } = req.body;
  if (!providerId || !reviewId || typeof rating !== 'number' || rating < 1 || rating > 5) {
    res.status(400).json({ message: 'providerId, reviewId, and rating (1-5) are required' });
    return;
  }

  try {
    const db = getDb();

    // Idempotency: try to insert the rating event. If already exists, return success.
    try {
      await db.query(
        `INSERT INTO provider.rating_events (
           provider_id, booking_id, rating, processed
         ) VALUES (
           (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
           (SELECT id FROM booking.bookings WHERE id::text = $2 OR legacy_mongo_id = $2 OR booking_id = $2 LIMIT 1),
           $3, TRUE
         )`,
        [providerId, reviewId, rating]
      );
    } catch (dupErr: any) {
      if (dupErr.code === '23505') {
        res.json({ success: true, duplicate: true });
        return;
      }
    }

    // Atomic update of provider accumulators and average rating
    const result = await db.query(
      `UPDATE provider.providers
       SET rating_sum = rating_sum + $2,
           rating_count = rating_count + 1,
           total_rated_jobs = total_rated_jobs + 1,
           average_rating = CASE 
             WHEN (rating_count + 1) >= 5 THEN ROUND(((rating_sum + $2) / (rating_count + 1))::numeric, 2)
             ELSE 4.50
           END,
           status = CASE 
             WHEN (rating_count + 1) >= 5 AND (((rating_sum + $2) / (rating_count + 1)) < 4.0) THEN 'blocked'
             ELSE status
           END,
           updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1)
       RETURNING total_rated_jobs, average_rating, status`,
      [providerId, rating]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      success: true,
      totalJobs: Number(row.total_rated_jobs),
      average_rating: Number(row.average_rating),
      status: row.status,
    });
  } catch (err: any) {
    console.error('[INTERNAL SUBMIT-RATING ERROR]', err.message);
    res.status(500).json({ message: err.message });
  }
});

export default router;
