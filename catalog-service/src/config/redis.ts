import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    console.warn(`[REDIS-RETRY] Connection lost. Attempting reconnect #${times} in ${delay}ms...`);
    return delay;
  }
});

redis.on('connect', () => {
  console.log('🚀 Redis Connected successfully on Port 6379');
});

redis.on('error', (err) => {
  console.error('❌ Redis Connection Error:', err.message);
});

// Premium Caching helper methods
export const getCache = async (key: string): Promise<string | null> => {
  try {
    return await redis.get(key);
  } catch (error) {
    console.error(`[REDIS-GET-ERR] Key ${key}:`, error);
    return null;
  }
};

export const setCache = async (key: string, value: any, ttlSeconds: number = 3600): Promise<void> => {
  try {
    const serialized = JSON.stringify(value);
    await redis.set(key, serialized, 'EX', ttlSeconds);
  } catch (error) {
    console.error(`[REDIS-SET-ERR] Key ${key}:`, error);
  }
};

export const deleteCache = async (pattern: string): Promise<void> => {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[REDIS-INVALIDATE] Cleared cache keys: ${keys.join(', ')}`);
    }
  } catch (error) {
    console.error(`[REDIS-DEL-ERR] Pattern ${pattern}:`, error);
  }
};

export default redis;
