import express, { Application, Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { db } from './lib';
import { authenticate } from './middleware/auth';
import userRoutes from './routes/users';
import reservationRoutes from './routes/reservations';
import holidaysRoutes from './routes/holidays';
import initializeSocket from './socket';
import { errorHandler } from './lib/errors';
import { 
  responseMiddleware,
  requestIdMiddleware,
  corsMiddleware,
  createRateLimiter,
  securityMiddleware,
  withPerformanceMonitoring
} from './lib/response';

const app: Application = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

// Make io instance available to routes
app.set('io', io);

const PORT: number = Number(process.env.PORT) || 3000;

// Security and utility middleware
app.use(securityMiddleware);
app.use(corsMiddleware);
app.use(requestIdMiddleware);
app.use(responseMiddleware);
app.use(createRateLimiter(900000, 100)); // 15 minutes, 100 requests

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use('/api/handwriting', express.static(path.join(__dirname, '..', '..', 'data', 'png')));

// Setup Socket.IO event handlers
initializeSocket(io);

// Test DB connection
db.raw('SELECT 1')
  .then(() => console.log('Database connected successfully.'))
  .catch((err) => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.send('<h1>Dental Scheduler API</h1>');
});

// Health check endpoint (before auth)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime()
  });
});

// Apply authentication to all /api routes except health
app.use('/api', authenticate);

// Mount routers with performance monitoring
app.use('/api/users', withPerformanceMonitoring(userRoutes));
app.use('/api', withPerformanceMonitoring(reservationRoutes));
app.use('/api/holidays', withPerformanceMonitoring(holidaysRoutes));

// Error handling middleware (must be last)
app.use(errorHandler);

export function startServer(port: number, callback?: () => void) {
  return server.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🔍 Environment: ${process.env.NODE_ENV || 'development'}`);
    if (callback) callback();
  });
}

if (require.main === module) {
  startServer(PORT);
}

export { app, server, io };
