/**
 * Chat routes
 * Handles chatbot interactions
 * @swagger
 * tags:
 *   - name: Chat
 *     description: Chatbot interaction endpoints
 */

import { Router, type Request, type Response } from 'express';
import { ChatbotService } from '../services/chatbot-service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

/**
 * Request body interface for chat messages
 */
interface ChatMessageRequest {
  message: string;
  sessionId?: string;
}

/**
 * Creates chat routes with chatbot service dependency injection
 * @param chatbotService - Chatbot service instance
 * @returns Configured Express router
 */
export function createChatRoutes(chatbotService: ChatbotService): Router {
  const router = Router();

  /**
   * POST /chat/message
   * Sends a message to the chatbot
   * @swagger
   * /chat/message:
   *   post:
   *     summary: Send a message to the chatbot
   *     tags: [Chat]
   *     security:
   *       - BearerJWT: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - message
   *             properties:
   *               message:
   *                 type: string
   *                 description: User message to send to chatbot
   *                 example: "Hello, how can you help me?"
   *               sessionId:
   *                 type: string
   *                 description: Optional session ID (uses cookie if not provided)
   *     responses:
   *       200:
   *         description: Message processed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 response:
   *                   $ref: '#/components/schemas/ChatMessage'
   *       400:
   *         description: Bad request
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized
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
  router.post('/message', async (req: Request, res: Response): Promise<void> => {
    try {
      const { message, sessionId: providedSessionId }: ChatMessageRequest = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      // Get session ID from cookie or request body
      const sessionId = providedSessionId || req.cookies?.session_id;

      if (!sessionId) {
        res.status(401).json({ error: 'Not authenticated. Please login first.' });
        return;
      }

      const response = await chatbotService.processMessage(sessionId, message);

      res.json({
        success: true,
        response: {
          id: response.id,
          role: response.role,
          content: response.content,
          timestamp: response.timestamp,
        },
      });
    } catch (error) {
      logger.error('Failed to process chat message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to process message',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /chat/history
   * Gets chat history for current session
   * @swagger
   * /chat/history:
   *   get:
   *     summary: Get chat history
   *     tags: [Chat]
   *     security:
   *       - BearerJWT: []
   *     parameters:
   *       - in: query
   *         name: sessionId
   *         schema:
   *           type: string
   *         description: Session ID (uses cookie if not provided)
   *     responses:
   *       200:
   *         description: Chat history retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 session:
   *                   $ref: '#/components/schemas/ChatSession'
   *                 messages:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ChatMessage'
   *       400:
   *         description: Bad request
   *       404:
   *         description: Session not found
   *       500:
   *         description: Server error
   */
  router.get('/history', async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.cookies?.session_id || req.query.sessionId;

      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      const messages = chatbotService.getMessages(sessionId);
      const session = chatbotService.getSession(sessionId);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json({
        success: true,
        session: {
          id: session.id,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        messages: messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
      });
    } catch (error) {
      logger.error('Failed to get chat history', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to retrieve chat history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * DELETE /chat/session
   * Clears the current chat session
   * @swagger
   * /chat/session:
   *   delete:
   *     summary: Clear chat session
   *     tags: [Chat]
   *     security:
   *       - BearerJWT: []
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               sessionId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Session cleared successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       500:
   *         description: Server error
   */
  router.delete('/session', async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.cookies?.session_id || req.body.sessionId;

      if (sessionId) {
        chatbotService.clearSession(sessionId);
        res.clearCookie('session_id');
      }

      res.json({ success: true, message: 'Session cleared' });
    } catch (error) {
      logger.error('Failed to clear session', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to clear session',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}