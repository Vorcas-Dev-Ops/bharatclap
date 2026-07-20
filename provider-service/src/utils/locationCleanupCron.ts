import { ProviderLocation } from '../models/ProviderLocation';
import { Provider } from '../models/Provider';

export const startLocationCleanupCron = () => {
  const runCleanup = async () => {
    try {
      const ninetySecondsAgo = new Date(Date.now() - 90 * 1000);
      
      // Find all stale online locations
      const staleLocations = await ProviderLocation.find({
        isOnline: true,
        lastUpdatedAt: { $lt: ninetySecondsAgo }
      }).select('provider_id').lean();

      if (staleLocations.length > 0) {
        const staleProviderIds = staleLocations.map(loc => loc.provider_id);

        console.log(`[LOCATION-CRON] Found ${staleProviderIds.length} stale providers. Marking offline.`);

        // 1. Update ProviderLocation entries
        await ProviderLocation.updateMany(
          { provider_id: { $in: staleProviderIds } },
          { $set: { isOnline: false, currentStatus: 'offline' } }
        );

        // 2. Update Provider core records
        await Provider.updateMany(
          { _id: { $in: staleProviderIds } },
          { $set: { isOnline: false, availability_status: 'offline' } }
        );
      }
    } catch (error: any) {
      console.error('[LOCATION-CRON] Error cleaning up stale provider locations:', error.message);
    }
  };

  // Run every 60 seconds
  setInterval(runCleanup, 60000);
};
