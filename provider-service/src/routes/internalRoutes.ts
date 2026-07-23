import { Router, Request, Response } from 'express';
import { emitToUser, emitTrackingEnded } from '../services/socketService';
import { Provider } from '../models/Provider';

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

export default router;
