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
import { EntraIdAuthService } from '../auth/entra-id-auth.js';
import { getAppConfigSync } from '../config/app-config.js';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

const logger = createLogger();
const router = Router();

// In-memory refresh token store: Map<refreshToken -> subject>
// In production, this should be stored in a secure, persistent store
const refreshStore: Map<string, string> = new Map();

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

      const { sessionId } = await chatbotService.completeAuthentication(
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
  /**
   * POST /auth/callback
   * Exchanges authorization code for session JWT
   * @swagger
   * /auth/callback:
   *   post:
   *     summary: Exchange authorization code for session JWT
   *     tags: [Authentication]
   *     description: Accepts authorization code and PKCE verifier, returns session JWT
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - code
   *               - code_verifier
   *               - redirect_uri
   *             properties:
   *               code:
   *                 type: string
   *                 description: Authorization code from OAuth provider
   *               code_verifier:
   *                 type: string
   *                 description: PKCE code verifier
   *               redirect_uri:
   *                 type: string
   *                 description: Redirect URI used in authorization request
   *     responses:
   *       200:
   *         description: Session JWT issued successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 session_jwt:
   *                   type: string
   *                 expires_in:
   *                   type: number
   *                 refresh_token:
   *                   type: string
   *       400:
   *         description: Bad request
   *       500:
   *         description: Server error
   */
  router.post('/callback', async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, code_verifier, redirect_uri } = req.body;

      if (!code || typeof code !== 'string') {
        res.status(400).json({ error: 'Authorization code is required' });
        return;
      }

      if (!code_verifier || typeof code_verifier !== 'string') {
        res.status(400).json({ error: 'Code verifier is required' });
        return;
      }

      if (!redirect_uri || typeof redirect_uri !== 'string') {
        res.status(400).json({ error: 'Redirect URI is required' });
        return;
      }

      // Exchange code for tokens using MSAL
      const authService = new EntraIdAuthService();
      const tokenResponse = await authService.exchangeCodeForSession(
        code,
        code_verifier,
        redirect_uri
      );

      // Extract user identifier from id_token
      let subject: string;
      if (tokenResponse.idToken) {
        const decoded = jwt.decode(tokenResponse.idToken) as jwt.JwtPayload;
        subject = decoded.sub || decoded.oid || 'unknown';
      } else {
        throw new Error('ID token not present in token response');
      }

      // Generate session JWT (15 minutes TTL)
      const config = getAppConfigSync();
      const sessionPayload = {
        sub: subject,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
      };

      const sessionToken = jwt.sign(sessionPayload, config.session.signingKey, {
        algorithm: 'HS256',
      });

      // Generate refresh token
      const refreshToken = randomBytes(32).toString('hex');
      refreshStore.set(refreshToken, subject);

      logger.info('Session JWT issued successfully', { subject });

      res.json({
        session_jwt: sessionToken,
        expires_in: 900, // 15 minutes in seconds
        refresh_token: refreshToken,
      });
    } catch (error) {
      logger.error('Failed to exchange code for session', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to exchange authorization code',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /auth/refresh
   * Refreshes session JWT using refresh token
   * @swagger
   * /auth/refresh:
   *   post:
   *     summary: Refresh session JWT
   *     tags: [Authentication]
   *     description: Accepts refresh token and issues new session JWT
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refresh_token
   *             properties:
   *               refresh_token:
   *                 type: string
   *                 description: Refresh token from previous authentication
   *     responses:
   *       200:
   *         description: New session JWT issued successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 session_jwt:
   *                   type: string
   *                 expires_in:
   *                   type: number
   *                 refresh_token:
   *                   type: string
   *       401:
   *         description: Invalid refresh token
   *       500:
   *         description: Server error
   */
  router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token || typeof refresh_token !== 'string') {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      // Validate refresh token
      const subject = refreshStore.get(refresh_token);
      if (!subject) {
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }

      // Invalidate old refresh token (single-use)
      refreshStore.delete(refresh_token);

      // Generate new session JWT (15 minutes TTL)
      const config = getAppConfigSync();
      const sessionPayload = {
        sub: subject,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
      };

      const sessionToken = jwt.sign(sessionPayload, config.session.signingKey, {
        algorithm: 'HS256',
      });

      // Generate new refresh token
      const newRefreshToken = randomBytes(32).toString('hex');
      refreshStore.set(newRefreshToken, subject);

      logger.info('Session JWT refreshed successfully', { subject });

      res.json({
        session_jwt: sessionToken,
        expires_in: 900, // 15 minutes in seconds
        refresh_token: newRefreshToken,
      });
    } catch (error) {
      logger.error('Failed to refresh session', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to refresh session',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

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