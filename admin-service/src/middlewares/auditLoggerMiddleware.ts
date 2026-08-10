import { Request, Response, NextFunction } from 'express';
import { AuditLogger } from '../logger/auditLogger';

export const auditLoggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  res.on('finish', () => {
    if (req.method !== 'GET') {
      AuditLogger.log({
        adminId: (req as any).user?.id || 'admin_user',
        adminName: (req as any).user?.name,
        action: `${req.method} ${req.path}`,
        resource: req.originalUrl,
        ip: req.ip || '127.0.0.1',
        browser: (req.headers['user-agent'] as string) || 'Browser',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`
      });
    }
  });
  next();
};
