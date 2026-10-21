import { cleanOrphanedImages } from './utils/imageStorage';
import dotenv from 'dotenv';
import app from './app';
import { connectDB, getDb } from './config/db';
import { setupLifecycle } from './utils/lifecycle';

dotenv.config();
connectDB().catch((err) => {
  console.error('[CATALOG-SERVICE] Initial DB connection failed:', err.message);
});

const PORT = Number(process.env.PORT) || 5002;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[CATALOG-SERVICE] 🚀 Catalog Service listening on Port ${PORT}`);
});

setupLifecycle({
  serviceName: 'CATALOG-SERVICE',
  port: PORT,
  server,
  pgPool: getDb(),
});

// 24-hour background orphan image cleanup job (grace period: 24h)
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  cleanOrphanedImages(24).catch((err) => {
    console.error('[ORPHAN-CLEANUP] Background schedule error:', err?.message);
  });
}, CLEANUP_INTERVAL_MS);
