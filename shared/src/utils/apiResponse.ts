import { Response } from 'express';
import { ErrorCodeType, ErrorCodes } from '../constants/errorCodes';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: any;
  errorCode?: string;
  details?: any;
  requestId: string | null;
  timestamp: string;
  path: string | null;
}

export const sendSuccess = <T = any>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T,
  meta?: any
): Response => {
  const req = res.req;
  const requestId = (res.getHeader('x-correlation-id') as string) || (req?.headers?.['x-correlation-id'] as string) || null;
  const path = req?.originalUrl || req?.url || null;

  const payload: ApiResponse<T> = {
    success: true,
    message,
    data,
    meta,
    requestId,
    timestamp: new Date().toISOString(),
    path
  };

  return res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  errorCode: ErrorCodeType | string = ErrorCodes.INTERNAL_ERROR,
  details?: any
): Response => {
  const req = res.req;
  const requestId = (res.getHeader('x-correlation-id') as string) || (req?.headers?.['x-correlation-id'] as string) || null;
  const path = req?.originalUrl || req?.url || null;

  const payload: ApiResponse = {
    success: false,
    message,
    errorCode,
    details,
    requestId,
    timestamp: new Date().toISOString(),
    path
  };

  return res.status(statusCode).json(payload);
};
