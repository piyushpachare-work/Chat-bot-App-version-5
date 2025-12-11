/**
 * Application configuration module
 * Manages environment variables and application settings
 * Never exposes secrets in logs or errors
 * Supports Azure Key Vault for production secrets
 */

import { KeyVaultClient } from '../integrations/keyvault-client.js';

interface AppConfig {
  azure: {
    clientId: string;
    clientSecret: string;
    tenantId: string;
    redirectUri: string;
    scope: string;
    keyVaultUrl?: string;
  };
  server: {
    port: number;
    nodeEnv: string;
  };
  logging: {
    level: string;
  };
  chatbot: {
    name: string;
    description: string;
  };
  cors: {
    allowedOrigins: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

let keyVaultClient: KeyVaultClient | null = null;

/**
 * Initializes Key Vault client if configured
 */
async function initializeKeyVault(): Promise<KeyVaultClient | null> {
  const vaultUrl = process.env.AZURE_KEY_VAULT_URL;
  if (!vaultUrl) {
    return null;
  }

  try {
    return new KeyVaultClient(vaultUrl);
  } catch (error) {
    console.error('Failed to initialize Key Vault client:', error);
    return null;
  }
}

/**
 * Gets a secret value, trying Key Vault first, then environment variables
 */
async function getSecretValue(keyName: string, envVarName: string): Promise<string> {
  // Try Key Vault first if available
  if (keyVaultClient) {
    try {
      return await keyVaultClient.getSecret(keyName);
    } catch (error) {
      // Fall back to environment variable
      console.warn(`Failed to get secret from Key Vault for ${keyName}, using environment variable`);
    }
  }

  // Fall back to environment variable
  const value = process.env[envVarName];
  if (!value) {
    throw new Error(`Missing required configuration: ${keyName} (Key Vault) or ${envVarName} (environment variable)`);
  }

  return value;
}

/**
 * Validates that all required environment variables are present
 */
function validateConfig(): void {
  const requiredVars = [
    'AZURE_CLIENT_ID',
    'AZURE_TENANT_ID',
  ];

  // Client secret can come from Key Vault or environment
  const hasClientSecret = process.env.AZURE_CLIENT_SECRET || process.env.AZURE_KEY_VAULT_URL;
  if (!hasClientSecret) {
    requiredVars.push('AZURE_CLIENT_SECRET or AZURE_KEY_VAULT_URL');
  }

  const missing = requiredVars.filter((varName) => {
    if (varName.includes('or')) return false; // Already checked
    return !process.env[varName];
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Gets the application configuration from environment variables and Key Vault
 * @returns Application configuration object
 */
export async function getAppConfig(): Promise<AppConfig> {
  validateConfig();

  // Initialize Key Vault if URL is provided
  if (!keyVaultClient && process.env.AZURE_KEY_VAULT_URL) {
    keyVaultClient = await initializeKeyVault();
  }

  // Get client secret from Key Vault or environment
  let clientSecret: string;
  try {
    clientSecret = await getSecretValue('azure-client-secret', 'AZURE_CLIENT_SECRET');
  } catch {
    // Fallback for development
    clientSecret = process.env.AZURE_CLIENT_SECRET || '';
  }

  // Parse CORS allowed origins
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'];

  // Parse rate limit configuration
  const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes default
  const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

  return {
    azure: {
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret,
      tenantId: process.env.AZURE_TENANT_ID!,
      redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:3000/auth/callback',
      scope: process.env.MICROSOFT_365_SCOPE || 'https://graph.microsoft.com/.default',
      keyVaultUrl: process.env.AZURE_KEY_VAULT_URL,
    },
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
    chatbot: {
      name: process.env.CHATBOT_NAME || 'Version5Chatbot',
      description: process.env.CHATBOT_DESCRIPTION || 'Chatbot powered by Microsoft 365 Agents SDK',
    },
    cors: {
      allowedOrigins,
      credentials: process.env.CORS_CREDENTIALS === 'true',
    },
    rateLimit: {
      windowMs: rateLimitWindowMs,
      maxRequests: rateLimitMaxRequests,
    },
  };
}

/**
 * Synchronous configuration getter (for backwards compatibility)
 * Note: This will not use Key Vault secrets
 */
export function getAppConfigSync(): Omit<AppConfig, 'azure'> & { azure: Omit<AppConfig['azure'], 'clientSecret'> & { clientSecret?: string } } {
  validateConfig();

  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'];

  const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
  const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

  return {
    azure: {
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
      tenantId: process.env.AZURE_TENANT_ID!,
      redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:3000/auth/callback',
      scope: process.env.MICROSOFT_365_SCOPE || 'https://graph.microsoft.com/.default',
      keyVaultUrl: process.env.AZURE_KEY_VAULT_URL,
    },
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
    chatbot: {
      name: process.env.CHATBOT_NAME || 'Version5Chatbot',
      description: process.env.CHATBOT_DESCRIPTION || 'Chatbot powered by Microsoft 365 Agents SDK',
    },
    cors: {
      allowedOrigins,
      credentials: process.env.CORS_CREDENTIALS === 'true',
    },
    rateLimit: {
      windowMs: rateLimitWindowMs,
      maxRequests: rateLimitMaxRequests,
    },
  };
}

/**
 * Gets the Key Vault client instance
 */
export function getKeyVaultClient(): KeyVaultClient | null {
  return keyVaultClient;
}