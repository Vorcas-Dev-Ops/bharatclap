import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";
import mongoose from 'mongoose';
import { setupLifecycle } from "./utils/lifecycle";

import { reconcilePendingPaymentsWorker } from "./controllers/paymentController";

import { startPaymentEventOutboxPoller } from "./services/paymentEventOutboxPoller";
import { eventBus } from "@bharatclap/shared";

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let paymentEventOutboxTimer: NodeJS.Timeout | null = null;

connectDB().then(async () => {
  // Initialize Redis EventBus for Payment Service
  try {
    const { default: IORedis } = await import('ioredis');
    const redisClient = new IORedis(REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false });
    eventBus.init(redisClient);
    paymentEventOutboxTimer = startPaymentEventOutboxPoller();
    console.log('[PAYMENT-SERVICE] ✅ EventBus and PaymentEventOutboxPoller initialized');
  } catch (err: any) {
    console.error('[PAYMENT-SERVICE] Failed to initialize EventBus:', err.message);
  }

  // Start background reconciliation worker every 60 seconds
  setInterval(() => {
    reconcilePendingPaymentsWorker().catch((err) =>
      console.error('[RECONCILIATION WORKER ERROR]', err.message)
    );
  }, 60000);
});

const PORT = Number(process.env.PORT) || 5005;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[PAYMENT-SERVICE] 🚀 Payment Service listening on Port ${PORT}`);
});

setupLifecycle({
  serviceName: 'PAYMENT-SERVICE',
  port: PORT,
  server,
  mongoose,
  queues: [{ close: () => eventBus.shutdown() }],
  intervals: (paymentEventOutboxTimer ? [paymentEventOutboxTimer] : []) as unknown as NodeJS.Timeout[],
});

