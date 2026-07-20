import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDB } from './config/db';
import mongoose from 'mongoose';

connectDB();

const PORT = Number(process.env.PORT) || 5001;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth Service running on Port ${PORT}`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`[AUTH-SERVICE] ⚠️ ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    console.log('[AUTH-SERVICE] 🛑 HTTP server closed.');
    try {
      await mongoose.connection.close();
      console.log('[AUTH-SERVICE] 🍃 MongoDB connection closed.');
      process.exit(0);
    } catch (err: any) {
      console.error('[AUTH-SERVICE] ❌ Error closing MongoDB connection:', err.message);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[AUTH-SERVICE] ⚠️ Force exit after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
