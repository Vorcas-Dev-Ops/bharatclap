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

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:5173', 'https://bharatclap.in', 'http://localhost:5000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    if (res.statusCode === 500) {
      console.error('[500 ERROR INTERCEPTOR]', body);
      return originalJson.call(this, { message: 'Internal Server Error' });
    }
    return originalJson.call(this, body);
  };
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  if (req.query && req.query.limit) {
    const parsedLimit = parseInt(req.query.limit as string, 10);
    if (!isNaN(parsedLimit)) {
      req.query.limit = String(Math.min(parsedLimit, 100));
    }
  }
  next();
});

import { errorHandler } from './middleware/errorHandler';

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

app.use(errorHandler);

export default app;
