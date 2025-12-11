/**
 * Security Middleware
 * Additional security headers and protections
 */

import { type Request, type Response, type NextFunction } from 'express';
import { getAppConfigSync } from '../config/app-config.js';

const config = getAppConfigSync();

/**
 * Sets security headers on all responses
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // HTTPS enforcement
  if (config.server.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  next();
}

/**
 * Validates that requests use HTTPS in production
 */
export function requireHttpsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (config.server.nodeEnv === 'production') {
    // Check for proxy headers (X-Forwarded-Proto) in case of load balancer
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;

    if (protocol !== 'https') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'HTTPS is required in production',
      });
      return;
    }
  }

  next();
}
