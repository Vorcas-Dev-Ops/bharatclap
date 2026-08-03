import { Router, Request, Response } from 'express';
import { emitToUser, emitTrackingEnded } from '../services/socketService';
import { Provider } from '../models/Provider';
import { JobRequest } from '../models/JobRequest';
import { WalletTransaction } from '../models/WalletTransaction';
import mongoose from 'mongoose';

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
    const provider = await Provider.findById(providerId);
    if (provider) {
      if (typeof isBusy === 'boolean') provider.isBusy = isBusy;
      if (availability_status) provider.availability_status = availability_status as any;
      await provider.save();
    }
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
 * Releases wallet holds on providers. Called when bookings hit high demand timeout.
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
    // Expire all pending job requests for these bookings
    const result = await JobRequest.updateMany(
      { booking_id: { $in: bookingIds }, status: 'pending' },
      { $set: { status: 'expired' } }
    );

    // Release wallet holds for expired requests
    const expiredRequests = await JobRequest.find({
      booking_id: { $in: bookingIds },
      status: 'expired'
    }).lean();

    const providerIds = [...new Set(expiredRequests.map(r => String(r.provider_id)))];
    for (const providerId of providerIds) {
      const holdTxs = await WalletTransaction.find({
        provider_id: new mongoose.Types.ObjectId(providerId),
        type: 'hold',
        referenceId: { $in: bookingIds.map(String) }
      }).lean();

      for (const holdTx of holdTxs) {
        const alreadyReleased = await WalletTransaction.findOne({
          provider_id: holdTx.provider_id,
          type: 'release',
          referenceId: holdTx.referenceId
        });
        if (!alreadyReleased) {
          const provider = await Provider.findById(providerId);
          if (provider) {
            provider.reservedBalance = Math.max(0, provider.reservedBalance - holdTx.amount);
            await provider.save();
            await WalletTransaction.create({
              provider_id: provider._id,
              type: 'release',
              amount: holdTx.amount,
              balanceAfter: provider.walletBalance - provider.reservedBalance,
              referenceId: holdTx.referenceId,
              description: `Release hold: booking high demand timeout #${holdTx.referenceId}`,
              status: 'success'
            });
          }
        }
      }
    }

    res.json({ expired: result.modifiedCount, providersReleased: providerIds.length });
  } catch (err: any) {
    console.error('[INTERNAL] expire-batch error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * Internal service-to-service endpoint for stage-based lead refund on booking cancellation.
 *
 * POST /api/providers/internal/lead-refund
 * Headers:
 *   x-internal-service-key: <INTERNAL_SERVICE_KEY>
 *   x-idempotency-key: refund_<booking_id>
 *   x-correlation-id: <correlation_id>
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

export default router;

