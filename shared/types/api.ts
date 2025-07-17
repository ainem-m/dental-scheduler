/**
 * API request/response types for type-safe communication
 */

import type { 
  Reservation, 
  User, 
  Holiday, 
  CreateReservationInput, 
  UpdateReservationInput,
  CreateUserInput,
  UpdateUserInput,
  CreateHolidayInput,
  UpdateHolidayInput,
  AuthCredentials,
  AuthenticatedUser
} from './domain';

// Generic API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string; // Only in development
}

// Error codes for consistent error handling
export const ErrorCodes = {
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
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Reservation API types
export interface GetReservationsRequest extends PaginationRequest {
  date?: string;
  startDate?: string;
  endDate?: string;
  columnIndex?: number;
}

export interface GetReservationsResponse {
  reservations: Reservation[];
  totalCount: number;
}

export interface CreateReservationRequest {
  reservation: CreateReservationInput;
}

export interface CreateReservationResponse {
  reservation: Reservation;
}

export interface UpdateReservationRequest {
  id: number;
  reservation: UpdateReservationInput;
}

export interface UpdateReservationResponse {
  reservation: Reservation;
}

export interface DeleteReservationRequest {
  id: number;
}

export interface DeleteReservationResponse {
  success: boolean;
}

// User API types
export interface GetUsersRequest {
  role?: 'admin' | 'staff';
  limit?: number;
  offset?: number;
}

export interface GetUsersResponse {
  users: User[];
  totalCount: number;
}

export interface CreateUserRequest {
  user: CreateUserInput;
}

export interface CreateUserResponse {
  user: User;
}

export interface UpdateUserRequest {
  id: number;
  user: UpdateUserInput;
}

export interface UpdateUserResponse {
  user: User;
}

export interface DeleteUserRequest {
  id: number;
}

export interface DeleteUserResponse {
  success: boolean;
}

// Holiday API types
export interface GetHolidaysRequest {
  type?: 'SPECIFIC_DATE' | 'RECURRING_DAY';
  year?: number;
  month?: number;
}

export interface GetHolidaysResponse {
  holidays: Holiday[];
  totalCount: number;
}

export interface CreateHolidayRequest {
  holiday: CreateHolidayInput;
}

export interface CreateHolidayResponse {
  holiday: Holiday;
}

export interface UpdateHolidayRequest {
  id: number;
  holiday: UpdateHolidayInput;
}

export interface UpdateHolidayResponse {
  holiday: Holiday;
}

export interface DeleteHolidayRequest {
  id: number;
}

export interface DeleteHolidayResponse {
  success: boolean;
}

// Authentication API types
export interface LoginRequest {
  credentials: AuthCredentials;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  token?: string; // If implementing JWT
}

export interface LogoutRequest {
  // Empty for now
}

export interface LogoutResponse {
  success: boolean;
}

// File upload API types
export interface UploadHandwritingRequest {
  file: File | Buffer;
  metadata?: {
    originalName?: string;
    description?: string;
  };
}

export interface UploadHandwritingResponse {
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

// Health check API types
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: boolean;
    filesystem: boolean;
    memory: boolean;
  };
}

// Validation types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Pagination types
export interface PaginationRequest {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}