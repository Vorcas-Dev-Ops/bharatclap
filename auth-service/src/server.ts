import dotenv from 'dotenv';
import app from './app';
import { connectDB } from './config/db';
import mongoose from 'mongoose';
import { setupLifecycle } from './utils/lifecycle';

dotenv.config();
connectDB();

const PORT = Number(process.env.PORT) || 5001;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[AUTH-SERVICE] 🚀 Auth Service listening on Port ${PORT}`);
});

setupLifecycle({
  serviceName: 'AUTH-SERVICE',
  port: PORT,
  server,
  mongoose,
});
