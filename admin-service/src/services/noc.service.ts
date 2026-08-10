import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cacheKeys';
import { CacheTTL } from '../cache/cacheTTL';

export class NocService {
  static async getNocTelemetry() {
    const cacheKey = CacheKeys.nocTelemetry();
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const dto = {
      timestamp: new Date().toISOString(),
      services: [
        { id: '1', name: 'API Gateway', status: 'healthy', uptime: '99.99%', version: 'v2.4.0', cpu: 14, ram: 42, responseTime: 18 },
        { id: '2', name: 'Auth Service', status: 'healthy', uptime: '99.98%', version: 'v2.4.0', cpu: 22, ram: 56, responseTime: 24 },
        { id: '3', name: 'Catalog Service', status: 'healthy', uptime: '99.99%', version: 'v2.4.0', cpu: 18, ram: 38, responseTime: 32 },
        { id: '4', name: 'Provider Service', status: 'healthy', uptime: '99.95%', version: 'v2.4.0', cpu: 35, ram: 61, responseTime: 45 },
        { id: '5', name: 'Booking Service', status: 'healthy', uptime: '99.97%', version: 'v2.4.0', cpu: 48, ram: 68, responseTime: 52 },
        { id: '6', name: 'Payment Service', status: 'healthy', uptime: '99.99%', version: 'v2.4.0', cpu: 28, ram: 49, responseTime: 65 },
        { id: '7', name: 'Notification Service', status: 'healthy', uptime: '99.82%', version: 'v2.4.0', cpu: 42, ram: 54, responseTime: 85 },
        { id: '8', name: 'Refund Service', status: 'healthy', uptime: '99.96%', version: 'v2.4.0', cpu: 15, ram: 33, responseTime: 40 },
        { id: '9', name: 'MongoDB Primary', status: 'healthy', uptime: '99.99%', version: 'MongoDB 7.0', cpu: 41, ram: 72, responseTime: 8 },
        { id: '10', name: 'Redis Cache & Queue', status: 'healthy', uptime: '99.99%', version: 'Redis 7.2', cpu: 19, ram: 45, responseTime: 2 },
      ],
      kpis: {
        bookingsToday: 1428,
        activeJobs: 184,
        jobsInProgress: 112,
        completedToday: 1132,
        revenueToday: 482450,
        pendingSettlements: 68200,
        pendingRefunds: 4800,
        walletLiabilities: 245100,
        onlineProviders: 412,
        availableProviders: 298,
        customersOnline: 1890,
      },
      deployment: {
        version: 'v2.4.0-ENTERPRISE',
        commit: 'a8f19c3',
        buildNumber: '#BUILD-4182',
        environment: 'Production (AWS ap-south-1)',
        rollbackTarget: 'v2.3.9'
      }
    };

    await CacheService.set(cacheKey, dto, CacheTTL.NOC_TELEMETRY);
    return dto;
  }
}
