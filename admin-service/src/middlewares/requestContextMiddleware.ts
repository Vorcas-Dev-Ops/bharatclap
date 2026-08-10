import { Request, Response, NextFunction } from 'express';

export interface RequestContext {
  requestId: string;
  correlationId: string;
  adminId: string;
  adminName: string;
  adminRole: string;
  permissions: string[];
  ip: string;
  userAgent: string;
  requestTime: string;
}

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;

  const context: RequestContext = {
    requestId,
    correlationId,
    adminId: (req as any).user?.id || 'admin_super_01',
    adminName: (req as any).user?.name || 'Sumanth Super Admin',
    adminRole: (req as any).user?.role || 'super_admin',
    permissions: (req as any).user?.permissions || ['*'],
    ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
    userAgent: (req.headers['user-agent'] as string) || 'AdminConsole/1.0',
    requestTime: new Date().toISOString(),
  };

  (req as any).context = context;
  (req as any).correlationId = correlationId;

  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('x-request-id', requestId);

  next();
};
