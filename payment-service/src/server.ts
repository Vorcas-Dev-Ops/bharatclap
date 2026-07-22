import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";
import mongoose from 'mongoose';
import { setupLifecycle } from "./utils/lifecycle";

connectDB();

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
