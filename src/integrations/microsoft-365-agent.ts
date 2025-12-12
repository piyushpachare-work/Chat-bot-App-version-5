/**
 * Microsoft 365 Agents SDK Integration Module
 * Implements Microsoft 365 Agents SDK best practices
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { createLogger } from '../utils/logger.js';
import type { AuthenticationResult } from '@azure/msal-node';
import 'isomorphic-fetch';

const logger = createLogger();

/**
 * Simple authentication provider for Microsoft Graph
 */
interface AuthProvider {
  getAccessToken: () => Promise<string>;
}

/**
 * Microsoft 365 Agent service
 * Follows Microsoft 365 Agents SDK best practices for integration
 */
export class Microsoft365AgentService {
  private graphClient: Client | null = null;
  private accessToken: string | null = null;

  constructor() {
    // Config is accessed via getAppConfigSync() when needed
  }

  /**
   * Initializes the Microsoft Graph client with authentication
   * @param token - Access token from Entra ID authentication
   */
  async initializeClient(token: string): Promise<void> {
    try {
      this.accessToken = token;

      // Create authentication provider using access token
      const authProvider: AuthProvider = {
        getAccessToken: async () => {
          if (!this.accessToken) {
            throw new Error('Access token not available');
          }
          return this.accessToken;
        },
      };

      this.graphClient = Client.initWithMiddleware({
        authProvider: authProvider as never,
        defaultVersion: 'v1.0',
      });

      logger.info('Microsoft Graph client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Microsoft Graph client', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to initialize Microsoft 365 agent');
    }
  }

  /**
   * Initializes client with authentication result
   * @param authResult - Authentication result from Entra ID
   */
  async initializeWithAuthResult(authResult: AuthenticationResult): Promise<void> {
    if (!authResult.accessToken) {
      throw new Error('Access token not available in authentication result');
    }

    await this.initializeClient(authResult.accessToken);
  }

  /**
   * Gets user information from Microsoft Graph
   * @param userId - Optional user ID, defaults to current user
   * @returns User information object
   */
  async getUserInfo(userId?: string): Promise<Record<string, unknown>> {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized. Call initializeClient first.');
    }

    try {
      const endpoint = userId 
        ? `/users/${userId}` 
        : '/me';
      
      const user = await this.graphClient.api(endpoint).get();
      
      // Sanitize user data before logging
      logger.info('Retrieved user information', {
        userId: user.id,
        displayName: '[REDACTED]',
      });

      return user;
    } catch (error) {
      logger.error('Failed to get user information', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: userId ? '[REDACTED]' : 'current',
      });
      throw new Error('Failed to retrieve user information');
    }
  }

  /**
   * Sends a message using Microsoft 365 capabilities
   * @param recipientId - ID of the recipient
   * @param message - Message content
   * @returns Message sending result
   */
  async sendMessage(
    recipientId: string,
    message: string
  ): Promise<Record<string, unknown>> {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized. Call initializeClient first.');
    }

    try {
      const messageData = {
        message: {
          subject: 'Message from Chatbot',
          body: {
            contentType: 'Text',
            content: message,
          },
          toRecipients: [
            {
              emailAddress: {
                address: recipientId,
              },
            },
          ],
        },
        saveToSentItems: true,
      };

      // Example: Send via Microsoft Graph (adjust based on actual SDK capabilities)
      const result = await this.graphClient
        .api('/me/sendMail')
        .post(messageData);

      logger.info('Message sent successfully', {
        recipientId: '[REDACTED]',
      });

      return result;
    } catch (error) {
      logger.error('Failed to send message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        recipientId: '[REDACTED]',
      });
      throw new Error('Failed to send message');
    }
  }

  /**
   * Processes a chatbot query using Microsoft 365 agent capabilities
   * @param query - User query
   * @param context - Optional context information
   * @returns Processed response
   */
  async processQuery(
    query: string,
    context?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized. Call initializeClient first.');
    }

    try {
      // Implement agent-specific query processing logic
      // This is a placeholder for actual Microsoft 365 Agents SDK integration
      
      logger.info('Processing query', {
        queryLength: query.length,
        hasContext: !!context,
      });

      // Example response structure
      return {
        response: `Processed query: ${query.substring(0, 50)}...`,
        timestamp: new Date().toISOString(),
        context,
      };
    } catch (error) {
      logger.error('Failed to process query', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to process query');
    }
  }

  /**
   * Gets the current Microsoft Graph client instance
   * @returns Graph client or null if not initialized
   */
  getClient(): Client | null {
    return this.graphClient;
  }
}