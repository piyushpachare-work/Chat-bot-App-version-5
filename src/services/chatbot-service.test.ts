/**
 * Tests for chatbot service module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatbotService } from './chatbot-service.js';
import * as entraAuth from '../auth/entra-id-auth.js';
import * as m365Agent from '../integrations/microsoft-365-agent.js';

// Mock dependencies
vi.mock('../auth/entra-id-auth.js');
vi.mock('../integrations/microsoft-365-agent.js');
vi.mock('../config/app-config.js');
vi.mock('../utils/logger.js');

describe('ChatbotService', () => {
  let chatbotService: ChatbotService;
  let mockAgentService: {
    initializeWithAuthResult: ReturnType<typeof vi.fn>;
    processQuery: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockAgentService = {
      initializeWithAuthResult: vi.fn().mockResolvedValue(undefined),
      processQuery: vi.fn().mockResolvedValue({
        response: 'Test response',
        timestamp: new Date().toISOString(),
      }),
    };

    vi.mocked(m365Agent.Microsoft365AgentService).mockImplementation(() => mockAgentService as never);

    chatbotService = new ChatbotService();
  });

  it('should initialize ChatbotService', () => {
    expect(chatbotService).toBeDefined();
  });

  it('should initialize authentication flow', async () => {
    const mockGetAuthUrl = vi.fn().mockResolvedValue({
      url: 'https://login.microsoftonline.com/authorize?...',
      codeVerifier: 'verifier123',
    });

    vi.mocked(entraAuth.EntraIdAuthService).mockImplementation(() => ({
      getAuthorizationUrl: mockGetAuthUrl,
    }) as never);

    const service = new ChatbotService();
    const result = await service.initializeAuth();

    expect(result).toBeDefined();
    expect(result.url).toBeDefined();
    expect(result.state).toBeDefined();
  });

  it('should process a message', async () => {
    // Create a session first
    const { sessionId } = await chatbotService.completeAuthentication('code123', 'state123');

    const response = await chatbotService.processMessage(sessionId, 'Hello');

    expect(response).toBeDefined();
    expect(response.role).toBe('assistant');
    expect(response.content).toBeDefined();
  });

  it('should get session messages', async () => {
    const { sessionId } = await chatbotService.completeAuthentication('code123', 'state123');
    
    await chatbotService.processMessage(sessionId, 'Test message');
    
    const messages = chatbotService.getMessages(sessionId);
    
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
  });

  it('should clear a session', async () => {
    const { sessionId } = await chatbotService.completeAuthentication('code123', 'state123');
    
    chatbotService.clearSession(sessionId);
    
    const session = chatbotService.getSession(sessionId);
    expect(session).toBeUndefined();
  });

  it('should throw error when processing message for non-existent session', async () => {
    await expect(
      chatbotService.processMessage('non-existent-session', 'Hello')
    ).rejects.toThrow('Session not found');
  });
});
