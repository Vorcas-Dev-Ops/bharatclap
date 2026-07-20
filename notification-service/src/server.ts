import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";
import "./workers/notificationWorker"; // Start the background worker


import mongoose from 'mongoose';
import { getWorker } from './workers/notificationWorker';
import { getRawQueue } from './config/queue';

dotenv.config();

connectDB();

const PORT = Number(process.env.PORT) || 5006;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Notification Service running on ${PORT}`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`[NOTIFICATION-SERVICE] ⚠️ ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    console.log('[NOTIFICATION-SERVICE] 🛑 HTTP server closed.');
    try {
      const queue = getRawQueue();
      const worker = getWorker();
      if (queue) {
        await queue.close();
        console.log('[NOTIFICATION-SERVICE] Queue closed.');
      }
      if (worker) {
        await worker.close();
        console.log('[NOTIFICATION-SERVICE] Worker closed.');
      }
      await mongoose.connection.close();
      console.log('[NOTIFICATION-SERVICE] 🍃 MongoDB connection closed.');
      process.exit(0);
    } catch (err: any) {
      console.error('[NOTIFICATION-SERVICE] ❌ Error during shutdown:', err.message);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[NOTIFICATION-SERVICE] ⚠️ Force exit after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

