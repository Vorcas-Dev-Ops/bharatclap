import { DashboardService } from '../services/dashboard.service';
import { NocService } from '../services/noc.service';
import { FinanceService } from '../services/finance.service';
import { Logger } from '../logger/logger';

export class CacheRefreshWorker {
  static startWorker() {
    Logger.info('Starting background cache refresh worker interval');

    setInterval(async () => {
      try {
        await Promise.allSettled([
          DashboardService.getDashboardMetrics(),
          NocService.getNocTelemetry(),
          FinanceService.getFinanceMetrics(),
        ]);
        Logger.info('Background cache pre-fetch complete');
      } catch (err: any) {
        Logger.warn('Cache refresh worker cycle warning:', err?.message);
      }
    }, 15000); // Every 15 seconds
  }
}
