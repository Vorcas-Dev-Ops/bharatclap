import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Single source of truth for internal service key validation.
 * Fails fast if INTERNAL_SERVICE_KEY is missing from environment.
 */
export function getInternalServiceKey(): string {
  const key = process.env.INTERNAL_SERVICE_KEY;
  if (!key || key.trim() === '') {
    throw new Error('INTERNAL_SERVICE_KEY must be configured in environment variables');
  }
  return key;
}

/**
 * Middleware to protect internal service-to-service endpoints.
 * Requires x-internal-service-key header matching process.env.INTERNAL_SERVICE_KEY.
 * Uses constant-time equality check to prevent timing leaks.
 */
export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  let expectedKey: string;
  try {
    expectedKey = getInternalServiceKey();
  } catch (err: any) {
    console.error('[INTERNAL-AUTH CRITICAL]', err.message);
    res.status(500).json({ success: false, message: 'Server configuration error: internal service key not configured' });
    return;
  }

  const providedKey = req.headers['x-internal-service-key'];
  if (!providedKey || typeof providedKey !== 'string') {
    res.status(401).json({ success: false, message: 'Forbidden: Missing x-internal-service-key header' });
    return;
  }

  const bufProvided = Buffer.from(providedKey, 'utf8');
  const bufExpected = Buffer.from(expectedKey, 'utf8');

  if (bufProvided.length !== bufExpected.length || !crypto.timingSafeEqual(bufProvided, bufExpected)) {
    res.status(401).json({ success: false, message: 'Invalid internal service credential' });
    return;
  }

  next();
};
