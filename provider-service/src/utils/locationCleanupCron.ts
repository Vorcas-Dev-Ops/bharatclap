import { ProviderLocation } from '../models/ProviderLocation';
import { Provider } from '../models/Provider';
import { removeLiveLocationFromRedis, emitProviderOffline } from '../services/socketService';
import { LOCATION_CONFIG } from '../config/locationConfig';

export const startLocationCleanupCron = () => {
  const runCleanup = async () => {
    try {
      const timeoutMs = LOCATION_CONFIG.LOCATION_OFFLINE_TIMEOUT_SECONDS * 1000;
      const cutoffTime = new Date(Date.now() - timeoutMs);

      // Find stale online locations older than timeout threshold
      const staleLocations = await ProviderLocation.find({
        isOnline: true,
        lastUpdatedAt: { $lt: cutoffTime },
      }).select('provider_id').lean();

      if (staleLocations.length > 0) {
        const staleProviderIds = staleLocations.map((loc) => loc.provider_id);
        const now = new Date();

        console.log(`[LOCATION-CRON] Found ${staleProviderIds.length} stale providers (> ${LOCATION_CONFIG.LOCATION_OFFLINE_TIMEOUT_SECONDS}s). Transitioning offline.`);

        // 1. Mark ProviderLocation offline
        await ProviderLocation.updateMany(
          { provider_id: { $in: staleProviderIds } },
          { $set: { isOnline: false, currentStatus: 'offline' } }
        );

        // 2. Mark Provider offline with heartbeat_timeout reason
        await Provider.updateMany(
          { _id: { $in: staleProviderIds } },
          {
            $set: {
              isOnline: false,
              availability_status: 'offline',
              lastSeenAt: now,
              offlineReason: 'heartbeat_timeout',
            },
          }
        );

        // 3. Remove from Redis live cache & notify admin map in real-time
        for (const providerId of staleProviderIds) {
          const idStr = providerId.toString();
          await removeLiveLocationFromRedis(idStr);
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
