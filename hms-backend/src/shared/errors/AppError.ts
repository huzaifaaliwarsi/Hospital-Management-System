/**
 * Typed error hierarchy (§7.10). Thrown from services/repositories, caught
 * once by `errorHandler` middleware, mapped to the error envelope in §8.2.
 */
export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor(code: AppErrorCode, statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super('VALIDATION_ERROR', 400, message, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super('AUTHENTICATION_ERROR', 401, message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super('AUTHORIZATION_ERROR', 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflicting state') {
    super('CONFLICT', 409, message);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super('BUSINESS_RULE_ERROR', 422, message, details);
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super('INTERNAL_ERROR', 500, message);
  }
}
