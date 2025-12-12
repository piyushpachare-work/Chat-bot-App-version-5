/**
 * Rate Limiting Middleware
 * Protects against abuse and DDoS attacks
 */

import rateLimit from 'express-rate-limit';
import { type Request, type Response } from 'express';
import { getAppConfigSync } from '../config/app-config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();
const config = getAppConfigSync();

/**
 * Creates a rate limiter with configured settings
 */
export const createRateLimiter = (options?: {
  windowMs?: number;
  maxRequests?: number;
  message?: string | { error: string; message: string };
  skipSuccessfulRequests?: boolean;
}) => {
  const defaultMessage = {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
  };
  
  const limiter = rateLimit({
    windowMs: options?.windowMs || config.rateLimit.windowMs,
    max: options?.maxRequests || config.rateLimit.maxRequests,
    message: options?.message || defaultMessage,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests: options?.skipSuccessfulRequests || false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((options?.windowMs || config.rateLimit.windowMs) / 1000),
      });
    },
  });

  return limiter;
};

/**
 * General API rate limiter
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  maxRequests: config.rateLimit.maxRequests,
});

/**
 * Strict rate limiter for authentication endpoints
 * More restrictive to prevent brute force attacks
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 requests per 15 minutes
  message: {
    error: 'Too many authentication attempts',
    message: 'Too many login attempts. Please try again later.',
  },
  skipSuccessfulRequests: true,
});

/**
 * Lenient rate limiter for health checks
 */
export const healthRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute
});
