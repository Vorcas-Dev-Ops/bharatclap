import { Request, Response, NextFunction } from 'express';
import { buildErrorResponse, PaginationError } from './paginationErrors';

export interface ParsedPagination {
  page: number;
  limit: number;
  cursor?: string;
  sort: string;
  order: 'asc' | 'desc';
  search?: string;
}

export interface RequestWithPagination extends Request {
  pagination?: ParsedPagination;
}

export function paginationMiddleware(req: RequestWithPagination, res: Response, next: NextFunction): void {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 20);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'createdAt';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

    req.pagination = { page, limit, cursor, sort, order, search };
    next();
  } catch (err: any) {
    if (err instanceof PaginationError) {
      res.status(err.statusCode).json(buildErrorResponse(err.code, err.message));
      return;
    }
    res.status(400).json(buildErrorResponse('BAD_REQUEST', 'Invalid pagination parameters'));
  }
}
