/**
 * Express application setup
 * Configures middleware and routes
 * Production-grade security and rate limiting
 */

import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { createLogger } from '../utils/logger.js';
import { ChatbotService } from '../services/chatbot-service.js';
import { createAuthRoutes } from '../routes/auth-routes.js';
import { createChatRoutes } from '../routes/chat-routes.js';
import { corsMiddleware, validateCorsConfig } from '../middleware/cors.js';
import { apiRateLimiter, authRateLimiter, healthRateLimiter } from '../middleware/rate-limit.js';
import { securityHeadersMiddleware, requireHttpsMiddleware } from '../middleware/security.js';
import { verifySession } from '../middleware/session-verify.js';
import { requestIdMiddleware } from '../middleware/request-id.js';

const logger = createLogger();

// Validate CORS configuration on startup
try {
  validateCorsConfig();
} catch (error) {
  logger.error('Invalid CORS configuration', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  throw error;
}

/**
 * Creates and configures the Express application
 * @param chatbotService - Chatbot service instance
 * @returns Configured Express app
 */
export async function createApp(chatbotService: ChatbotService): Promise<Express> {
  const app = express();

  // Security middleware (before everything else)
  app.use(securityHeadersMiddleware);
  
  // HTTPS enforcement in production
  if (process.env.NODE_ENV === 'production') {
    app.use(requireHttpsMiddleware);
  }

  // CORS middleware (strict allowlist)
  app.use(corsMiddleware);

  // Request id propagation
  app.use(requestIdMiddleware);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Request logging middleware
  app.use((req, _res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      requestId: req.requestId,
    });
    next();
  });

  // Health check endpoint (lenient rate limiting)
  app.get('/health', healthRateLimiter, (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // API documentation endpoint (if swagger is enabled)
  if (process.env.ENABLE_SWAGGER !== 'false') {
    try {
      // Dynamically import swagger-ui-express (CommonJS module)
      const swaggerUi = require('swagger-ui-express');
      const swaggerSpec = require('../docs/swagger.json');
      app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
      logger.info('Swagger UI enabled at /api-docs');
    } catch (error) {
      logger.warn('Swagger UI not available (swagger.json may need to be generated)', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Routes with rate limiting
  app.use('/auth', authRateLimiter, createAuthRoutes(chatbotService));
  app.use('/chat', apiRateLimiter, verifySession, createChatRoutes(chatbotService));

  // Root endpoint
  app.get('/', apiRateLimiter, (_req, res) => {
    res.json({
      message: 'Version 5 Chatbot App',
      version: '5.0.0',
      endpoints: {
        health: '/health',
        apiDocs: '/api-docs',
        auth: {
          login: '/auth/login',
          callback: '/auth/callback',
          logout: '/auth/logout',
        },
        chat: {
          message: 'POST /chat/message',
          history: 'GET /chat/history',
          clearSession: 'DELETE /chat/session',
        },
      },
    });
  });

  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : '[REDACTED]',
      requestId: req.requestId,
    });

    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: 'The requested resource was not found',
    });
  });

  return app;
}