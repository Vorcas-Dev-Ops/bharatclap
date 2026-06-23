import { Queue } from 'bullmq';

// BullMQ bundles its own ioredis internally.
// Pass raw connection options (not a Redis instance) to avoid the
// dual-ioredis TypeScript structural type mismatch (TS2322).
export const redisConnectionOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null as null,
};

// Initialize the BullMQ Queue — it will manage its own Redis connection
export const notificationQueue = new Queue('notifications', {
  connection: redisConnectionOptions,
});

notificationQueue.on('error', (err: Error) => {
  console.warn('[BULL-QUEUE] Redis connection error. Ensure Redis is running for background notifications.', err.message);
});

console.log('[BULL-QUEUE] Initialized successfully with BullMQ & Redis');
