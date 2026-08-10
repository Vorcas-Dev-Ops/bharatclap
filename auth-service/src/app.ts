import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { correlationMiddleware, globalErrorHandler, sendSuccess, sendError, ErrorCodes } from '@bharatclap/shared';
import userRoutes from './routes/userRoutes';
import addressRoutes from './routes/addressRoutes';
import locationRoutes from './routes/locationRoutes';
import contactRoutes from './routes/contactRoutes';

const app = express();

app.use(helmet());
app.use(correlationMiddleware);

import { corsMiddleware } from './utils/corsConfig';

app.use(corsMiddleware);

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

import { createLivenessHandler, createReadinessHandler } from '@bharatclap/shared';

// Health, Readiness & Metrics Endpoints
app.get(['/health', '/health/live'], createLivenessHandler('auth-service'));
app.get(['/ready', '/health/ready'], createReadinessHandler({ serviceName: 'auth-service', isRedisCritical: false }));

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`# HELP auth_uptime_seconds Uptime in seconds\n# TYPE auth_uptime_seconds gauge\nauth_uptime_seconds ${process.uptime()}\n`);
});

app.use('/api/users', userRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/contact', contactRoutes);

app.use(globalErrorHandler);

export default app;
