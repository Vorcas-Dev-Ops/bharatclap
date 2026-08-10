export class PaginationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = 'INVALID_PAGINATION') {
    super(message);
    this.name = 'PaginationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function buildErrorResponse(code: string, message: string) {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}
