import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redis = new Redis(redisUrl, {
  enableOfflineQueue: false,
  connectTimeout: 2000,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 2) return null;
    return Math.min(times * 200, 1000);
  }
});

redis.on('connect', () => {
  console.log('🚀 Redis Connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

export const getCache = async (key: string): Promise<string | null> => {
  try {
    return await redis.get(key);
  } catch (error) {
    console.error(`Redis get error for key ${key}:`, error);
    return null;
  }
};

export const setCache = async (key: string, value: any, ttlSeconds: number = 3600): Promise<void> => {
  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await redis.set(key, stringValue, 'EX', ttlSeconds);
  } catch (error) {
    console.error(`Redis set error for key ${key}:`, error);
  }
};

export const deleteCache = async (pattern: string): Promise<void> => {
  let cursor = '0';
  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (error) {
    console.error(`Redis delete pattern error for ${pattern}:`, error);
  }
};

export default redis;
