import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  const status = err.status || 500;
  console.error(`[CENTRALIZED ERROR] ${req.method} ${req.url} - Status: ${status} -`, err.stack || err);
  if (!res.headersSent) {
    res.status(status).json({
      message: status === 500 ? 'Internal Server Error' : err.message || 'Internal Server Error'
    });
  }
};
