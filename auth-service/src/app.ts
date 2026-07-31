import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import userRoutes from './routes/userRoutes';
import addressRoutes from './routes/addressRoutes';
import locationRoutes from './routes/locationRoutes';

const app = express();

app.use(helmet());

import { corsMiddleware } from './utils/corsConfig';

app.use(corsMiddleware);

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

app.use(express.json());
app.use(cookieParser());

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

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));

import contactRoutes from './routes/contactRoutes';

app.use('/api/users', userRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/contact', contactRoutes);

app.use(errorHandler);

export default app;
