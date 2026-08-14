import express from "express";
import cors from "cors";
import helmet from "helmet";
import notificationRoutes from "./routes/notificationRoutes";
import adminReportRoutes from "./routes/adminReportRoutes";
import { errorHandler } from "./middleware/errorHandler";

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

app.use((req, res, next) => {
  if (req.query && req.query.limit) {
    const parsedLimit = parseInt(req.query.limit as string, 10);
    if (!isNaN(parsedLimit)) {
      req.query.limit = String(Math.min(parsedLimit, 100));
    }
  }
  next();
});

import mongoose from "mongoose";
import { correlationMiddleware, globalErrorHandler, sendSuccess, sendError, ErrorCodes, logRoutes } from "@bharatclap/shared";

app.use(correlationMiddleware);

app.use(
 "/api/notifications",
 notificationRoutes
);
app.use(
 "/api/notifications/reports",
 adminReportRoutes
);

import { createLivenessHandler, createReadinessHandler } from '@bharatclap/shared';

// Health, Readiness & Metrics Endpoints
app.get(['/health', '/health/live'], createLivenessHandler('notification-service'));
app.get(['/ready', '/health/ready'], createReadinessHandler({ serviceName: 'notification-service', isRedisCritical: true }));

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`# HELP notification_uptime_seconds Uptime in seconds\n# TYPE notification_uptime_seconds gauge\nnotification_uptime_seconds ${process.uptime()}\n`);
});

app.use('/internal/logs', logRoutes);

app.use(globalErrorHandler);

export default app;
