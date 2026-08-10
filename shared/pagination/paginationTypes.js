"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
exports.CONFIG = {
    DEFAULT_LIMIT: Number(process.env.PAGINATION_DEFAULT_LIMIT) || 20,
    MAX_LIMIT: Number(process.env.PAGINATION_MAX_LIMIT) || 100,
    MAX_OFFSET: Number(process.env.PAGINATION_MAX_OFFSET) || 100000,
    SLOW_QUERY_THRESHOLD_MS: Number(process.env.SLOW_QUERY_THRESHOLD_MS) || 200,
    QUERY_TIMEOUT_MS: Number(process.env.PAGINATION_QUERY_TIMEOUT_MS) || 5000,
};
