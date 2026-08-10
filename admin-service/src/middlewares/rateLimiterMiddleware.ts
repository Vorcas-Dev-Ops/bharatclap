import { Request, Response, NextFunction } from 'express';

const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const createRateLimiter = (maxRequests: number = 60, windowMs: number = 60000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || '127.0.0.1';
    const key = `${req.path}:${ip}`;
    const now = Date.now();

    const record = requestCounts.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count += 1;
    }

    requestCounts.set(key, record);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));

    if (record.count > maxRequests) {
      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later',
        errorCode: 'TOO_MANY_REQUESTS',
        correlationId: (req as any).correlationId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};

export const RateLimiters = {
  reports: createRateLimiter(10, 60000),      // 10 requests per minute
  search: createRateLimiter(100, 60000),      // 100 requests per minute
  settings: createRateLimiter(20, 60000),     // 20 requests per minute
  general: createRateLimiter(120, 60000),     // 120 requests per minute
};
