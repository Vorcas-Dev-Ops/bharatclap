import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cacheKeys';
import { CacheTTL } from '../cache/cacheTTL';

export class DashboardService {
  static async getDashboardMetrics() {
    const cacheKey = CacheKeys.dashboardMetrics();
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const dto = {
      totalCustomers: 18420,
      totalProviders: 1240,
      onlineProviders: 412,
      activeBookings: 184,
      totalRevenueToday: 482450,
      walletLiabilities: 245100,
      pendingSettlements: 68200,
      pendingRefunds: 4800,
    };

    await CacheService.set(cacheKey, dto, CacheTTL.DASHBOARD_METRICS);
    return dto;
  }
}
