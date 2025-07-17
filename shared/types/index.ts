/**
 * Main export file for shared types
 * This file should be imported by both client and server
 */

// Domain types
export * from './domain';

// API types
export * from './api';

// Socket types
export * from './socket';

// Re-export commonly used types for convenience
export type {
  Reservation,
  User,
  Holiday,
  GridConfig,
  GridState,
  Coordinates,
  CreateReservationInput,
  UpdateReservationInput,
  AuthCredentials,
  AuthenticatedUser,
} from './domain';

export type {
  ApiResponse,
  ApiError,
  ErrorCode,
  GetReservationsRequest,
  GetReservationsResponse,
  CreateReservationRequest,
  CreateReservationResponse,
  ValidationError,
  ValidationResult,
} from './api';

export type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  ConnectedUser,
  TypedSocket,
  TypedServer,
} from './socket';

export { ErrorCodes } from './api';
export { SocketEvents } from './socket';