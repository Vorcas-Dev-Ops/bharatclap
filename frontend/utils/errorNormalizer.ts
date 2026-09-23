/**
 * BharatClap Centralized Error Normalizer
 * Guarantees raw database errors, internal URLs, and stack traces never reach user UI.
 */

export interface NormalizedApiError {
  code: string;
  status: number;
  userMessage: string;
  requestId: string;
  fieldErrors?: Record<string, string>;
}

// Generate opaque reference ID (e.g., BC-7F82A1)
export function generateReferenceId(): string {
  const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
  return `BC-${randomHex}`;
}

// List of internal patterns that must be stripped from user view
const SENSITIVE_ERROR_PATTERNS = [
  /MongoServerError/i,
  /E11000/i,
  /CastError/i,
  /Prisma/i,
  /SQLSTATE/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /jwt/i,
  /token expired/i,
  /at\s+.*\..*\(.*:\d+:\d+\)/i, // Stack trace lines
  /\/var\/app/i,
  /\/src\//i,
  /http:\/\/127\.0\.0\.1/i,
  /http:\/\/localhost/i,
];

function sanitizeMessage(msg?: string): string | null {
  if (!msg || typeof msg !== 'string') return null;
  for (const pattern of SENSITIVE_ERROR_PATTERNS) {
    if (pattern.test(msg)) {
      return null;
    }
  }
  return msg.trim();
}

export function normalizeApiError(error: any): NormalizedApiError {
  const status = error?.response?.status || (error?.code === 'ECONNABORTED' ? 408 : 0);
  const data = error?.response?.data;
  const correlationId = error?.response?.headers?.['x-correlation-id'] || generateReferenceId();

  // Log raw technical error server/console side with reference ID for debugging
  if (typeof window !== 'undefined') {
    console.error(`[API ERROR ${correlationId}]`, {
      status,
      url: error?.config?.url,
      method: error?.config?.method,
      errorData: data,
      rawMessage: error?.message,
    });
  }

  const rawServerMsg = sanitizeMessage(data?.message || data?.error);

  // Network / Connection drop
  if (status === 0 || error?.message === 'Network Error' || error?.code === 'ERR_NETWORK') {
    return {
      code: 'NETWORK_ERROR',
      status: 0,
      userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      requestId: correlationId,
    };
  }

  // Timeout
  if (status === 408 || error?.code === 'ECONNABORTED') {
    return {
      code: 'TIMEOUT',
      status: 408,
      userMessage: 'The request took too long to complete. Please try again.',
      requestId: correlationId,
    };
  }

  // Authentication Failure
  if (status === 401) {
    return {
      code: 'UNAUTHORIZED',
      status: 401,
      userMessage: 'Your session has expired. Please sign in again.',
      requestId: correlationId,
    };
  }

  // Forbidden / Permission
  if (status === 403) {
    return {
      code: 'FORBIDDEN',
      status: 403,
      userMessage: rawServerMsg || "You don't have permission to perform this action.",
      requestId: correlationId,
    };
  }

  // Resource Not Found
  if (status === 404) {
    return {
      code: 'NOT_FOUND',
      status: 404,
      userMessage: rawServerMsg || 'The requested resource could not be found.',
      requestId: correlationId,
    };
  }

  // State Conflict / Duplicate / Concurrency
  if (status === 409) {
    return {
      code: data?.code || 'CONFLICT',
      status: 409,
      userMessage: rawServerMsg || 'This action could not be completed because the status has changed. Please refresh.',
      requestId: correlationId,
    };
  }

  // Validation Error
  if (status === 400 || status === 422) {
    return {
      code: data?.code || 'VALIDATION_ERROR',
      status,
      userMessage: rawServerMsg || 'Please check the details entered and try again.',
      requestId: correlationId,
      fieldErrors: data?.errors || data?.fieldErrors,
    };
  }

  // Rate Limiting
  if (status === 429) {
    return {
      code: 'RATE_LIMITED',
      status: 429,
      userMessage: rawServerMsg || 'Too many requests. Please wait a moment and try again.',
      requestId: correlationId,
    };
  }

  // Service Unavailable
  if (status === 502 || status === 503 || status === 504) {
    return {
      code: 'SERVICE_UNAVAILABLE',
      status,
      userMessage: 'Our service is undergoing brief maintenance. Please try again in a few moments.',
      requestId: correlationId,
    };
  }

  // Default 500 / Server Error
  return {
    code: 'SERVER_ERROR',
    status: status || 500,
    userMessage: `Something went wrong on our side. Please try again shortly. (Ref: ${correlationId})`,
    requestId: correlationId,
  };
}

export const normalizeError = normalizeApiError;
