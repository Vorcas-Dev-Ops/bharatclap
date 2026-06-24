// BullMQ bundles its own ioredis internally.
// Pass raw connection options (not a Redis instance) to avoid the
// dual-ioredis TypeScript structural type mismatch (TS2322).
export const redisConnectionOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null as null,
};

// ─── Queue with graceful Redis fallback ───────────────────────────────────────

let _queue: any = null;
let _queueReady = false;

const initQueue = async () => {
  try {
    const { Queue } = await import('bullmq');
    const { default: IORedis } = await import('ioredis');

    const testClient = new IORedis({ ...redisConnectionOptions, lazyConnect: true });
    await testClient.connect();
    const info = await testClient.info('server');
    await testClient.quit();

    const match = info.match(/redis_version:(\S+)/);
    if (match) {
      const [major] = match[1].split('.').map(Number);
      if (major < 5) {
        console.warn(`[BULL-QUEUE] Redis ${match[1]} detected — requires Redis ≥ 5. Notification queue disabled; notifications will log only.`);
        return;
      }
    }

    _queue = new Queue('notifications', { connection: redisConnectionOptions });
    _queue.on('error', (err: Error) => {
      console.warn('[BULL-QUEUE] Redis error:', err.message);
    });

    _queueReady = true;
    console.log('[BULL-QUEUE] Initialized successfully with BullMQ & Redis');
  } catch (err: any) {
    console.warn(`[BULL-QUEUE] Could not connect to Redis (${err.message}). Notification queue disabled; notifications will log only.`);
  }
};

initQueue().catch(() => {});

export const notificationQueue = {
  add: async (name: string, data: any, opts?: any) => {
    if (_queueReady && _queue) {
      return _queue.add(name, data, opts);
    }
    // Fallback: just log the notification
    console.log(`[NOTIFICATION FALLBACK] ${name}:`, JSON.stringify(data));
  }
};

export const isQueueReady = () => _queueReady;
export const getRawQueue = () => _queue;
