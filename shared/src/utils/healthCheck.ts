import mongoose from 'mongoose';
import { Request, Response } from 'express';

export interface ReadinessOptions {
  serviceName: string;
  redisClient?: any;
  downstreamUrls?: Record<string, string>;
}

export const createLivenessHandler = (serviceName: string) => {
  return (req: Request, res: Response): void => {
    res.status(200).json({
      status: 'UP',
      service: serviceName,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  };
};

export const createReadinessHandler = (options: ReadinessOptions) => {
  return async (req: Request, res: Response): Promise<void> => {
    const checks: Record<string, 'UP' | 'DOWN' | 'UNKNOWN'> = {};
    let isHealthy = true;

    // 1. Mongo Check
    try {
      const mongoState = mongoose.connection.readyState;
      if (mongoState === 1) {
        checks.mongodb = 'UP';
      } else {
        checks.mongodb = 'DOWN';
        isHealthy = false;
      }
    } catch {
      checks.mongodb = 'DOWN';
      isHealthy = false;
    }

    // 2. Redis Check (if supplied)
    if (options.redisClient) {
      try {
        if (typeof options.redisClient.ping === 'function') {
          const pong = await options.redisClient.ping();
          checks.redis = pong === 'PONG' || pong === 'OK' ? 'UP' : 'DOWN';
        } else {
          checks.redis = options.redisClient.status === 'ready' || options.redisClient.isOpen ? 'UP' : 'DOWN';
        }
      } catch {
        checks.redis = 'DOWN';
        // Redis failure might be non-critical depending on mode, but flag it
      }
    }

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json({
      status: isHealthy ? 'READY' : 'NOT_READY',
      service: options.serviceName,
      checks,
      timestamp: new Date().toISOString(),
    });
  };
};
