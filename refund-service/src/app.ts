import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import refundRoutes from './routes/refundRoutes';

import mongoose from 'mongoose';
import { correlationMiddleware, globalErrorHandler, sendSuccess, sendError, ErrorCodes } from '@bharatclap/shared';

const app = express();

app.use(helmet());
app.use(correlationMiddleware);
import { corsMiddleware } from './utils/corsConfig';

app.use(corsMiddleware);
app.use(express.json());

// Health, Readiness & Metrics Endpoints
app.get('/health', (_req, res) => {
  sendSuccess(res, 200, 'Refund service is active', { status: 'alive', service: 'refund-service' });
});

app.get('/ready', (_req, res) => {
  const mongoConnected = mongoose.connection.readyState === 1;
  if (mongoConnected) {
    sendSuccess(res, 200, 'Refund service dependencies ready', { mongo: 'connected' });
  } else {
    sendError(res, 503, 'Refund service MongoDB disconnected', ErrorCodes.INTERNAL_ERROR, { mongo: 'disconnected' });
  }
});

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`# HELP refund_uptime_seconds Uptime in seconds\n# TYPE refund_uptime_seconds gauge\nrefund_uptime_seconds ${process.uptime()}\n`);
});

// API Routes
app.use('/api/refunds', refundRoutes);

app.use(globalErrorHandler);

export default app;
