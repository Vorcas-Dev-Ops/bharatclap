import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import userRoutes from './routes/userRoutes';
import addressRoutes from './routes/addressRoutes';
import locationRoutes from './routes/locationRoutes';

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

app.use('/api/users', userRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/locations', locationRoutes);

app.use(errorHandler);

export default app;
