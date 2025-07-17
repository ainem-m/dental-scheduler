/**
 * Socket.IO event types for type-safe real-time communication
 */

import type { Reservation, Holiday } from './domain';
import type { ApiError } from './api';

// Socket event names as constants for type safety
export const SocketEvents = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // Room management
  JOIN_DATE_ROOM: 'join-date-room',
  LEAVE_DATE_ROOM: 'leave-date-room',
  
  // Reservation events
  FETCH_RESERVATIONS: 'fetch-reservations',
  SAVE_RESERVATION: 'save-reservation',
  UPDATE_RESERVATION: 'update-reservation',
  DELETE_RESERVATION: 'delete-reservation',
  RESERVATIONS_UPDATED: 'reservations-updated',
  RESERVATION_CREATED: 'reservation-created',
  RESERVATION_UPDATED: 'reservation-updated',
  RESERVATION_DELETED: 'reservation-deleted',
  
  // Holiday events
  FETCH_HOLIDAYS: 'fetch-holidays',
  HOLIDAYS_UPDATED: 'holidays-updated',
  
  // User events
  USER_CONNECTED: 'user-connected',
  USER_DISCONNECTED: 'user-disconnected',
  USERS_ONLINE: 'users-online',
  
  // Error events
  RESERVATION_ERROR: 'reservation-error',
  VALIDATION_ERROR: 'validation-error',
  PERMISSION_ERROR: 'permission-error',
  
  // System events
  SYSTEM_MAINTENANCE: 'system-maintenance',
  SYSTEM_ALERT: 'system-alert',
} as const;

export type SocketEventName = typeof SocketEvents[keyof typeof SocketEvents];

// Client to Server events
export interface ClientToServerEvents {
  // Room management
  [SocketEvents.JOIN_DATE_ROOM]: (date: string) => void;
  [SocketEvents.LEAVE_DATE_ROOM]: (date: string) => void;
  
  // Reservation events
  [SocketEvents.FETCH_RESERVATIONS]: (date: string) => void;
  [SocketEvents.SAVE_RESERVATION]: (reservation: Partial<Reservation>) => void;
  [SocketEvents.UPDATE_RESERVATION]: (id: number, reservation: Partial<Reservation>) => void;
  [SocketEvents.DELETE_RESERVATION]: (id: number) => void;
  
  // Holiday events
  [SocketEvents.FETCH_HOLIDAYS]: (filters?: { year?: number; month?: number }) => void;
}

// Server to Client events
export interface ServerToClientEvents {
  // Connection events
  [SocketEvents.CONNECT]: () => void;
  [SocketEvents.DISCONNECT]: (reason: string) => void;
  [SocketEvents.ERROR]: (error: ApiError) => void;
  
  // Reservation events
  [SocketEvents.RESERVATIONS_UPDATED]: (reservations: Reservation[]) => void;
  [SocketEvents.RESERVATION_CREATED]: (reservation: Reservation) => void;
  [SocketEvents.RESERVATION_UPDATED]: (reservation: Reservation) => void;
  [SocketEvents.RESERVATION_DELETED]: (id: number) => void;
  
  // Holiday events
  [SocketEvents.HOLIDAYS_UPDATED]: (holidays: Holiday[]) => void;
  
  // User events
  [SocketEvents.USER_CONNECTED]: (user: ConnectedUser) => void;
  [SocketEvents.USER_DISCONNECTED]: (userId: number) => void;
  [SocketEvents.USERS_ONLINE]: (users: ConnectedUser[]) => void;
  
  // Error events
  [SocketEvents.RESERVATION_ERROR]: (error: ReservationError) => void;
  [SocketEvents.VALIDATION_ERROR]: (error: ValidationSocketError) => void;
  [SocketEvents.PERMISSION_ERROR]: (error: PermissionError) => void;
  
  // System events
  [SocketEvents.SYSTEM_MAINTENANCE]: (message: SystemMessage) => void;
  [SocketEvents.SYSTEM_ALERT]: (alert: SystemAlert) => void;
}

// Socket middleware data
export interface SocketData {
  userId?: number;
  username?: string;
  role?: 'admin' | 'staff';
  joinedRooms: string[];
  lastActivity: Date;
}

// Connected user information
export interface ConnectedUser {
  id: number;
  username: string;
  role: 'admin' | 'staff';
  connectedAt: Date;
  currentRoom?: string;
  deviceInfo?: {
    userAgent?: string;
    ipAddress?: string;
  };
}

// Error types for socket events
export interface ReservationError {
  code: string;
  message: string;
  reservationId?: number;
  conflictingReservation?: Reservation;
}

export interface ValidationSocketError {
  code: string;
  message: string;
  field?: string;
  value?: any;
}

export interface PermissionError {
  code: string;
  message: string;
  requiredRole?: string;
  action?: string;
}

// System message types
export interface SystemMessage {
  type: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  duration?: number; // Auto-dismiss after X seconds
}

export interface SystemAlert {
  level: 'low' | 'medium' | 'high' | 'critical';
  category: 'system' | 'security' | 'performance' | 'data';
  title: string;
  message: string;
  timestamp: Date;
  actions?: SystemAlertAction[];
}

export interface SystemAlertAction {
  id: string;
  label: string;
  type: 'button' | 'link';
  url?: string;
  callback?: string;
}

// Room management types
export interface RoomInfo {
  name: string;
  type: 'date' | 'global' | 'admin';
  memberCount: number;
  members: ConnectedUser[];
  createdAt: Date;
}

// Real-time conflict resolution
export interface ConflictResolution {
  conflictType: 'reservation_overlap' | 'simultaneous_edit' | 'data_race';
  conflictId: string;
  originalData: any;
  conflictingData: any;
  resolvedData?: any;
  strategy: 'last_write_wins' | 'manual_resolution' | 'merge';
  timestamp: Date;
}

// Performance monitoring
export interface PerformanceMetrics {
  eventType: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Typed socket instance
export interface TypedSocket {
  emit<T extends keyof ServerToClientEvents>(
    event: T,
    ...args: Parameters<ServerToClientEvents[T]>
  ): boolean;
  
  on<T extends keyof ClientToServerEvents>(
    event: T,
    listener: ClientToServerEvents[T]
  ): void;
  
  off<T extends keyof ClientToServerEvents>(
    event: T,
    listener?: ClientToServerEvents[T]
  ): void;
  
  join(room: string): void;
  leave(room: string): void;
  to(room: string): TypedSocket;
  
  data: SocketData;
  id: string;
  connected: boolean;
  disconnected: boolean;
}

// Socket server instance type
export interface TypedServer {
  emit<T extends keyof ServerToClientEvents>(
    event: T,
    ...args: Parameters<ServerToClientEvents[T]>
  ): boolean;
  
  to(room: string): TypedServer;
  in(room: string): TypedServer;
  
  on<T extends keyof ClientToServerEvents>(
    event: T,
    listener: (socket: TypedSocket, ...args: Parameters<ClientToServerEvents[T]>) => void
  ): void;
  
  sockets: {
    adapter: {
      rooms: Map<string, Set<string>>;
      sids: Map<string, Set<string>>;
    };
  };
}