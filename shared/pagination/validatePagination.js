"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeCursor = encodeCursor;
exports.decodeAndValidateCursor = decodeAndValidateCursor;
exports.validateOffset = validateOffset;
const mongoose_1 = require("mongoose");
const paginationTypes_1 = require("./paginationTypes");
const paginationErrors_1 = require("./paginationErrors");
function encodeCursor(value, id) {
    return Buffer.from(JSON.stringify({ v: value, id })).toString('base64');
}
function decodeAndValidateCursor(cursorToken) {
    try {
        const json = Buffer.from(cursorToken, 'base64').toString('utf-8');
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== 'object' || !parsed.id || !mongoose_1.Types.ObjectId.isValid(parsed.id)) {
            throw new Error('Invalid ObjectId in cursor');
        }
        return parsed;
    }
    catch {
        throw new paginationErrors_1.PaginationError('Invalid or corrupted cursor token', 400, 'INVALID_CURSOR');
    }
}
function validateOffset(page, limit) {
    const offset = (page - 1) * limit;
    if (offset > paginationTypes_1.CONFIG.MAX_OFFSET) {
        throw new paginationErrors_1.PaginationError(`Offset (${offset}) exceeds maximum allowed offset (${paginationTypes_1.CONFIG.MAX_OFFSET}). Please use cursor-based pagination.`, 400, 'MAX_OFFSET_EXCEEDED');
    }
}
