import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";
import mongoose from 'mongoose';
import { setupLifecycle } from "./utils/lifecycle";

import { reconcilePendingPaymentsWorker } from "./controllers/paymentController";

connectDB().then(() => {
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
});

