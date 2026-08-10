"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginateOffset = paginateOffset;
const paginationTypes_1 = require("./paginationTypes");
const validatePagination_1 = require("./validatePagination");
async function paginateOffset(model, filter = {}, options = {}) {
    const startTime = Date.now();
    const limit = Math.min(paginationTypes_1.CONFIG.MAX_LIMIT, Math.max(1, Number(options.limit) || paginationTypes_1.CONFIG.DEFAULT_LIMIT));
    const page = Math.max(1, Number(options.page) || 1);
    (0, validatePagination_1.validateOffset)(page, limit);
    const skip = (page - 1) * limit;
    const allowedSorts = options.allowedSortFields || ['createdAt', '_id', 'updatedAt', 'name', 'status'];
    const requestedSort = options.sort || 'createdAt';
    const sortField = allowedSorts.includes(requestedSort) ? requestedSort : 'createdAt';
    const sortDir = options.order === 'asc' || options.order === 1 ? 1 : -1;
    // Stable secondary sort tie-breaker
    const sortSpec = { [sortField]: sortDir };
    if (sortField !== '_id')
        sortSpec._id = sortDir;
    const mQuery = model.find(filter, options.projection).sort(sortSpec).skip(skip).limit(limit).maxTimeMS(paginationTypes_1.CONFIG.QUERY_TIMEOUT_MS).lean();
    if (options.readPreference)
        mQuery.read(options.readPreference);
    if (options.hint) {
        try {
            mQuery.hint(options.hint);
        }
        catch {
            // Safe hint fallback if index name changes
        }
    }
    const [data, total] = await Promise.all([mQuery, model.countDocuments(filter).maxTimeMS(paginationTypes_1.CONFIG.QUERY_TIMEOUT_MS)]);
    const totalPages = Math.ceil(total / limit) || 1;
    const durationMs = Date.now() - startTime;
    return {
        success: true,
        data: data,
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
