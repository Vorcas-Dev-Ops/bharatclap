import { Model, FilterQuery, Types } from 'mongoose';
import { CursorOptions, StandardResponse, CONFIG } from './paginationTypes';
import { decodeAndValidateCursor, encodeCursor } from './validatePagination';

export async function paginateCursor<T>(
  model: Model<T>,
  filter: FilterQuery<T> = {},
  options: CursorOptions = {}
): Promise<StandardResponse<T>> {
  const startTime = Date.now();
  const limit = Math.min(CONFIG.MAX_LIMIT, Math.max(1, Number(options.limit) || CONFIG.DEFAULT_LIMIT));
  const sortField = options.sortField || 'createdAt';
  const sortOrder = options.sortOrder === 'asc' || options.sortOrder === 1 ? 1 : -1;

  const queryFilter: any = { ...filter };

  // Composite Snapshot Cursor Decoding & Filtering
  if (options.cursor) {
    const decoded = decodeAndValidateCursor(options.cursor);
    const op = sortOrder === -1 ? '$lt' : '$gt';

    if (sortField === '_id') {
      queryFilter._id = { [op]: new Types.ObjectId(decoded.id) };
    } else {
      queryFilter.$or = [
        { [sortField]: { [op]: decoded.v } },
        { [sortField]: decoded.v, _id: { [op]: new Types.ObjectId(decoded.id) } },
      ];
    }
  }

  const sortSpec: any = { [sortField]: sortOrder };
  if (sortField !== '_id') sortSpec._id = sortOrder;

  const mQuery = model.find(queryFilter, options.projection).sort(sortSpec).limit(limit + 1).maxTimeMS(CONFIG.QUERY_TIMEOUT_MS).lean();

  if (options.readPreference) mQuery.read(options.readPreference);
  if (options.hint) {
    try {
      mQuery.hint(options.hint);
    } catch {
      // Safe hint fallback
    }
  }

  const results = await mQuery;
  const hasNextPage = results.length > limit;
  const data = (hasNextPage ? results.slice(0, limit) : results) as unknown as T[];
  const lastItem = data[data.length - 1] as any;

  let nextCursor: string | null = null;
  if (hasNextPage && lastItem) {
    const sortVal = sortField === '_id' ? String(lastItem._id) : lastItem[sortField];
    nextCursor = encodeCursor(sortVal, String(lastItem._id));
  }

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    data,
    meta: {
      pageSize: limit,
      hasNextPage,
      hasPreviousPage: !!options.cursor,
      nextCursor,
      durationMs,
    },
  };
}
