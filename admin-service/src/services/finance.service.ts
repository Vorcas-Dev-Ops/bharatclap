import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cacheKeys';
import { CacheTTL } from '../cache/cacheTTL';

export class FinanceService {
  static async getFinanceMetrics() {
    const cacheKey = CacheKeys.financeMetrics();
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const dto = {
      revenueToday: 482450,
      platformCommission: 96490,
      gstCollected: 86841,
      tdsDeducted: 4824,
      tcsDeducted: 4824,
      pendingSettlements: 68200,
      failedPayments: 12400,
      refundQueue: 4800,
      walletLiabilities: 245100,
    };

    await CacheService.set(cacheKey, dto, CacheTTL.FINANCE_DASHBOARD);
    return dto;
  }
}
