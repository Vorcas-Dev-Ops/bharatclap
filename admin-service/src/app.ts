import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestContextMiddleware } from './middlewares/requestContextMiddleware';
import { authMiddleware } from './middlewares/authMiddleware';
import { auditLoggerMiddleware } from './middlewares/auditLoggerMiddleware';
import { errorHandler } from './middlewares/errorHandler';
import { SystemService } from './services/system.service';

import customerRoutes from './routes/customer.routes';
import providerRoutes from './routes/provider.routes';
import dashboardRoutes from './routes/dashboard.routes';
import nocRoutes from './routes/noc.routes';
import financeRoutes from './routes/finance.routes';
import chatRoutes from './routes/chat.routes';
import reportsRoutes from './routes/reports.routes';
import searchRoutes from './routes/search.routes';
import settingsRoutes from './routes/settings.routes';
import featureFlagsRoutes from './routes/featureFlags.routes';
import auditRoutes from './routes/audit.routes';
import systemRoutes from './routes/system.routes';
import publicRoutes from './routes/public.routes';
import chartsRoutes from './routes/charts.routes';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, callback) => callback(null, origin || true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'Expires',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-internal-service-key',
    'x-correlation-id',
    'x-device-id',
    'x-refresh-token',
    'x-user-id',
    'x-admin-role'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400
}));
app.options('*', cors());
app.use(express.json());

import { createLivenessHandler, createReadinessHandler } from '@bharatclap/shared';

// Global Context
app.use(requestContextMiddleware);

// Observability: Health, Readiness & Metrics Probes (Unauthenticated)
app.get(['/health', '/health/live', '/api/v1/admin/health'], createLivenessHandler('admin-service'));
app.get(['/ready', '/health/ready', '/api/v1/admin/ready'], createReadinessHandler({ serviceName: 'admin-service', isRedisCritical: false }));

// Public Endpoints (Unauthenticated, e.g. platform settings)
app.use('/api/v1/public', publicRoutes);

// Auth & Audit Middlewares for protected endpoints
app.use(authMiddleware);
app.use(auditLoggerMiddleware);

app.get(['/metrics', '/api/v1/admin/metrics'], (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`# HELP admin_service_uptime_seconds Process uptime\n# TYPE admin_service_uptime_seconds gauge\nadmin_service_uptime_seconds ${process.uptime()}\n`);
});

// Register Versioned Admin Control Plane Routes (/api/v1/admin/...)
app.use('/api/v1/admin/customers', customerRoutes);
app.use('/api/v1/admin/providers', providerRoutes);
app.use('/api/v1/admin/dashboard', dashboardRoutes);
app.use('/api/v1/admin/charts', chartsRoutes);
app.use('/api/v1/admin/noc', nocRoutes);
app.use('/api/v1/admin/finance', financeRoutes);
app.use('/api/v1/admin/chat', chatRoutes);
app.use('/api/v1/admin/reports', reportsRoutes);
app.use('/api/v1/admin/search', searchRoutes);
app.use('/api/v1/admin/settings', settingsRoutes);
app.use('/api/v1/admin/feature-flags', featureFlagsRoutes);
app.use('/api/v1/admin/audit', auditRoutes);
app.use('/api/v1/admin/system', systemRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/platform', publicRoutes);

// Backward Compatibility Routes (/api/admin/...)
app.use('/api/admin/customers', customerRoutes);
app.use('/api/admin/providers', providerRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin/charts', chartsRoutes);
app.use('/api/admin/noc', nocRoutes);
app.use('/api/admin/finance', financeRoutes);
app.use('/api/admin/chat', chatRoutes);
app.use('/api/admin/reports', reportsRoutes);
app.use('/api/admin/search', searchRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/admin/feature-flags', featureFlagsRoutes);
app.use('/api/admin/audit', auditRoutes);
app.use('/api/admin/system', systemRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
