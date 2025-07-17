/**
 * Standardized API response handler
 */

import type { Response } from 'express';
import type { ApiResponse, ApiError } from '@shared/types';
import { formatApiError } from './errors';

export class ResponseHandler {
  static success<T>(res: Response, data: T, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };

    res.status(statusCode).json(response);
  }

  static error(res: Response, error: Error, statusCode: number = 500): void {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const response: ApiResponse = {
      success: false,
      error: formatApiError(error, isDevelopment),
      timestamp: new Date().toISOString()
    };

    res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data: T): void {
    ResponseHandler.success(res, data, 201);
  }

  static noContent(res: Response): void {
    res.status(204).send();
  }

  static notFound(res: Response, message: string = 'Resource not found'): void {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message
      },
      timestamp: new Date().toISOString()
    };

    res.status(404).json(response);
  }

  static badRequest(res: Response, message: string = 'Bad request'): void {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message
      },
      timestamp: new Date().toISOString()
    };

    res.status(400).json(response);
  }

  static unauthorized(res: Response, message: string = 'Unauthorized'): void {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message
      },
      timestamp: new Date().toISOString()
    };

    res.status(401).json(response);
  }

  static forbidden(res: Response, message: string = 'Forbidden'): void {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message
      },
      timestamp: new Date().toISOString()
    };

    res.status(403).json(response);
  }

  static conflict(res: Response, message: string = 'Conflict'): void {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CONFLICT',
        message
      },
      timestamp: new Date().toISOString()
    };

    res.status(409).json(response);
  }

  static internalError(res: Response, message: string = 'Internal server error'): void {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message
      },
      timestamp: new Date().toISOString()
    };

    res.status(500).json(response);
  }

  // Health check response
  static health(res: Response, checks: Record<string, boolean>): void {
    const allHealthy = Object.values(checks).every(check => check);
    const status = allHealthy ? 'healthy' : 'unhealthy';
    const statusCode = allHealthy ? 200 : 503;

    const response = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks
    };

    res.status(statusCode).json(response);
  }

  // Paginated response
  static paginated<T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number,
    statusCode: number = 200
  ): void {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const response: ApiResponse<{
      data: T[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }> = {
      success: true,
      data: {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev
        }
      },
      timestamp: new Date().toISOString()
    };

    res.status(statusCode).json(response);
  }
}

// Middleware to add response methods to res object
export const responseMiddleware = (req: any, res: any, next: any) => {
  // Add convenience methods to response object
  res.success = (data: any, statusCode?: number) => 
    ResponseHandler.success(res, data, statusCode);
  
  res.error = (error: Error, statusCode?: number) => 
    ResponseHandler.error(res, error, statusCode);
  
  res.created = (data: any) => 
    ResponseHandler.created(res, data);
  
  res.noContent = () => 
    ResponseHandler.noContent(res);
  
  res.notFound = (message?: string) => 
    ResponseHandler.notFound(res, message);
  
  res.badRequest = (message?: string) => 
    ResponseHandler.badRequest(res, message);
  
  res.unauthorized = (message?: string) => 
    ResponseHandler.unauthorized(res, message);
  
  res.forbidden = (message?: string) => 
    ResponseHandler.forbidden(res, message);
  
  res.conflict = (message?: string) => 
    ResponseHandler.conflict(res, message);
  
  res.internalError = (message?: string) => 
    ResponseHandler.internalError(res, message);
  
  res.health = (checks: Record<string, boolean>) => 
    ResponseHandler.health(res, checks);
  
  res.paginated = (data: any[], page: number, limit: number, total: number, statusCode?: number) => 
    ResponseHandler.paginated(res, data, page, limit, total, statusCode);

  next();
};

// Performance monitoring decorator
export const withPerformanceMonitoring = (fn: Function) => {
  return async (req: any, res: any, next: any) => {
    const start = process.hrtime.bigint();
    
    try {
      await fn(req, res, next);
    } finally {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      
      // Add performance headers
      res.set('X-Response-Time', `${duration}ms`);
      
      // Log slow requests
      if (duration > 1000) { // Log if request takes more than 1 second
        console.warn(`Slow request detected: ${req.method} ${req.path} - ${duration}ms`);
      }
    }
  };
};

// Request ID middleware for tracing
export const requestIdMiddleware = (req: any, res: any, next: any) => {
  const requestId = req.headers['x-request-id'] || 
                   `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  req.requestId = requestId;
  res.set('X-Request-ID', requestId);
  
  next();
};

// CORS middleware with proper configuration
export const corsMiddleware = (req: any, res: any, next: any) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.CLIENT_URL
  ].filter(Boolean);
  
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
};

// Rate limiting middleware
export const createRateLimiter = (windowMs: number = 900000, max: number = 100) => {
  const clients = new Map<string, { count: number; resetTime: number }>();
  
  return (req: any, res: any, next: any) => {
    const clientId = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Clean up old entries
    for (const [id, data] of clients.entries()) {
      if (now > data.resetTime) {
        clients.delete(id);
      }
    }
    
    const client = clients.get(clientId);
    
    if (!client) {
      clients.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }
    
    if (client.count >= max) {
      res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests, please try again later'
        },
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    client.count++;
    next();
  };
};

// Security headers middleware
export const securityMiddleware = (req: any, res: any, next: any) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};