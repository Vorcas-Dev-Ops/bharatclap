import { CONFIG } from './paginationTypes';
import { PaginationError } from './paginationErrors';

export interface DecodedCursor {
  v: any;
  id: string;
}

export function encodeCursor(value: any, id: string): string {
  return Buffer.from(JSON.stringify({ v: value, id })).toString('base64');
}

export function decodeAndValidateCursor(cursorToken: string): DecodedCursor {
  try {
    const json = Buffer.from(cursorToken, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !parsed.id || typeof parsed.id !== 'string' || parsed.id.trim().length === 0) {
      throw new Error('Invalid identifier in cursor');
    }
    return parsed;
  } catch {
    throw new PaginationError('Invalid or corrupted cursor token', 400, 'INVALID_CURSOR');
  }
}

export function validateOffset(page: number, limit: number): void {
  const offset = (page - 1) * limit;
  if (offset > CONFIG.MAX_OFFSET) {
    throw new PaginationError(
      `Offset (${offset}) exceeds maximum allowed offset (${CONFIG.MAX_OFFSET}). Please use cursor-based pagination.`,
      400,
      'MAX_OFFSET_EXCEEDED'
    );
  }
}
