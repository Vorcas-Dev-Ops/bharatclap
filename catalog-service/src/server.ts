import dotenv from 'dotenv';
import app from './app';
import { connectDB } from './config/db';

import mongoose from 'mongoose';

dotenv.config();

connectDB();

const PORT = process.env.PORT || 5002;

const server = app.listen(PORT, () => {
  console.log(`Catalog Service running on Port ${PORT}`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`[CATALOG-SERVICE] ⚠️ ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    console.log('[CATALOG-SERVICE] 🛑 HTTP server closed.');
    try {
      await mongoose.connection.close();
      console.log('[CATALOG-SERVICE] 🍃 MongoDB connection closed.');
      process.exit(0);
    } catch (err: any) {
      console.error('[CATALOG-SERVICE] ❌ Error closing MongoDB connection:', err.message);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[CATALOG-SERVICE] ⚠️ Force exit after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
