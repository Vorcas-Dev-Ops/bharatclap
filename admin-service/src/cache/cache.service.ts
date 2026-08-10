import { createClient } from 'redis';
import { AppConfig } from '../config/app.config';

const redisClient = createClient({ url: AppConfig.REDIS_URL });
redisClient.on('error', (err) => console.warn('[ADMIN-REDIS] Redis Warning:', err?.message));

const memoryStore = new Map<string, { value: string; expiresAt: number }>();

export class CacheService {
  static async init() {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
        console.log('[ADMIN-REDIS] Cache service connected to Redis');
      }
    } catch (err: any) {
      console.warn('[ADMIN-REDIS] Redis connection failed, using in-memory store fallback');
    }
  }

  static async get<T>(key: string): Promise<T | null> {
    try {
      if (redisClient.isOpen) {
        const val = await redisClient.get(key);
        return val ? JSON.parse(val) : null;
      }
    } catch (err) {}

    const mem = memoryStore.get(key);
    if (mem && mem.expiresAt > Date.now()) {
      return JSON.parse(mem.value);
    }
    memoryStore.delete(key);
    return null;
  }

  static async set(key: string, data: any, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(data);
    try {
      if (redisClient.isOpen) {
        await redisClient.setEx(key, ttlSeconds, serialized);
        return;
      }
    } catch (err) {}

    memoryStore.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  static async delete(key: string): Promise<void> {
    try {
      if (redisClient.isOpen) {
        await redisClient.del(key);
      }
    } catch (err) {}
    memoryStore.delete(key);
  }
}
