/**
 * Tests for application configuration module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAppConfig } from './app-config.js';

describe('app-config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('should return configuration with valid environment variables', () => {
    process.env.AZURE_CLIENT_ID = 'test-client-id';
    process.env.AZURE_CLIENT_SECRET = 'test-client-secret';
    process.env.AZURE_TENANT_ID = 'test-tenant-id';
    process.env.AZURE_REDIRECT_URI = 'http://localhost:3000/callback';
    process.env.PORT = '3000';
    process.env.NODE_ENV = 'test';

    const config = getAppConfig();

    expect(config).toBeDefined();
    expect(config.azure.clientId).toBe('test-client-id');
    expect(config.azure.tenantId).toBe('test-tenant-id');
    expect(config.server.port).toBe(3000);
  });

  it('should use default values for optional environment variables', () => {
    process.env.AZURE_CLIENT_ID = 'test-client-id';
    process.env.AZURE_CLIENT_SECRET = 'test-secret';
    process.env.AZURE_TENANT_ID = 'test-tenant-id';

    const config = getAppConfig();

    expect(config.azure.redirectUri).toBe('http://localhost:3000/auth/callback');
    expect(config.azure.scope).toBe('https://graph.microsoft.com/.default');
    expect(config.server.port).toBe(3000);
  });

  it('should throw error when required environment variables are missing', () => {
    delete process.env.AZURE_CLIENT_ID;
    process.env.AZURE_CLIENT_SECRET = 'test-secret';
    process.env.AZURE_TENANT_ID = 'test-tenant-id';

    expect(() => getAppConfig()).toThrow('Missing required environment variables');
  });
});
