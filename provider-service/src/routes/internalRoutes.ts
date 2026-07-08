import { Router, Request, Response } from 'express';
import { emitToUser } from '../services/socketService';

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

export default router;
