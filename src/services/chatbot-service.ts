/**
 * Core Chatbot Service Module
 * Orchestrates authentication and Microsoft 365 agent interactions
 */

import { EntraIdAuthService } from '../auth/entra-id-auth.js';
import { Microsoft365AgentService } from '../integrations/microsoft-365-agent.js';
import { getAppConfigSync } from '../config/app-config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();
// Use sync config for module-level initialization
const config = getAppConfigSync();

/**
 * Chat message interface
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Chat session interface
 */
export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Core chatbot service
 * Integrates Entra ID authentication with Microsoft 365 Agents SDK
 */
export class ChatbotService {
  private readonly authService: EntraIdAuthService;
  private readonly agentService: Microsoft365AgentService;
  private readonly sessions: Map<string, ChatSession>;

  constructor() {
    this.authService = new EntraIdAuthService();
    this.agentService = new Microsoft365AgentService();
    this.sessions = new Map<string, ChatSession>();
  }

  /**
   * Initializes authentication flow for a user
   * @returns Authorization URL and state
   */
  async initializeAuth(): Promise<{ url: string; state: string }> {
    try {
      const state = this.generateSessionId();
      const scope = config.azure.scope || 'https://graph.microsoft.com/.default';
      const { url } = await this.authService.getAuthorizationUrl(
        [scope],
        state
      );

      logger.info('Authentication flow initialized', {
        state: '[REDACTED]',
      });

      return { url, state };
    } catch (error) {
      logger.error('Failed to initialize authentication', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Completes authentication and initializes agent service
   * @param code - Authorization code from callback
   * @param state - State parameter for validation and code verifier retrieval
   * @returns Authentication result and session ID
   */
  async completeAuthentication(
    code: string,
    state: string
  ): Promise<{ sessionId: string; userId: string }> {
    try {
      // In production, validate state parameter against stored value
      const authResult = await this.authService.acquireTokenByCode(code, state);

      if (!authResult.account) {
        throw new Error('No account information in authentication result');
      }

      await this.agentService.initializeWithAuthResult(authResult);

      const sessionId = this.generateSessionId();
      const userId = authResult.account.homeAccountId;

      // Create new session
      const session: ChatSession = {
        id: sessionId,
        userId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.sessions.set(sessionId, session);

      logger.info('Authentication completed successfully', {
        sessionId: '[REDACTED]',
        userId: '[REDACTED]',
      });

      return { sessionId, userId };
    } catch (error) {
      logger.error('Failed to complete authentication', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Processes a chat message
   * @param sessionId - Chat session ID
   * @param message - User message
   * @returns Assistant response
   */
  async processMessage(
    sessionId: string,
    message: string
  ): Promise<ChatMessage> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Add user message to session
      const userMessage: ChatMessage = {
        id: this.generateMessageId(),
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      session.messages.push(userMessage);
      session.updatedAt = new Date();

      // Process query through Microsoft 365 agent
      const agentResponse = await this.agentService.processQuery(message, {
        sessionId,
        userId: session.userId,
      });

      // Create assistant response
      const assistantMessage: ChatMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: typeof agentResponse.response === 'string' 
          ? agentResponse.response 
          : JSON.stringify(agentResponse),
        timestamp: new Date(),
        metadata: agentResponse,
      };

      session.messages.push(assistantMessage);
      session.updatedAt = new Date();

      logger.info('Message processed successfully', {
        sessionId: '[REDACTED]',
        messageId: assistantMessage.id,
      });

      return assistantMessage;
    } catch (error) {
      logger.error('Failed to process message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: '[REDACTED]',
      });
      throw error;
    }
  }

  /**
   * Gets chat session history
   * @param sessionId - Chat session ID
   * @returns Chat session with messages
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Gets all messages for a session
   * @param sessionId - Chat session ID
   * @returns Array of chat messages
   */
  getMessages(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    return session?.messages || [];
  }

  /**
   * Clears a chat session
   * @param sessionId - Chat session ID
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    logger.info('Session cleared', {
      sessionId: '[REDACTED]',
    });
  }

  /**
   * Generates a unique session ID
   * @returns Session ID string
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generates a unique message ID
   * @returns Message ID string
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
