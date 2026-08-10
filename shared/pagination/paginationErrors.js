"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationError = void 0;
exports.buildErrorResponse = buildErrorResponse;
class PaginationError extends Error {
    constructor(message, statusCode = 400, code = 'INVALID_PAGINATION') {
        super(message);
        this.name = 'PaginationError';
        this.statusCode = statusCode;
        this.code = code;
    }
}
exports.PaginationError = PaginationError;
function buildErrorResponse(code, message) {
    return {
        success: false,
        error: {
            code,
            message,
        },
    };
}
