import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logger/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  Logger.error('ADMIN_SERVICE_ERROR', {
    error: err?.message || err,
    stack: err?.stack,
    url: req.url,
    method: req.method,
  });

  res.status(err?.status || 500).json({
    success: false,
    message: err?.message || 'Internal Server Error',
    errorCode: err?.errorCode || 'INTERNAL_ERROR',
    correlationId: (req as any).correlationId || `corr_${Date.now()}`,
    timestamp: new Date().toISOString(),
    details: process.env.NODE_ENV === 'production' ? undefined : err?.details
  });
};
