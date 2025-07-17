import express, { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { db } from '../lib';
import { 
  asyncHandler, 
  NotFoundError, 
  ConflictError, 
  DatabaseError, 
  FileUploadError,
  ValidationError
} from '../lib/errors';
import { 
  validateRequest, 
  ValidationSchemas, 
  validateFileUpload 
} from '../lib/validation';
import { ResponseHandler } from '../lib/response';
import type { 
  Reservation, 
  CreateReservationInput, 
  UpdateReservationInput,
  GetReservationsRequest,
  GetReservationsResponse,
  CreateReservationResponse,
  UpdateReservationResponse,
  UploadHandwritingResponse
} from '@shared/types';

const router = express.Router();

// Enhanced multer configuration with validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', '..', '..', 'data', 'png');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    cb(null, uniqueSuffix + '.png');
  },
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new FileUploadError('Only PNG files are allowed'));
    }
  }
});

// Service layer for better separation of concerns
class ReservationService {
  static async findByDate(date: string): Promise<Reservation[]> {
    try {
      const reservations = await db('reservations')
        .select('*')
        .where({ date })
        .orderBy('time_min');
      
      return reservations;
    } catch (error) {
      throw new DatabaseError('Failed to fetch reservations', error as Error);
    }
  }

  static async findById(id: number): Promise<Reservation | null> {
    try {
      const reservation = await db('reservations')
        .select('*')
        .where({ id })
        .first();
      
      return reservation || null;
    } catch (error) {
      throw new DatabaseError('Failed to fetch reservation', error as Error);
    }
  }

  static async create(data: CreateReservationInput): Promise<Reservation> {
    try {
      // Check for conflicts
      const existingReservation = await db('reservations')
        .where({
          date: data.date,
          time_min: data.time_min,
          column_index: data.column_index
        })
        .first();

      if (existingReservation) {
        throw new ConflictError('Time slot already occupied', {
          conflictingReservation: existingReservation
        });
      }

      const [id] = await db('reservations').insert({
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const newReservation = await this.findById(id);
      if (!newReservation) {
        throw new DatabaseError('Failed to retrieve created reservation');
      }

      return newReservation;
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create reservation', error as Error);
    }
  }

  static async update(id: number, data: UpdateReservationInput): Promise<Reservation> {
    try {
      const existingReservation = await this.findById(id);
      if (!existingReservation) {
        throw new NotFoundError('Reservation', id);
      }

      // Check for conflicts if time/date/column is being changed
      if (data.date || data.time_min !== undefined || data.column_index !== undefined) {
        const conflictCheck = await db('reservations')
          .where({
            date: data.date || existingReservation.date,
            time_min: data.time_min !== undefined ? data.time_min : existingReservation.time_min,
            column_index: data.column_index !== undefined ? data.column_index : existingReservation.column_index
          })
          .whereNot({ id })
          .first();

        if (conflictCheck) {
          throw new ConflictError('Time slot already occupied', {
            conflictingReservation: conflictCheck
          });
        }
      }

      const updatedRows = await db('reservations')
        .where({ id })
        .update({
          ...data,
          updated_at: new Date().toISOString()
        });

      if (updatedRows === 0) {
        throw new NotFoundError('Reservation', id);
      }

      const updatedReservation = await this.findById(id);
      if (!updatedReservation) {
        throw new DatabaseError('Failed to retrieve updated reservation');
      }

      return updatedReservation;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to update reservation', error as Error);
    }
  }

  static async delete(id: number): Promise<Reservation> {
    try {
      const reservationToDelete = await this.findById(id);
      if (!reservationToDelete) {
        throw new NotFoundError('Reservation', id);
      }

      await db('reservations').where({ id }).del();

      // Clean up handwriting file if it exists
      if (reservationToDelete.handwriting) {
        await this.deleteHandwritingFile(reservationToDelete.handwriting);
      }

      return reservationToDelete;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete reservation', error as Error);
    }
  }

  private static async deleteHandwritingFile(filename: string): Promise<void> {
    try {
      const filePath = path.join(__dirname, '..', '..', '..', 'data', 'png', filename);
      await fs.promises.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error deleting handwriting PNG:', error);
      }
    }
  }

  static async getReservationsForDate(date: string): Promise<Reservation[]> {
    return this.findByDate(date);
  }
}

// Socket.IO notification service
class NotificationService {
  static async notifyReservationsUpdated(req: Request, date: string): Promise<void> {
    try {
      const io = req.app.get('io');
      const reservations = await ReservationService.getReservationsForDate(date);
      io.to(date).emit('reservations-updated', reservations);
    } catch (error) {
      console.error('Failed to send socket notification:', error);
    }
  }
}

// Routes with comprehensive error handling and validation

// POST /api/handwriting - Upload a handwriting PNG
router.post('/handwriting', 
  upload.single('handwriting'),
  validateFileUpload(['image/png'], 5 * 1024 * 1024),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const response: UploadHandwritingResponse = {
      filename: req.file.filename,
      url: `/api/handwriting/${req.file.filename}`,
      size: req.file.size,
      mimeType: req.file.mimetype
    };

    ResponseHandler.created(res, response);
  })
);

// GET /api/reservations - Fetch reservations with comprehensive filtering
router.get('/reservations',
  validateRequest(ValidationSchemas.getReservations),
  asyncHandler(async (req: Request, res: Response) => {
    const { date, startDate, endDate, columnIndex, page = 1, limit = 100 } = req.query as GetReservationsRequest;

    let query = db('reservations').select('*');

    // Apply filters
    if (date) {
      query = query.where({ date });
    } else if (startDate && endDate) {
      query = query.whereBetween('date', [startDate, endDate]);
    } else if (startDate) {
      query = query.where('date', '>=', startDate);
    } else if (endDate) {
      query = query.where('date', '<=', endDate);
    }

    if (columnIndex !== undefined) {
      query = query.where({ column_index: columnIndex });
    }

    // Get total count for pagination
    const totalCount = await query.clone().count('id as count').first();
    const total = totalCount?.count || 0;

    // Apply pagination
    const offset = (page - 1) * limit;
    const reservations = await query
      .orderBy('date', 'asc')
      .orderBy('time_min', 'asc')
      .limit(limit)
      .offset(offset);

    const response: GetReservationsResponse = {
      reservations,
      totalCount: total as number
    };

    ResponseHandler.paginated(res, reservations, page, limit, total as number);
  })
);

// POST /api/reservations - Create a new reservation
router.post('/reservations',
  validateRequest(ValidationSchemas.createReservation),
  asyncHandler(async (req: Request, res: Response) => {
    const reservationData: CreateReservationInput = req.body;

    const newReservation = await ReservationService.create(reservationData);

    // Notify connected clients
    await NotificationService.notifyReservationsUpdated(req, newReservation.date);

    const response: CreateReservationResponse = {
      reservation: newReservation
    };

    ResponseHandler.created(res, response);
  })
);

// PUT /api/reservations/:id - Update an existing reservation
router.put('/reservations/:id',
  validateRequest(ValidationSchemas.updateReservation),
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const updateData: UpdateReservationInput = req.body;

    const updatedReservation = await ReservationService.update(id, updateData);

    // Notify connected clients
    await NotificationService.notifyReservationsUpdated(req, updatedReservation.date);

    const response: UpdateReservationResponse = {
      reservation: updatedReservation
    };

    ResponseHandler.success(res, response);
  })
);

// DELETE /api/reservations/:id - Delete a reservation
router.delete('/reservations/:id',
  validateRequest(ValidationSchemas.deleteReservation),
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);

    const deletedReservation = await ReservationService.delete(id);

    // Notify connected clients
    await NotificationService.notifyReservationsUpdated(req, deletedReservation.date);

    ResponseHandler.noContent(res);
  })
);

// GET /api/reservations/:id - Get a specific reservation
router.get('/reservations/:id',
  validateRequest({
    params: [{ field: 'id', required: true, type: 'number', min: 1 }]
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);

    const reservation = await ReservationService.findById(id);
    if (!reservation) {
      throw new NotFoundError('Reservation', id);
    }

    ResponseHandler.success(res, { reservation });
  })
);

// Health check endpoint
router.get('/health',
  asyncHandler(async (req: Request, res: Response) => {
    const checks = {
      database: false,
      filesystem: false,
      memory: false
    };

    try {
      // Database check
      await db.raw('SELECT 1');
      checks.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    try {
      // Filesystem check
      const uploadPath = path.join(__dirname, '..', '..', '..', 'data', 'png');
      await fs.promises.access(uploadPath, fs.constants.W_OK);
      checks.filesystem = true;
    } catch (error) {
      console.error('Filesystem health check failed:', error);
    }

    try {
      // Memory check
      const memUsage = process.memoryUsage();
      const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      checks.memory = memUsagePercent < 90; // Consider healthy if < 90% memory usage
    } catch (error) {
      console.error('Memory health check failed:', error);
    }

    ResponseHandler.health(res, checks);
  })
);

export default router;