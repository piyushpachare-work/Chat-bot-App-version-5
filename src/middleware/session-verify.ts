/**
 * Session verification middleware
 * Verifies JWT session tokens from Authorization header
 * Places user payload in req.user on success
 */

import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getAppConfigSync } from '../config/app-config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

/**
 * Express request with user payload
 */
export interface AuthenticatedRequest extends Request {
  user?: jwt.JwtPayload;
}

/**
 * Session verification middleware
 * Reads Authorization header Bearer token, verifies JWT, and sets req.user
 * Returns 401 on failure
 */
export function verifySession(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing token',
      });
      return;
    }

    // Verify JWT with session signing key
    const config = getAppConfigSync();
    const decoded = jwt.verify(token, config.session.signingKey, {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload;

    // Attach user payload to request
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid session token', {
        error: error.message,
      });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session token',
      });
      return;
    }

    logger.error('Session verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Session verification failed',
    });
  }
}
