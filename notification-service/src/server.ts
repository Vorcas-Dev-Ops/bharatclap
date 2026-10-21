import dotenv from "dotenv";
dotenv.config();
// Reload trigger: mounted routes fixed
import app from "./app";
import { connectDB, getDb } from "./config/db";
import "./workers/notificationWorker";
import { getWorker } from './workers/notificationWorker';
import { getRawQueue } from './config/queue';
import { setupLifecycle } from "./utils/lifecycle";

import { startScheduledBookingCron } from "./workers/scheduledBookingCron";
import { startScheduledCampaignCron } from "./workers/scheduledCampaignCron";
import { startEventConsumer } from "./workers/eventConsumer";
import { redisConnectionOptions } from "./config/queue";

let cronTimer: NodeJS.Timeout | null = null;

const start = async () => {
  try {
    await connectDB();
  } catch (err: any) {
    console.error('[NOTIFICATION-SERVICE] ❌ Database connect error (non-fatal):', err.message);
  }

  cronTimer = startScheduledBookingCron();
  startScheduledCampaignCron();

  const PORT = Number(process.env.PORT) || 5006;

  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[NOTIFICATION-SERVICE] 🚀 Notification Service listening on Port ${PORT}`);

    // Start Redis Streams event consumer after server is ready
    try {
      const { default: IORedis } = await import('ioredis');
      const eventRedis = new IORedis({
        ...redisConnectionOptions,
        maxRetriesPerRequest: null,
        lazyConnect: false,
      });
      await startEventConsumer(eventRedis);
    } catch (err: any) {
      console.warn('[NOTIFICATION-SERVICE] Event consumer failed to start (non-fatal):', err.message);
    }
  });

  setupLifecycle({
    serviceName: 'NOTIFICATION-SERVICE',
    port: PORT,
    server,
    pgPool: getDb(),
    queues: [getRawQueue(), getWorker()],
    intervals: cronTimer ? [cronTimer] : [],
  });
};

start().catch((err) => {
  console.error('[NOTIFICATION-SERVICE] Fatal startup error:', err);
});

