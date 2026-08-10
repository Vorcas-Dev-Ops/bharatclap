import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../cache/cache.service';
import { Logger } from '../logger/logger';

export const idempotencyGuard = (ttlSeconds: number = 86400) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.headers['x-idempotency-key'] as string;
    if (!key) {
      return next(); // Proceed normally if no idempotency key is passed
    }

    const cacheKey = `idempotency:${key}`;
    const cachedResponse = await CacheService.get<any>(cacheKey);

    if (cachedResponse) {
      Logger.info(`[IDEMPOTENCY] Returned cached response for key: ${key}`);
      res.status(200).json(cachedResponse);
      return;
    }

    // Intercept JSON send to cache original response
    const originalJson = res.json.bind(res);
    res.json = (body: any): Response => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        CacheService.set(cacheKey, body, ttlSeconds).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
};
