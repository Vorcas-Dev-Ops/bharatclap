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

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Global Context, Auth & Audit Middlewares
app.use(requestContextMiddleware);
app.use(authMiddleware);
app.use(auditLoggerMiddleware);

// Observability: Health, Readiness & Metrics Probes
app.get(['/health', '/api/v1/admin/health'], (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Admin Aggregation Service is operational',
    timestamp: new Date().toISOString(),
    correlationId: (req as any).correlationId,
    data: { status: 'healthy', uptimeSeconds: process.uptime() }
  });
});

app.get(['/ready', '/api/v1/admin/ready'], async (req: Request, res: Response) => {
  try {
    const overview = await SystemService.getSystemOverview();
    const allHealthy = overview.dependencyHealth.every((d) => d.status === 'healthy');

    res.status(allHealthy ? 200 : 207).json({
      success: true,
      message: allHealthy ? 'All microservice dependencies ready' : 'Degraded dependency health',
      timestamp: new Date().toISOString(),
      correlationId: (req as any).correlationId,
      data: overview
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Readiness check failed',
      errorCode: 'READINESS_CHECK_FAILED',
      correlationId: (req as any).correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get(['/metrics', '/api/v1/admin/metrics'], (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`# HELP admin_service_uptime_seconds Process uptime\n# TYPE admin_service_uptime_seconds gauge\nadmin_service_uptime_seconds ${process.uptime()}\n`);
});

// Register Versioned Admin Control Plane Routes (/api/v1/admin/...)
app.use('/api/v1/admin/customers', customerRoutes);
app.use('/api/v1/admin/providers', providerRoutes);
app.use('/api/v1/admin/dashboard', dashboardRoutes);
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
