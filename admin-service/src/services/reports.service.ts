import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cacheKeys';
import { CacheTTL } from '../cache/cacheTTL';

export class ReportsService {
  static async getPrecomputedReport(type: string = 'revenue') {
    const cacheKey = CacheKeys.reports(type);
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const dto = {
      reportType: type,
      generatedAt: new Date().toISOString(),
      summary: {
        totalVolume: 1428,
        totalValue: 482450,
        averageBasket: 337.85,
        taxCollected: 86841,
      },
      rows: [
        { id: '1', date: '2026-08-07', category: 'AC Service & Repair', bookings: 420, revenue: 184500 },
        { id: '2', date: '2026-08-07', category: 'Home Deep Cleaning', bookings: 310, revenue: 145000 },
        { id: '3', date: '2026-08-07', category: 'Electrical Works', bookings: 280, revenue: 89000 },
      ]
    };

    await CacheService.set(cacheKey, dto, CacheTTL.REPORTS);
    return dto;
  }
}
