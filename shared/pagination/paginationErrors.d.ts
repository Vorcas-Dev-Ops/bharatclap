export declare class PaginationError extends Error {
    readonly statusCode: number;
    readonly code: string;
    constructor(message: string, statusCode?: number, code?: string);
}
export declare function buildErrorResponse(code: string, message: string): {
    success: boolean;
    error: {
        code: string;
        message: string;
    };
};
