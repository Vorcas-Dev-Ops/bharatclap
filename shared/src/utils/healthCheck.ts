import mongoose from 'mongoose';
import { Request, Response } from 'express';

export interface ReadinessOptions {
  serviceName: string;
  redisClient?: any;
  isRedisCritical?: boolean;
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
    const dependencies: Record<string, 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN'> = {};
    let isHealthy = true;

    // 1. Mongo Check (Critical for domain services)
    try {
      const mongoState = mongoose.connection.readyState;
      if (mongoState === 1) {
        dependencies.mongodb = 'UP';
      } else {
        dependencies.mongodb = 'DOWN';
        isHealthy = false;
      }
    } catch {
      dependencies.mongodb = 'DOWN';
      isHealthy = false;
    }

    // 2. Redis Check (Service-specific classification)
    if (options.redisClient) {
      try {
        let redisUp = false;
        if (typeof options.redisClient.ping === 'function') {
          const pong = await options.redisClient.ping();
          redisUp = pong === 'PONG' || pong === 'OK';
        } else {
          redisUp = options.redisClient.status === 'ready' || options.redisClient.isOpen === true;
        }

        if (redisUp) {
          dependencies.redis = 'UP';
        } else {
          dependencies.redis = options.isRedisCritical ? 'DOWN' : 'DEGRADED';
          if (options.isRedisCritical) {
            isHealthy = false;
          }
        }
      } catch {
        dependencies.redis = options.isRedisCritical ? 'DOWN' : 'DEGRADED';
        if (options.isRedisCritical) {
          isHealthy = false;
        }
      }
    }

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json({
      status: isHealthy ? 'READY' : 'NOT_READY',
      service: options.serviceName,
      dependencies,
      timestamp: new Date().toISOString(),
    });
  };
};
