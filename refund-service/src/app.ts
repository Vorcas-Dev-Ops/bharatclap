import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import refundRoutes from './routes/refundRoutes';

import mongoose from 'mongoose';
import { correlationMiddleware, globalErrorHandler, sendSuccess, sendError, ErrorCodes, logRoutes } from '@bharatclap/shared';

const app = express();

app.use(helmet());
app.use(correlationMiddleware);
import { corsMiddleware } from './utils/corsConfig';

app.use(corsMiddleware);
app.use(express.json());

import { createLivenessHandler, createReadinessHandler } from '@bharatclap/shared';

// Health, Readiness & Metrics Endpoints
app.get(['/health', '/health/live'], createLivenessHandler('refund-service'));
app.get(['/ready', '/health/ready'], createReadinessHandler({ serviceName: 'refund-service', isRedisCritical: false }));

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`# HELP refund_uptime_seconds Uptime in seconds\n# TYPE refund_uptime_seconds gauge\nrefund_uptime_seconds ${process.uptime()}\n`);
});

// API Routes
app.use('/api/refunds', refundRoutes);

app.use('/internal/logs', logRoutes);

app.use(globalErrorHandler);

export default app;
