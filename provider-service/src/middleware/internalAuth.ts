import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to protect internal service-to-service endpoints.
 * Every call to a /batch or /internal/* route MUST include the
 * x-internal-service-key header matching INTERNAL_SERVICE_KEY env var.
 */
export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const internalKey = process.env.INTERNAL_SERVICE_KEY;
  if (!internalKey) {
    res.status(500).json({ message: 'Server misconfigured: INTERNAL_SERVICE_KEY is missing' });
    return;
  }
  const providedKey = req.headers['x-internal-service-key'];

  if (!providedKey || providedKey !== internalKey) {
    res.status(403).json({ message: 'Forbidden: invalid or missing internal service key' });
    return;
  }

  next();
};
