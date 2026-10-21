import type { Request, Response, NextFunction } from 'express';

export const requireRole =
  (...allowed: string[]) =>
  (req: Request & { user?: { role?: string } }, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role ?? '')) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    next();
  };
