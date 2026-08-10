"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginateCursor = paginateCursor;
const mongoose_1 = require("mongoose");
const paginationTypes_1 = require("./paginationTypes");
const validatePagination_1 = require("./validatePagination");
async function paginateCursor(model, filter = {}, options = {}) {
    const startTime = Date.now();
    const limit = Math.min(paginationTypes_1.CONFIG.MAX_LIMIT, Math.max(1, Number(options.limit) || paginationTypes_1.CONFIG.DEFAULT_LIMIT));
    const sortField = options.sortField || 'createdAt';
    const sortOrder = options.sortOrder === 'asc' || options.sortOrder === 1 ? 1 : -1;
    const queryFilter = { ...filter };
    // Composite Snapshot Cursor Decoding & Filtering
    if (options.cursor) {
        const decoded = (0, validatePagination_1.decodeAndValidateCursor)(options.cursor);
        const op = sortOrder === -1 ? '$lt' : '$gt';
        if (sortField === '_id') {
            queryFilter._id = { [op]: new mongoose_1.Types.ObjectId(decoded.id) };
        }
        else {
            queryFilter.$or = [
                { [sortField]: { [op]: decoded.v } },
                { [sortField]: decoded.v, _id: { [op]: new mongoose_1.Types.ObjectId(decoded.id) } },
            ];
        }
    }
    const sortSpec = { [sortField]: sortOrder };
    if (sortField !== '_id')
        sortSpec._id = sortOrder;
    const mQuery = model.find(queryFilter, options.projection).sort(sortSpec).limit(limit + 1).maxTimeMS(paginationTypes_1.CONFIG.QUERY_TIMEOUT_MS).lean();
    if (options.readPreference)
        mQuery.read(options.readPreference);
    if (options.hint) {
        try {
            mQuery.hint(options.hint);
        }
        catch {
            // Safe hint fallback
        }
    }
    const results = await mQuery;
    const hasNextPage = results.length > limit;
    const data = (hasNextPage ? results.slice(0, limit) : results);
    const lastItem = data[data.length - 1];
    let nextCursor = null;
    if (hasNextPage && lastItem) {
        const sortVal = sortField === '_id' ? String(lastItem._id) : lastItem[sortField];
        nextCursor = (0, validatePagination_1.encodeCursor)(sortVal, String(lastItem._id));
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
