import redis from '../config/redis';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Pub/Sub clients for distributed event-driven cache invalidation
const pubClient = new Redis(redisUrl, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
const subClient = new Redis(redisUrl, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });

const CHANNEL = 'catalog:cache_events';

// Internal Metrics Tracker
export const cacheMetrics = {
  hits: 0,
  misses: 0,
  invalidations: 0,
  totalRebuildTimeMs: 0,
  rebuildCount: 0,
};

// Listen for distributed cache invalidation events across instances
subClient.subscribe(CHANNEL, (err) => {
  if (err) {
    console.error('[CACHE PUB/SUB] Failed to subscribe to cache events channel:', err.message);
  } else {
    console.log(`[CACHE PUB/SUB] Subscribed to ${CHANNEL} for distributed cache synchronization`);
  }
});

subClient.on('message', (channel, message) => {
  if (channel === CHANNEL) {
    try {
      const event = JSON.parse(message);
      console.log(`[CACHE EVENT RECEIVED] ${event.eventType} -> Target: ${event.target} | Origin: ${event.originInstance}`);
      cacheMetrics.invalidations++;
    } catch {}
  }
});

export const getCache = async (key: string): Promise<string | null> => {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
};

export const setCache = async (key: string, data: any, ttlSeconds: number = 3600): Promise<void> => {
  try {
    await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  } catch {}
};

/**
 * Get current global catalog cache version
 */
export const getCatalogVersion = async (): Promise<string> => {
  try {
    const ver = await redis.get('catalog:version');
    if (!ver) {
      await redis.set('catalog:version', '1');
      return '1';
    }
    return ver;
  } catch {
    return '1';
  }
};

/**
 * Increment global catalog version (instant invalidation across all keys)
 */
export const incrementCatalogVersion = async (): Promise<number> => {
  try {
    const newVer = await redis.incr('catalog:version');
    cacheMetrics.invalidations++;
    await publishCacheEvent('VERSION_INCREMENTED', `v${newVer}`);
    return newVer;
  } catch (err: any) {
    console.error('[CACHE] Version increment error:', err?.message);
    return 1;
  }
};

/**
 * Acquire Redis Mutex Lock to prevent Cache Stampede (Thundering Herd)
 */
export const acquireRebuildLock = async (lockKey: string, ttlMs: number = 5000): Promise<boolean> => {
  try {
    const result = await redis.set(`catalog:lock:${lockKey}`, '1', 'PX', ttlMs, 'NX');
    return result === 'OK';
  } catch {
    return true; // Fallback to allowing rebuild if lock fails
  }
};

/**
 * Release Redis Mutex Lock
 */
export const releaseRebuildLock = async (lockKey: string): Promise<void> => {
  try {
    await redis.del(`catalog:lock:${lockKey}`);
  } catch {}
};

/**
 * Publish distributed cache invalidation event
 */
export const publishCacheEvent = async (eventType: string, target: string, details: any = {}): Promise<void> => {
  try {
    const event = {
      eventType,
      target,
      details,
      timestamp: new Date().toISOString(),
      originInstance: process.env.HOSTNAME || `instance_${process.pid}`,
    };
    await pubClient.publish(CHANNEL, JSON.stringify(event));
  } catch (err: any) {
    console.error('[CACHE PUB/SUB] Failed to publish cache event:', err.message);
  }
};

/**
 * Record Cache Hit Metric
 */
export const recordCacheHit = (key: string): void => {
  cacheMetrics.hits++;
};

/**
 * Record Cache Miss & Rebuild Time Metric
 */
export const recordCacheMiss = (key: string, durationMs: number): void => {
  cacheMetrics.misses++;
  cacheMetrics.rebuildCount++;
  cacheMetrics.totalRebuildTimeMs += durationMs;
};

/**
 * Selective Invalidation for a Specific Service
 */
export const invalidateServiceCacheSelective = async (serviceId: string, categoryId?: string): Promise<void> => {
  try {
    await incrementCatalogVersion();
    const keysToDelete = [
      `catalog:booking-overview:${serviceId}`,
      `catalog:services:id:${serviceId}`,
    ];
    await redis.del(...keysToDelete);

    if (categoryId) {
      await deletePatternKeys(`catalog:services:cat:${categoryId}:*`);
    }
  } catch (err: any) {
    console.error(`[CACHE] Selective service invalidation error for ${serviceId}:`, err.message);
  }
};

/**
 * Selective Invalidation for a Specific SubService
 */
export const invalidateSubServiceCacheSelective = async (subServiceId: string, serviceId?: string): Promise<void> => {
  try {
    await incrementCatalogVersion();
    const keysToDelete = [`catalog:subservices:id:${subServiceId}`];
    if (serviceId) {
      keysToDelete.push(`catalog:booking-overview:${serviceId}`);
    }
    await redis.del(...keysToDelete);
  } catch (err: any) {
    console.error(`[CACHE] Selective subservice invalidation error for ${subServiceId}:`, err.message);
  }
};

/**
 * Selective Invalidation for a Category
 */
export const invalidateCategoryCacheSelective = async (categoryId?: string): Promise<void> => {
  try {
    await incrementCatalogVersion();
    if (categoryId) {
      await deletePatternKeys(`catalog:services:cat:${categoryId}:*`);
    }
    await deletePatternKeys(`catalog:categories:*`);
  } catch (err: any) {
    console.error(`[CACHE] Category invalidation error for ${categoryId}:`, err.message);
  }
};

/**
 * Helper to scan and delete keys matching pattern
 */
const deletePatternKeys = async (pattern: string): Promise<void> => {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
};

/**
 * Get Prometheus Formatted Metrics
 */
export const getPrometheusMetrics = (): string => {
  const total = cacheMetrics.hits + cacheMetrics.misses;
  const avgMs = cacheMetrics.rebuildCount > 0 
    ? (cacheMetrics.totalRebuildTimeMs / cacheMetrics.rebuildCount).toFixed(2) 
    : '0';

  return `# HELP catalog_cache_hits_total Total catalog cache hits
# TYPE catalog_cache_hits_total counter
catalog_cache_hits_total ${cacheMetrics.hits}

# HELP catalog_cache_misses_total Total catalog cache misses
# TYPE catalog_cache_misses_total counter
catalog_cache_misses_total ${cacheMetrics.misses}

# HELP catalog_cache_invalidations_total Total catalog cache invalidation events
# TYPE catalog_cache_invalidations_total counter
catalog_cache_invalidations_total ${cacheMetrics.invalidations}

# HELP catalog_cache_rebuild_latency_ms Average cache rebuild latency in ms
# TYPE catalog_cache_rebuild_latency_ms gauge
catalog_cache_rebuild_latency_ms ${avgMs}
`;
};

/**
 * Get JSON Cache Performance Summary
 */
export const getCacheMetricsSummary = () => {
  const total = cacheMetrics.hits + cacheMetrics.misses;
  const hitRatio = total > 0 ? ((cacheMetrics.hits / total) * 100).toFixed(2) + '%' : '0%';
  const avgRebuildMs = cacheMetrics.rebuildCount > 0 
    ? (cacheMetrics.totalRebuildTimeMs / cacheMetrics.rebuildCount).toFixed(2) + 'ms' 
    : '0ms';

  return {
    hits: cacheMetrics.hits,
    misses: cacheMetrics.misses,
    hitRatio,
    invalidations: cacheMetrics.invalidations,
    avgRebuildMs,
  };
};
