/**
 * Main entry point for the chatbot application
 */

import dotenv from 'dotenv';
import { getAppConfig } from './config/app-config.js';
import { createLogger } from './utils/logger.js';
import { ChatbotService } from './services/chatbot-service.js';
import { createApp } from './server/app.js';

// Load environment variables
dotenv.config();

const logger = createLogger();

/**
 * Starts the chatbot application server
 */
async function startServer(): Promise<void> {
  try {
    // Load configuration (async to support Key Vault)
    const config = await getAppConfig();

    logger.info('Starting chatbot application', {
      version: '5.0.0',
      environment: config.server.nodeEnv,
      port: config.server.port,
    });

    // Initialize chatbot service
    const chatbotService = new ChatbotService();

    // Create Express app (async for swagger loading)
    const app = await createApp(chatbotService);

    // Start server
    const server = app.listen(config.server.port, () => {
      logger.info('Server started successfully', {
        port: config.server.port,
        environment: config.server.nodeEnv,
      });
    });

    // Graceful shutdown
    const shutdown = (): void => {
      logger.info('Shutting down server...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('Unhandled error in startServer', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});
