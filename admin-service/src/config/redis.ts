import { createClient } from 'redis';
import { ENV } from './env';

const redisClient = createClient({ url: ENV.REDIS_URL });

redisClient.on('error', (err) => console.warn('[ADMIN-REDIS] Redis client warning:', err?.message));

export const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log('[ADMIN-REDIS] Connected to Redis successfully');
    }
  } catch (err: any) {
    console.warn('[ADMIN-REDIS] Redis connection failed, in-memory fallback will be used:', err?.message);
  }
};

const memoryStore = new Map<string, { value: string; expiresAt: number }>();

export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    if (redisClient.isOpen) {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    }
  } catch (err) {}

  const mem = memoryStore.get(key);
  if (mem && mem.expiresAt > Date.now()) {
    return JSON.parse(mem.value);
  }
  memoryStore.delete(key);
  return null;
};

export const setCache = async (key: string, data: any, ttlSeconds: number): Promise<void> => {
  const serialized = JSON.stringify(data);
  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(key, ttlSeconds, serialized);
      return;
    }
  } catch (err) {}

  memoryStore.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });
};
