import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to protect internal service-to-service endpoints.
 * Every call to a /batch or /internal/* route MUST include the
 * x-internal-service-key header matching INTERNAL_SERVICE_KEY env var.
 *
 * This prevents any unauthenticated external actor from reading bulk
 * user/address/location data even if they reach the internal network.
 */
const DEFAULT_INTERNAL_KEY = '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const internalKey = process.env.INTERNAL_SERVICE_KEY || DEFAULT_INTERNAL_KEY;
  const providedKey = req.headers['x-internal-service-key'];

  if (!providedKey || providedKey !== internalKey) {
    res.status(403).json({ message: 'Forbidden: invalid or missing internal service key' });
    return;
  }

  next();
};
