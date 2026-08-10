import { ErrorCodes, ErrorCodeType } from '../constants/errorCodes';

export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number,
    public errorCode: ErrorCodeType | string
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation error', public errors?: any[]) {
    super(message, 400, ErrorCodes.VALIDATION_ERROR);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, ErrorCodes.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Document version conflict or duplicate request') {
    super(message, 409, ErrorCodes.VERSION_CONFLICT);
  }
}

export class BusinessError extends AppError {
  constructor(message: string, errorCode: ErrorCodeType | string = ErrorCodes.INTERNAL_ERROR) {
    super(message, 422, errorCode);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, ErrorCodes.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access') {
    super(message, 403, ErrorCodes.FORBIDDEN);
  }
}
