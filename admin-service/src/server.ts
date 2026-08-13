// ponytail: admin aggregation BFF entry point
import app from './app';
import { AppConfig } from './config/app.config';
import { CacheService } from './cache/cache.service';
import { CacheRefreshWorker } from './workers/cacheRefresh.worker';

const startServer = async () => {
  await CacheService.init();
  CacheRefreshWorker.startWorker();

  app.listen(AppConfig.PORT, () => {
    console.log(`[ADMIN-SERVICE] Enterprise Aggregation BFF listening on port ${AppConfig.PORT} in ${AppConfig.NODE_ENV} mode`);
  });
};

startServer();
