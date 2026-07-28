import { ReadPreferenceMode } from 'mongoose';

export interface PaginationConfig {
  DEFAULT_LIMIT: number;
  MAX_LIMIT: number;
  MAX_OFFSET: number;
  SLOW_QUERY_THRESHOLD_MS: number;
  QUERY_TIMEOUT_MS: number;
}

export const CONFIG: PaginationConfig = {
  DEFAULT_LIMIT: Number(process.env.PAGINATION_DEFAULT_LIMIT) || 20,
  MAX_LIMIT: Number(process.env.PAGINATION_MAX_LIMIT) || 100,
  MAX_OFFSET: Number(process.env.PAGINATION_MAX_OFFSET) || 100000,
  SLOW_QUERY_THRESHOLD_MS: Number(process.env.SLOW_QUERY_THRESHOLD_MS) || 200,
  QUERY_TIMEOUT_MS: Number(process.env.PAGINATION_QUERY_TIMEOUT_MS) || 5000,
};

export interface FilterOptions {
  search?: string;
  searchableFields?: string[];
  allowedFilters?: Record<string, any>;
}

export interface BaseOptions extends FilterOptions {
  limit?: number | string;
  projection?: any;
  hint?: any;
  readPreference?: ReadPreferenceMode;
  allowedSortFields?: string[];
}

export interface OffsetOptions extends BaseOptions {
  page?: number | string;
  sort?: string;
  order?: 'asc' | 'desc' | 1 | -1;
}

export interface CursorOptions extends BaseOptions {
  cursor?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc' | 1 | -1;
}

export interface PaginationMeta {
  total?: number;
  totalPages?: number;
  currentPage?: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: string | null;
  durationMs: number;
}

export interface StandardResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}
