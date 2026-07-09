import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";

import mongoose from 'mongoose';
import { closeQueue } from './services/bookingDispatchService';

dotenv.config();

connectDB();

const PORT = process.env.PORT || 5004;

const server = app.listen(PORT, () => {
  console.log(`Booking Service running on ${PORT}`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`[BOOKING-SERVICE] ⚠️ ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    console.log('[BOOKING-SERVICE] 🛑 HTTP server closed.');
    try {
      await closeQueue();
      await mongoose.connection.close();
      console.log('[BOOKING-SERVICE] 🍃 MongoDB connection closed.');
      process.exit(0);
    } catch (err: any) {
      console.error('[BOOKING-SERVICE] ❌ Error during shutdown:', err.message);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[BOOKING-SERVICE] ⚠️ Force exit after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
