/**
 * Shared domain types for the dental scheduler application
 * Used by both client and server for type safety
 */

export interface BaseEntity {
  id: number;
  created_at: string;
  updated_at: string;
}

export interface User extends BaseEntity {
  username: string;
  password_hash: string;
  role: 'admin' | 'staff';
}

export interface Reservation extends BaseEntity {
  date: string; // 'YYYY-MM-DD'
  time_min: number; // minutes since midnight (e.g., 9:00 AM = 540)
  column_index: number; // 0-based column index
  patient_name?: string;
  handwriting?: string; // PNG filename
}

export interface Holiday extends BaseEntity {
  type: 'SPECIFIC_DATE' | 'RECURRING_DAY';
  date?: string; // 'YYYY-MM-DD' for SPECIFIC_DATE
  day_of_week?: number; // 0-6 (Sun-Sat) for RECURRING_DAY
  name?: string; // Display name like '夏季休業', '定休日'
}

export interface GridConfig {
  columns: number;
  startHour: number;
  endHour: number;
  timeSlotInterval: number; // in minutes
  headerHeight: number;
  timeColumnWidth: number;
  lineColor: string;
  lineWidth: number;
  cellHeightFixed: number;
}

export interface GridState {
  canvasWidth: number;
  canvasHeight: number;
  cellWidth: number;
  cellHeight: number;
  totalSlots: number;
}

export interface Coordinates {
  column_index: number;
  time_min: number;
}

// Input types for creating/updating entities
export type CreateReservationInput = Omit<Reservation, 'id' | 'created_at' | 'updated_at'>;
export type UpdateReservationInput = Partial<CreateReservationInput> & { id: number };

export type CreateUserInput = Omit<User, 'id' | 'created_at' | 'updated_at'>;
export type UpdateUserInput = Partial<CreateUserInput> & { id: number };

export type CreateHolidayInput = Omit<Holiday, 'id' | 'created_at' | 'updated_at'>;
export type UpdateHolidayInput = Partial<CreateHolidayInput> & { id: number };

// Authentication types
export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: 'admin' | 'staff';
}

// Canvas drawing types
export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingStroke {
  points: DrawingPoint[];
  color: string;
  width: number;
}

export interface CanvasState {
  strokes: DrawingStroke[];
  isDrawing: boolean;
  currentStroke?: DrawingStroke;
}