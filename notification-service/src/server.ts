import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";
import "./workers/notificationWorker";
import mongoose from 'mongoose';
import { getWorker } from './workers/notificationWorker';
import { getRawQueue } from './config/queue';
import { setupLifecycle } from "./utils/lifecycle";

import { startScheduledBookingCron } from "./workers/scheduledBookingCron";
import { startEventConsumer } from "./workers/eventConsumer";
import { redisConnectionOptions } from "./config/queue";

dotenv.config();
connectDB();
startScheduledBookingCron();

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
  mongoose,
  queues: [getRawQueue(), getWorker()],
});
