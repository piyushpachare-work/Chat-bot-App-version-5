/**
 * CORS Middleware
 * Strict allowlist-only configuration
 * No wildcards for production security
 */

import { type Request, type Response, type NextFunction } from 'express';
import { getAppConfigSync } from '../config/app-config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();
const config = getAppConfigSync();

/**
 * CORS configuration with strict allowlist
 * Only allows origins explicitly configured
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  // Check if origin is in allowlist
  if (origin && config.cors.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', config.cors.credentials ? 'true' : 'false');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Session-Id'
    );
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.setHeader('Vary', 'Origin');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
  } else if (origin) {
    // Origin not in allowlist - log and reject
    logger.warn('CORS request rejected - origin not in allowlist', {
      origin: '[REDACTED]',
      allowedOrigins: config.cors.allowedOrigins.length,
    });
    res.status(403).json({
      error: 'Forbidden',
      message: 'Origin not allowed by CORS policy',
    });
    return;
  }

  next();
}

/**
 * Validates CORS configuration
 * Throws error if wildcards are detected in production
 */
export function validateCorsConfig(): void {
  if (config.server.nodeEnv === 'production') {
    const hasWildcard = config.cors.allowedOrigins.some((origin) => origin === '*' || origin.includes('*'));

    if (hasWildcard) {
      throw new Error(
        'Wildcard CORS origins are not allowed in production. Use explicit allowlist only.'
      );
    }

    if (config.cors.allowedOrigins.length === 0) {
      throw new Error('At least one CORS origin must be configured for production');
    }
  }
}
