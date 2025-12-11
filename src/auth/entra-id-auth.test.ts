/**
 * Tests for Entra ID authentication module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EntraIdAuthService } from './entra-id-auth.js';
import * as appConfig from '../config/app-config.js';

// Mock dependencies
vi.mock('../config/app-config.js');
vi.mock('../utils/logger.js');

describe('EntraIdAuthService', () => {
  let authService: EntraIdAuthService;

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

    authService = new EntraIdAuthService();
  });

  it('should initialize EntraIdAuthService', () => {
    expect(authService).toBeDefined();
  });

  it('should generate authorization URL', async () => {
    // Mock MSAL client methods
    const mockGetAuthCodeUrl = vi.fn().mockResolvedValue('https://login.microsoftonline.com/authorize?...');
    
    // Note: In a real test, you would need to properly mock the MSAL client
    // This is a simplified test structure
    const result = await authService.getAuthorizationUrl();

    expect(result).toBeDefined();
    expect(result.url).toBeDefined();
  });

  it('should validate token format', async () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const isValid = await authService.validateToken(validToken);
    expect(isValid).toBe(true);
  });

  it('should reject invalid token format', async () => {
    const invalidToken = 'invalid-token';
    const isValid = await authService.validateToken(invalidToken);
    expect(isValid).toBe(false);
  });
});
