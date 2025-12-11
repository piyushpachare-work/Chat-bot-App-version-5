/**
 * Tests for Microsoft 365 Agent integration module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Microsoft365AgentService } from './microsoft-365-agent.js';
import * as appConfig from '../config/app-config.js';

// Mock dependencies
vi.mock('../config/app-config.js');
vi.mock('../utils/logger.js');
vi.mock('@microsoft/microsoft-graph-client');

describe('Microsoft365AgentService', () => {
  let agentService: Microsoft365AgentService;

  beforeEach(() => {
    vi.mocked(appConfig.getAppConfig).mockReturnValue({
      azure: {
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        tenantId: 'test-tenant-id',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'https://graph.microsoft.com/.default',
      },
      server: {
        port: 3000,
        nodeEnv: 'test',
      },
      logging: {
        level: 'info',
      },
      chatbot: {
        name: 'TestBot',
        description: 'Test chatbot',
      },
    });

    agentService = new Microsoft365AgentService();
  });

  it('should initialize Microsoft365AgentService', () => {
    expect(agentService).toBeDefined();
  });

  it('should initialize client with access token', async () => {
    const accessToken = 'test-access-token-123';
    
    await expect(
      agentService.initializeClient(accessToken)
    ).resolves.not.toThrow();
  });

  it('should throw error when processing query without initialization', async () => {
    await expect(
      agentService.processQuery('test query')
    ).rejects.toThrow('Graph client not initialized');
  });

  it('should throw error when getting user info without initialization', async () => {
    await expect(
      agentService.getUserInfo()
    ).rejects.toThrow('Graph client not initialized');
  });

  it('should process query after initialization', async () => {
    await agentService.initializeClient('test-token');
    
    const result = await agentService.processQuery('test query', { test: 'context' });
    
    expect(result).toBeDefined();
    expect(result.response).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });
});
