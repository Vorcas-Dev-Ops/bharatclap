import dotenv from 'dotenv';
import app from './app';
import { connectDB } from './config/db';
import mongoose from 'mongoose';
import { setupLifecycle } from './utils/lifecycle';

dotenv.config();
connectDB();

const PORT = Number(process.env.PORT) || 5002;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[CATALOG-SERVICE] 🚀 Catalog Service listening on Port ${PORT}`);
});

setupLifecycle({
  serviceName: 'CATALOG-SERVICE',
  port: PORT,
  server,
  mongoose,
});
