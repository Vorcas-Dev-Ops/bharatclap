import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import categoryRoutes from './routes/categoryRoutes';
import serviceRoutes from './routes/serviceRoutes';
import subServiceRoutes from './routes/subServiceRoutes';
import bannerRoutes from './routes/bannerRoutes';
import offerRoutes from './routes/offerRoutes';
import couponRoutes from './routes/couponRoutes';
import membershipRoutes from './routes/membershipRoutes';
import commissionRoutes from './routes/commissionRoutes';
import settingsRoutes from './routes/settingsRoutes';
import timeSlotRoutes from './routes/timeSlotRoutes';
import accessoryRoutes from './routes/accessoryRoutes';
import batchRoutes from './routes/batchRoutes';

const app = express();

app.use(helmet());

const isDev = process.env.NODE_ENV !== 'production';
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:5173', 'https://bharatclap.in', 'http://localhost:5000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));

app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    if (res.statusCode === 500) {
      console.error('[500 ERROR INTERCEPTOR]', body);
      return originalJson.call(this, { message: isDev ? (body?.message || 'Internal Server Error') : 'Internal Server Error' });
    }
    return originalJson.call(this, body);
  };
  next();
});

import path from 'path';
import { UPLOADS_ROOT } from './utils/imageStorage';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(
  '/uploads',
  express.static(UPLOADS_ROOT, {
    maxAge: '30d',
    immutable: true,
  })
);

app.use((req, res, next) => {
  if (req.query && req.query.limit) {
    const parsedLimit = parseInt(req.query.limit as string, 10);
    if (!isNaN(parsedLimit)) {
      req.query.limit = String(Math.min(parsedLimit, 100));
    }
  }
  next();
});

import { getDb } from './config/db';
import { correlationMiddleware, globalErrorHandler, sendSuccess, sendError, ErrorCodes, logRoutes } from '@bharatclap/shared';

app.use(correlationMiddleware);

app.use('/api/batch', batchRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/sub-services', subServiceRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/timeslot-rules', timeSlotRoutes);
app.use('/api/accessories', accessoryRoutes);

import { createLivenessHandler, createReadinessHandler } from '@bharatclap/shared';

// Health, Readiness & Metrics Endpoints
app.get(['/health', '/health/live'], createLivenessHandler('catalog-service'));
app.get(['/ready', '/health/ready'], createReadinessHandler({ serviceName: 'catalog-service', isRedisCritical: false, pgPool: getDb() }));

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`# HELP catalog_uptime_seconds Uptime in seconds\n# TYPE catalog_uptime_seconds gauge\ncatalog_uptime_seconds ${process.uptime()}\n`);
});

app.use('/internal/logs', logRoutes);

app.use(globalErrorHandler);

export default app;
