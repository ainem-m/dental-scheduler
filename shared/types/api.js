"use strict";
/**
 * API request/response types for type-safe communication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodes = void 0;
// Error codes for consistent error handling
exports.ErrorCodes = {
    // Authentication errors
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    // Validation errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
    INVALID_DATA_FORMAT: 'INVALID_DATA_FORMAT',
    // Resource errors
    NOT_FOUND: 'NOT_FOUND',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    CONFLICT: 'CONFLICT',
    // File upload errors
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
    UPLOAD_FAILED: 'UPLOAD_FAILED',
    // Database errors
    DATABASE_ERROR: 'DATABASE_ERROR',
    CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
    // Server errors
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    TIMEOUT: 'TIMEOUT',
};
