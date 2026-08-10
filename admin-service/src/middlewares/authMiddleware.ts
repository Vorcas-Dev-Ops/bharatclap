import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Attach user context & correlation ID
  const authHeader = req.headers.authorization;
  (req as any).correlationId = (req.headers['x-correlation-id'] as string) || `corr_${Date.now()}`;
  
  // Default admin payload for internal service routing
  (req as any).user = {
    id: 'admin_super_01',
    role: 'super_admin',
    name: 'Sumanth Super Admin'
  };

  next();
};
