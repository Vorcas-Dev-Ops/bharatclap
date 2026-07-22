import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";
import "./workers/notificationWorker";
import mongoose from 'mongoose';
import { getWorker } from './workers/notificationWorker';
import { getRawQueue } from './config/queue';
import { setupLifecycle } from "./utils/lifecycle";

dotenv.config();
connectDB();

const PORT = Number(process.env.PORT) || 5006;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[NOTIFICATION-SERVICE] 🚀 Notification Service listening on Port ${PORT}`);
});

setupLifecycle({
  serviceName: 'NOTIFICATION-SERVICE',
  port: PORT,
  server,
  mongoose,
  queues: [getRawQueue(), getWorker()],
});
