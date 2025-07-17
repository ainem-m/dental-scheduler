import auth from 'basic-auth';
import bcrypt from 'bcrypt';
import { db } from '../lib';
import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any; // You can define a proper User type here later
    }
  }
}

// Authentication Middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const credentials = auth(req);

  if (!credentials) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Dental Scheduler"');
    return res.status(401).send('Authentication required.');
  }

  try {
    const user = await db('users').where({ username: credentials.name }).first();

    if (!user || !(await bcrypt.compare(credentials.pass, user.password_hash))) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Dental Scheduler"');
      return res.status(401).send('Invalid credentials.');
    }

    req.user = user; // Attach user to request
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).json({ error: 'Authentication failed.' });
  }
};

// Authorization Middleware
export const authorize = (role: string) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== role) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions.' });
  }
  next();
};