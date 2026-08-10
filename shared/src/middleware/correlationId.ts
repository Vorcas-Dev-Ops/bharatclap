import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';

export interface CorrelationStore {
  correlationId: string;
  requestId?: string;
  userId?: string;
  providerId?: string;
  bookingId?: string;
}

export const correlationStore = new AsyncLocalStorage<CorrelationStore>();

export const correlationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const incomingId = (req.headers['x-correlation-id'] as string) || (req.headers['x-request-id'] as string);
  const correlationId = incomingId || `CORR_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const requestId = (req.headers['x-request-id'] as string) || `REQ_${Math.random().toString(36).substring(2, 8)}`;

  // Attach header to request and response
  req.headers['x-correlation-id'] = correlationId;
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('x-request-id', requestId);

  const store: CorrelationStore = {
    correlationId,
    requestId,
    userId: (req as any).user?._id?.toString() || (req as any).user?.id,
    providerId: (req as any).provider?._id?.toString() || (req as any).provider?.id,
  };

  correlationStore.run(store, () => {
    next();
  });
};

export const getCorrelationId = (): string => {
  return correlationStore.getStore()?.correlationId || 'unknown';
};
