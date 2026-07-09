import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";

import mongoose from 'mongoose';

dotenv.config();

connectDB();

const PORT = process.env.PORT || 5005;

const server = app.listen(PORT, () => {
  console.log(`Payment Service running on ${PORT}`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`[PAYMENT-SERVICE] ⚠️ ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    console.log('[PAYMENT-SERVICE] 🛑 HTTP server closed.');
    try {
      await mongoose.connection.close();
      console.log('[PAYMENT-SERVICE] 🍃 MongoDB connection closed.');
      process.exit(0);
    } catch (err: any) {
      console.error('[PAYMENT-SERVICE] ❌ Error closing MongoDB connection:', err.message);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[PAYMENT-SERVICE] ⚠️ Force exit after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

