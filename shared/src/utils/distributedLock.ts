/**
 * P0-8: Redis distributed lock with safe release.
 *
 * Protocol:
 *   Acquire: SET key owner_token NX PX ttl_ms
 *   Release: Lua: if GET(key) == owner_token then DEL(key) end
 *   Renew:   Lua: if GET(key) == owner_token then PEXPIRE(key, ttl) end
 *
 * The owner_token prevents Worker A from deleting Worker B's lock
 * after A's lease expires and B acquires.
 */
import crypto from 'crypto';

// ponytail: Lua scripts are atomic in Redis. No race between GET and DEL.
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

const RENEW_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("PEXPIRE", KEYS[1], ARGV[2])
else
  return 0
end
`;

export interface DistributedLock {
  key: string;
  token: string;
  release: () => Promise<boolean>;
  renew: (ttlMs?: number) => Promise<boolean>;
}

export interface LockOptions {
  /** Lock key (e.g. "lock:wallet:provider_123") */
  key: string;
  /** TTL in milliseconds. Default: 10000 (10s) */
  ttlMs?: number;
  /** Max retry attempts. Default: 0 (no retry) */
  retries?: number;
  /** Delay between retries in ms. Default: 100 */
  retryDelayMs?: number;
}

/**
 * Acquires a Redis distributed lock.
 * Returns a DistributedLock object with release() and renew() methods,
 * or null if the lock could not be acquired.
 *
 * Usage:
 *   const lock = await acquireLock(redisClient, { key: 'lock:wallet:abc' });
 *   if (!lock) throw new Error('CONCURRENCY CONFLICT');
 *   try {
 *     // ... critical section ...
 *   } finally {
 *     await lock.release();
 *   }
 */
export const acquireLock = async (
  redis: any, // ioredis client
  opts: LockOptions
): Promise<DistributedLock | null> => {
  const { key, ttlMs = 10_000, retries = 0, retryDelayMs = 100 } = opts;
  const token = crypto.randomBytes(16).toString('hex');

  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await redis.set(key, token, 'PX', ttlMs, 'NX');
    if (result === 'OK') {
      return {
        key,
        token,
        release: async () => {
          const r = await redis.eval(RELEASE_SCRIPT, 1, key, token);
          return r === 1;
        },
        renew: async (newTtlMs?: number) => {
          const r = await redis.eval(RENEW_SCRIPT, 1, key, token, String(newTtlMs || ttlMs));
          return r === 1;
        },
      };
    }
    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }

  return null;
};

/**
 * Convenience: run a function under a distributed lock.
 * Automatically releases the lock on completion or error.
 */
export const withLock = async <T>(
  redis: any,
  opts: LockOptions,
  fn: (lock: DistributedLock) => Promise<T>
): Promise<T> => {
  const lock = await acquireLock(redis, opts);
  if (!lock) {
    throw new Error(`CONCURRENCY CONFLICT: Failed to acquire lock "${opts.key}"`);
  }
  try {
    return await fn(lock);
  } finally {
    await lock.release();
  }
};
