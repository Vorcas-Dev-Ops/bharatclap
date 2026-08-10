import { Model, FilterQuery } from 'mongoose';
import { OffsetOptions, StandardResponse, CONFIG } from './paginationTypes';
import { validateOffset } from './validatePagination';

export async function paginateOffset<T>(
  model: Model<T>,
  filter: FilterQuery<T> = {},
  options: OffsetOptions = {}
): Promise<StandardResponse<T>> {
  const startTime = Date.now();
  const limit = Math.min(CONFIG.MAX_LIMIT, Math.max(1, Number(options.limit) || CONFIG.DEFAULT_LIMIT));
  const page = Math.max(1, Number(options.page) || 1);

  validateOffset(page, limit);
  const skip = (page - 1) * limit;

  const allowedSorts = options.allowedSortFields || ['createdAt', '_id', 'updatedAt', 'name', 'status'];
  const requestedSort = options.sort || 'createdAt';
  const sortField = allowedSorts.includes(requestedSort) ? requestedSort : 'createdAt';
  const sortDir = options.order === 'asc' || options.order === 1 ? 1 : -1;

  const sortSpec: any = { [sortField]: sortDir };
  if (sortField !== '_id') sortSpec._id = sortDir;

  const mQuery = model.find(filter, options.projection).sort(sortSpec).skip(skip).limit(limit).maxTimeMS(CONFIG.QUERY_TIMEOUT_MS).lean();

  if (options.readPreference) mQuery.read(options.readPreference);
  if (options.hint) {
    try {
      mQuery.hint(options.hint);
    } catch {
      // Safe hint fallback
    }
  }

  const [data, total] = await Promise.all([mQuery, model.countDocuments(filter).maxTimeMS(CONFIG.QUERY_TIMEOUT_MS)]);
  const totalPages = Math.ceil(total / limit) || 1;
  const durationMs = Date.now() - startTime;

  return {
    success: true,
    data: data as unknown as T[],
    meta: {
      total,
      totalPages,
      currentPage: page,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      durationMs,
    },
  };
}
