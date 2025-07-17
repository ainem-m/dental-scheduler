/**
 * Comprehensive error handling system
 */

import type { ApiError, ErrorCode } from '@shared/types';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: Record<string, any>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string, value?: any) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      true,
      { field, value }
    );
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id 
      ? `${resource} with id ${id} not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFLICT', 409, true, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(
      message,
      'DATABASE_ERROR',
      500,
      true,
      { originalError: originalError?.message }
    );
  }
}

export class FileUploadError extends AppError {
  constructor(message: string, code: ErrorCode = 'UPLOAD_FAILED') {
    super(message, code, 400);
  }
}

// Error factory functions
export const createValidationError = (field: string, message: string, value?: any): ValidationError => {
  return new ValidationError(`Validation failed for field '${field}': ${message}`, field, value);
};

export const createNotFoundError = (resource: string, id?: string | number): NotFoundError => {
  return new NotFoundError(resource, id);
};

export const createConflictError = (message: string, details?: Record<string, any>): ConflictError => {
  return new ConflictError(message, details);
};

// Helper to convert errors to API response format
export const formatApiError = (error: Error, includeStack: boolean = false): ApiError => {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      ...(includeStack && { stack: error.stack })
    };
  }

  // Handle unknown errors
  return {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    details: { originalMessage: error.message },
    ...(includeStack && { stack: error.stack })
  };
};

// Error handler middleware
export const errorHandler = (
  error: Error,
  req: any,
  res: any,
  next: any
): void => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Log error for debugging
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle operational errors
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: formatApiError(error, isDevelopment),
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle unexpected errors
  res.status(500).json({
    success: false,
    error: formatApiError(error, isDevelopment),
    timestamp: new Date().toISOString()
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Type guard for AppError
export const isAppError = (error: any): error is AppError => {
  return error instanceof AppError;
};

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATABASE = 'database',
  FILE_SYSTEM = 'file_system',
  NETWORK = 'network',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system'
}

// Enhanced error with metadata
export interface ErrorMetadata {
  severity: ErrorSeverity;
  category: ErrorCategory;
  userId?: number;
  requestId?: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export class EnhancedError extends AppError {
  public readonly metadata: ErrorMetadata;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    metadata: Partial<ErrorMetadata> = {}
  ) {
    super(message, code, statusCode);
    
    this.metadata = {
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.SYSTEM,
      timestamp: new Date(),
      ...metadata
    };
  }
}

// Error reporting service (for production monitoring)
export class ErrorReporter {
  private static instance: ErrorReporter;
  private reporters: Array<(error: Error, metadata?: ErrorMetadata) => void> = [];

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }

  addReporter(reporter: (error: Error, metadata?: ErrorMetadata) => void): void {
    this.reporters.push(reporter);
  }

  report(error: Error, metadata?: ErrorMetadata): void {
    this.reporters.forEach(reporter => {
      try {
        reporter(error, metadata);
      } catch (reporterError) {
        console.error('Error in error reporter:', reporterError);
      }
    });
  }
}

// Built-in console reporter
ErrorReporter.getInstance().addReporter((error, metadata) => {
  console.error('Error Report:', {
    message: error.message,
    stack: error.stack,
    metadata,
    timestamp: new Date().toISOString()
  });
});