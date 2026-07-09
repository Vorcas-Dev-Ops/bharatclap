import http from "http";
import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";
import { initSocket } from "./services/socketService";

import mongoose from "mongoose";

dotenv.config();

connectDB();

const PORT = process.env.PORT || 5003;

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`[PROVIDER-SERVICE] ⚠️ ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    console.log('[PROVIDER-SERVICE] 🛑 HTTP server closed.');
    try {
      await mongoose.connection.close();
      console.log('[PROVIDER-SERVICE] 🍃 MongoDB connection closed.');
      process.exit(0);
    } catch (err: any) {
      console.error('[PROVIDER-SERVICE] ❌ Error closing MongoDB connection:', err.message);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[PROVIDER-SERVICE] ⚠️ Force exit after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
