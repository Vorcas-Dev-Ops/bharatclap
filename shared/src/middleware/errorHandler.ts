import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';
import { ErrorCodes } from '../constants/errorCodes';
import { sendError } from '../utils/apiResponse';
import { logger } from '../logger';

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Known custom AppErrors
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, err.errorCode);
    return;
  }

  // Zod Validation Error
  if (err?.name === 'ZodError' || err?.constructor?.name === 'ZodError') {
    const formattedErrors = (err.errors || []).map((e: any) => ({
      field: e.path ? e.path.join('.') : undefined,
      message: e.message
    }));
    sendError(res, 400, 'Validation error', ErrorCodes.VALIDATION_ERROR, formattedErrors);
    return;
  }

  // Mongoose Version Conflict Error
  if (err?.name === 'VersionError' || err?.message?.includes('version')) {
    sendError(res, 409, 'Document version conflict. Please retry.', ErrorCodes.VERSION_CONFLICT);
    return;
  }

  // Mongoose Duplicate Key Error
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    sendError(res, 409, `Duplicate value for ${field}`, ErrorCodes.DUPLICATE_REQUEST, err.keyValue);
    return;
  }

  // Log unhandled unexpected errors
  logger.error('Unhandled internal server error', err, {
    action: 'UNHANDLED_ERROR',
    metadata: {
      path: req.originalUrl,
      method: req.method
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  sendError(
    res,
    500,
    isProd ? 'Internal server error' : (err?.message || 'Internal server error'),
    ErrorCodes.INTERNAL_ERROR,
    isProd ? undefined : err?.stack
  );
};
