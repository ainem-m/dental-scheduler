import { Server } from 'socket.io';
import { db } from '../lib';
import { 
  DatabaseError, 
  NotFoundError, 
  ConflictError, 
  ValidationError,
  formatApiError 
} from '../lib/errors';
import type { 
  SocketData,
  ConnectedUser,
  ReservationError,
  SocketEvents
} from '@shared/types';
import type { Socket } from 'socket.io';

// Enhanced socket with typed events and data
interface EnhancedSocket extends Socket {
  data: SocketData;
}

// Connection manager for tracking connected users
class ConnectionManager {
  private static instance: ConnectionManager;
  private connectedUsers = new Map<string, ConnectedUser>();
  private userSockets = new Map<number, Set<string>>();

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  addUser(socketId: string, user: ConnectedUser): void {
    this.connectedUsers.set(socketId, user);
    
    if (!this.userSockets.has(user.id)) {
      this.userSockets.set(user.id, new Set());
    }
    this.userSockets.get(user.id)!.add(socketId);
  }

  removeUser(socketId: string): ConnectedUser | null {
    const user = this.connectedUsers.get(socketId);
    if (user) {
      this.connectedUsers.delete(socketId);
      const userSocketSet = this.userSockets.get(user.id);
      if (userSocketSet) {
        userSocketSet.delete(socketId);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(user.id);
        }
      }
    }
    return user || null;
  }

  getConnectedUsers(): ConnectedUser[] {
    return Array.from(this.connectedUsers.values());
  }

  getUserSockets(userId: number): string[] {
    return Array.from(this.userSockets.get(userId) || []);
  }

  isUserConnected(userId: number): boolean {
    return this.userSockets.has(userId);
  }
}

// Service layer for socket operations
class SocketReservationService {
  static async getReservationsByDate(date: string) {
    try {
      const reservations = await db('reservations')
        .where({ date })
        .select('*')
        .orderBy('time_min');
      
      return reservations;
    } catch (error) {
      throw new DatabaseError('Failed to fetch reservations', error as Error);
    }
  }

  static async saveReservation(reservation: any) {
    try {
      let savedReservation;
      
      if (reservation.id) {
        // Update existing reservation
        const existingReservation = await db('reservations')
          .where({ id: reservation.id })
          .first();
        
        if (!existingReservation) {
          throw new NotFoundError('Reservation', reservation.id);
        }

        // Check for conflicts if position is changing
        if (
          reservation.date !== existingReservation.date ||
          reservation.time_min !== existingReservation.time_min ||
          reservation.column_index !== existingReservation.column_index
        ) {
          const conflict = await db('reservations')
            .where({
              date: reservation.date,
              time_min: reservation.time_min,
              column_index: reservation.column_index
            })
            .whereNot({ id: reservation.id })
            .first();
          
          if (conflict) {
            throw new ConflictError('Time slot already occupied', {
              conflictingReservation: conflict
            });
          }
        }

        await db('reservations')
          .where({ id: reservation.id })
          .update({
            ...reservation,
            updated_at: new Date().toISOString()
          });
        
        savedReservation = await db('reservations')
          .where({ id: reservation.id })
          .first();
      } else {
        // Create new reservation
        const conflict = await db('reservations')
          .where({
            date: reservation.date,
            time_min: reservation.time_min,
            column_index: reservation.column_index
          })
          .first();
        
        if (conflict) {
          throw new ConflictError('Time slot already occupied', {
            conflictingReservation: conflict
          });
        }

        const [id] = await db('reservations').insert({
          ...reservation,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        savedReservation = await db('reservations')
          .where({ id })
          .first();
      }

      return savedReservation;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to save reservation', error as Error);
    }
  }

  static async deleteReservation(id: number) {
    try {
      const reservationToDelete = await db('reservations')
        .where({ id })
        .first();
      
      if (!reservationToDelete) {
        throw new NotFoundError('Reservation', id);
      }

      await db('reservations').where({ id }).del();
      
      return reservationToDelete;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete reservation', error as Error);
    }
  }
}

// Enhanced error handling for socket events
class SocketErrorHandler {
  static handleError(socket: EnhancedSocket, error: Error, context?: string): void {
    console.error(`Socket error ${context ? `in ${context}` : ''}:`, error);
    
    if (error instanceof ConflictError) {
      const reservationError: ReservationError = {
        code: error.code,
        message: error.message,
        conflictingReservation: error.details?.conflictingReservation
      };
      socket.emit('reservation-error', reservationError);
    } else if (error instanceof ValidationError) {
      socket.emit('validation-error', {
        code: error.code,
        message: error.message,
        field: error.details?.field,
        value: error.details?.value
      });
    } else if (error instanceof NotFoundError) {
      socket.emit('error', formatApiError(error, false));
    } else {
      socket.emit('error', formatApiError(error, process.env.NODE_ENV === 'development'));
    }
  }
}

// Main socket initialization
export default function initializeSocket(io: Server): void {
  const connectionManager = ConnectionManager.getInstance();

  io.on('connection', (socket: EnhancedSocket) => {
    console.log(`🔌 User connected: ${socket.id}`);
    
    // Initialize socket data
    socket.data = {
      joinedRooms: [],
      lastActivity: new Date()
    };

    // Room management
    socket.on('join-date-room', (date: string) => {
      try {
        // Leave previous room if any
        if (socket.data.joinedRooms.length > 0) {
          socket.data.joinedRooms.forEach(room => {
            socket.leave(room);
          });
        }

        // Join new room
        socket.join(date);
        socket.data.joinedRooms = [date];
        socket.data.lastActivity = new Date();
        
        console.log(`📅 Socket ${socket.id} joined room ${date}`);
        
        // Notify about online users in this room
        const usersInRoom = connectionManager.getConnectedUsers()
          .filter(user => socket.data.joinedRooms.includes(date));
        
        socket.emit('users-online', usersInRoom);
      } catch (error) {
        SocketErrorHandler.handleError(socket, error as Error, 'join-date-room');
      }
    });

    socket.on('leave-date-room', (date: string) => {
      try {
        socket.leave(date);
        socket.data.joinedRooms = socket.data.joinedRooms.filter(room => room !== date);
        socket.data.lastActivity = new Date();
        
        console.log(`📅 Socket ${socket.id} left room ${date}`);
      } catch (error) {
        SocketErrorHandler.handleError(socket, error as Error, 'leave-date-room');
      }
    });

    // Reservation operations
    socket.on('fetch-reservations', async (date: string) => {
      try {
        const reservations = await SocketReservationService.getReservationsByDate(date);
        socket.emit('reservations-updated', reservations);
        socket.data.lastActivity = new Date();
      } catch (error) {
        SocketErrorHandler.handleError(socket, error as Error, 'fetch-reservations');
      }
    });

    socket.on('save-reservation', async (reservation: any) => {
      try {
        const savedReservation = await SocketReservationService.saveReservation(reservation);
        
        // Notify all users in the date room
        const reservationsForDate = await SocketReservationService.getReservationsByDate(savedReservation.date);
        io.to(savedReservation.date).emit('reservations-updated', reservationsForDate);
        
        socket.data.lastActivity = new Date();
        
        console.log(`💾 Reservation ${savedReservation.id} saved by ${socket.id}`);
      } catch (error) {
        SocketErrorHandler.handleError(socket, error as Error, 'save-reservation');
      }
    });

    socket.on('update-reservation', async (id: number, reservation: any) => {
      try {
        const updatedReservation = await SocketReservationService.saveReservation({ ...reservation, id });
        
        // Notify all users in the date room
        const reservationsForDate = await SocketReservationService.getReservationsByDate(updatedReservation.date);
        io.to(updatedReservation.date).emit('reservations-updated', reservationsForDate);
        
        socket.data.lastActivity = new Date();
        
        console.log(`✏️ Reservation ${id} updated by ${socket.id}`);
      } catch (error) {
        SocketErrorHandler.handleError(socket, error as Error, 'update-reservation');
      }
    });

    socket.on('delete-reservation', async (id: number) => {
      try {
        const deletedReservation = await SocketReservationService.deleteReservation(id);
        
        // Notify all users in the date room
        const reservationsForDate = await SocketReservationService.getReservationsByDate(deletedReservation.date);
        io.to(deletedReservation.date).emit('reservations-updated', reservationsForDate);
        
        socket.data.lastActivity = new Date();
        
        console.log(`🗑️ Reservation ${id} deleted by ${socket.id}`);
      } catch (error) {
        SocketErrorHandler.handleError(socket, error as Error, 'delete-reservation');
      }
    });

    // Connection management
    socket.on('disconnect', (reason: string) => {
      console.log(`🔌 User disconnected: ${socket.id} (reason: ${reason})`);
      
      const user = connectionManager.removeUser(socket.id);
      if (user) {
        // Notify rooms about user disconnection
        socket.data.joinedRooms.forEach(room => {
          socket.to(room).emit('user-disconnected', user.id);
        });
      }
    });

    // Error handling
    socket.on('error', (error: Error) => {
      console.error(`Socket error on ${socket.id}:`, error);
    });
  });

  // Periodic cleanup of inactive connections
  setInterval(() => {
    const now = new Date();
    const timeout = 30 * 60 * 1000; // 30 minutes
    
    io.sockets.sockets.forEach((socket: EnhancedSocket) => {
      if (socket.data.lastActivity && 
          now.getTime() - socket.data.lastActivity.getTime() > timeout) {
        console.log(`🧹 Disconnecting inactive socket: ${socket.id}`);
        socket.disconnect();
      }
    });
  }, 5 * 60 * 1000); // Check every 5 minutes

  console.log('🚀 Socket.IO server initialized with enhanced error handling');
}