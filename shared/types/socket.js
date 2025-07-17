"use strict";
/**
 * Socket.IO event types for type-safe real-time communication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketEvents = void 0;
// Socket event names as constants for type safety
exports.SocketEvents = {
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
};
