/**
 * Tests for Entra ID authentication module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EntraIdAuthService } from './entra-id-auth.js';
import * as appConfig from '../config/app-config.js';
import { AuthenticationResult } from '@azure/msal-node';
import jwt from 'jsonwebtoken';

// Mock dependencies
vi.mock('../config/app-config.js');
vi.mock('../utils/logger.js');
vi.mock('@azure/msal-node', async () => {
  const actual = await vi.importActual('@azure/msal-node');
  return {
    ...actual,
    ConfidentialClientApplication: vi.fn().mockImplementation(() => ({
      acquireTokenByCode: vi.fn(),
      getAuthCodeUrl: vi.fn(),
    })),
  };
});

describe('EntraIdAuthService', () => {
  let authService: EntraIdAuthService;

  beforeEach(() => {
    const mockConfig = {
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
      session: {
        signingKey: 'test-signing-key',
      },
    };

    vi.mocked(appConfig.getAppConfigSync).mockReturnValue(mockConfig as any);
    vi.mocked(appConfig.getAppConfig).mockResolvedValue(mockConfig as any);

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

  describe('exchangeCodeForSession', () => {
    it('should exchange code for session and validate id_token', async () => {
      // Create a valid id_token for testing
      const idTokenPayload = {
        iss: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
        aud: 'test-client-id',
        sub: 'test-user-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const idToken = jwt.sign(idTokenPayload, 'test-secret');

      const mockTokenResponse: AuthenticationResult = {
        accessToken: 'mock-access-token',
        idToken,
        account: null,
        scopes: ['https://graph.microsoft.com/.default'],
        expiresOn: new Date(Date.now() + 3600000),
        tenantId: 'test-tenant-id',
      };

      // Mock MSAL client
      const msalClient = (authService as any).msalClient;
      vi.mocked(msalClient.acquireTokenByCode).mockResolvedValue(mockTokenResponse);

      const result = await authService.exchangeCodeForSession(
        'test-code',
        'test-code-verifier',
        'http://localhost:3000/callback'
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.idToken).toBe(idToken);
      expect(msalClient.acquireTokenByCode).toHaveBeenCalledWith({
        code: 'test-code',
        scopes: ['https://graph.microsoft.com/.default'],
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier: 'test-code-verifier',
      });
    });

    it('should throw error on invalid id_token issuer', async () => {
      const idTokenPayload = {
        iss: 'https://login.microsoftonline.com/wrong-tenant/v2.0',
        aud: 'test-client-id',
        sub: 'test-user-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const idToken = jwt.sign(idTokenPayload, 'test-secret');

      const mockTokenResponse: AuthenticationResult = {
        accessToken: 'mock-access-token',
        idToken,
        account: null,
        scopes: ['https://graph.microsoft.com/.default'],
        expiresOn: new Date(Date.now() + 3600000),
        tenantId: 'test-tenant-id',
      };

      const msalClient = (authService as any).msalClient;
      vi.mocked(msalClient.acquireTokenByCode).mockResolvedValue(mockTokenResponse);

      await expect(
        authService.exchangeCodeForSession('test-code', 'test-code-verifier', 'http://localhost:3000/callback')
      ).rejects.toThrow();
    });
  });
});
