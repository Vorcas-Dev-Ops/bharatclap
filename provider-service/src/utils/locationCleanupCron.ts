import { getDb } from '../config/db';
import { removeLiveLocationFromRedis, emitProviderOffline } from '../services/socketService';
import { LOCATION_CONFIG } from '../config/locationConfig';

export const startLocationCleanupCron = () => {
  const runCleanup = async () => {
    try {
      const timeoutMs = LOCATION_CONFIG.LOCATION_OFFLINE_TIMEOUT_SECONDS * 1000;
      const cutoffTime = new Date(Date.now() - timeoutMs);
      const pool = getDb();

      // Find stale online providers
      const staleRes = await pool.query(
        `SELECT id FROM provider.providers
         WHERE is_online = TRUE
           AND last_active_at < $1`,
        [cutoffTime]
      );

      if (staleRes.rows.length > 0) {
        const staleProviderIds = staleRes.rows.map(r => r.id);
        const now = new Date();

        console.log(`[LOCATION-CRON] Found ${staleProviderIds.length} stale providers. Transitioning offline.`);

        // 1. Mark Provider offline
        await pool.query(
          `UPDATE provider.providers
           SET is_online = FALSE, availability_status = 'offline', updated_at = NOW()
           WHERE id = ANY($1)`,
          [staleProviderIds]
        );

        // 2. Remove from Redis live cache & notify admin map in real-time
        for (const providerId of staleProviderIds) {
          const idStr = String(providerId);
          await removeLiveLocationFromRedis(idStr).catch(() => {});
          emitProviderOffline(idStr, now, 'heartbeat_timeout');
        }
      }
    } catch (error: any) {
      console.error('[LOCATION-CRON] Error cleaning up stale provider locations:', error.message);
    }
  };

  // Run cleanup check every 60 seconds
  setInterval(runCleanup, 60000);
};
