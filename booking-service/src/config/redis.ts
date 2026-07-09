import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

redis.on('connect', () => {
  console.log('Redis Connected successfully');
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
  try {
    let cursor = '0';
    do {
      const reply = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = reply[0];
      const keys = reply[1];
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (error) {
    console.error(`Redis delete pattern error for ${pattern}:`, error);
  }
};

export default redis;
