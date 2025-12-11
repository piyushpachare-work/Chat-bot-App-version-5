/**
 * Authentication routes
 * Handles OIDC authentication flow
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: OIDC authentication endpoints
 */

import { Router, type Request, type Response } from 'express';
import { ChatbotService } from '../services/chatbot-service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();
const router = Router();

/**
 * GET /auth/login
 * Initiates OIDC authentication flow
 * @swagger
 * /auth/login:
 *   get:
 *     summary: Initiate OIDC authentication
 *     tags: [Authentication]
 *     description: Redirects to Microsoft Entra ID login page
 *     responses:
 *       302:
 *         description: Redirect to Microsoft Entra ID
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export function createAuthRoutes(chatbotService: ChatbotService): Router {
  router.get('/login', async (_req: Request, res: Response): Promise<void> => {
    try {
      const { url, state } = await chatbotService.initializeAuth();
      
      // Store state in session (in production, use secure session storage)
      res.cookie('auth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 600000, // 10 minutes
      });

      res.redirect(url);
    } catch (error) {
      logger.error('Failed to initiate authentication', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to initiate authentication',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /auth/callback
   * Handles OIDC callback after authentication
   * @swagger
   * /auth/callback:
   *   get:
   *     summary: OIDC callback handler
   *     tags: [Authentication]
   *     description: Handles callback from Microsoft Entra ID after authentication
   *     parameters:
   *       - in: query
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: Authorization code from OAuth provider
   *       - in: query
   *         name: state
   *         required: true
   *         schema:
   *           type: string
   *         description: State parameter for CSRF protection
   *     responses:
   *       302:
   *         description: Redirect to application root
   *       400:
   *         description: Bad request
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/callback', async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, state } = req.query;
      const storedState = req.cookies?.auth_state;

      if (!code || typeof code !== 'string') {
        res.status(400).json({ error: 'Authorization code is required' });
        return;
      }

      if (!state || state !== storedState) {
        res.status(400).json({ error: 'Invalid state parameter' });
        return;
      }

      // Clear state cookie
      res.clearCookie('auth_state');

      const { sessionId, userId } = await chatbotService.completeAuthentication(
        code,
        state as string
      );

      // Store session ID (in production, use secure session storage)
      res.cookie('session_id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600000, // 1 hour
      });

      res.redirect('/');
    } catch (error) {
      logger.error('Authentication callback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /auth/logout
   * Logs out the current user
   * @swagger
   * /auth/logout:
   *   post:
   *     summary: Logout user
   *     tags: [Authentication]
   *     security:
   *       - BearerJWT: []
   *     responses:
   *       200:
   *         description: Logout successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Logged out successfully
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/logout', async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.cookies?.session_id;

      if (sessionId) {
        chatbotService.clearSession(sessionId);
        res.clearCookie('session_id');
      }

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      logger.error('Logout failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Logout failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}