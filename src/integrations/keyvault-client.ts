/**
 * Azure Key Vault Client
 * Handles secure secret storage and retrieval
 * Production-grade secret management
 */

import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential, ManagedIdentityCredential, ClientSecretCredential } from '@azure/identity';
import { getAppConfig } from '../config/app-config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

/**
 * Azure Key Vault client wrapper
 * Provides secure secret management
 */
export class KeyVaultClient {
  private readonly secretClient: SecretClient;
  private readonly vaultUrl: string;
  private readonly config;
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(vaultUrl?: string) {
    this.config = getAppConfig();
    this.vaultUrl = vaultUrl || process.env.AZURE_KEY_VAULT_URL || '';

    if (!this.vaultUrl) {
      throw new Error('Azure Key Vault URL is required. Set AZURE_KEY_VAULT_URL environment variable.');
    }

    // Use Managed Identity in production, Client Secret in development
    let credential;
    if (process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET) {
      credential = new ClientSecretCredential(
        this.config.azure.tenantId,
        this.config.azure.clientId,
        this.config.azure.clientSecret
      );
    } else {
      // Use Managed Identity or DefaultAzureCredential
      credential = process.env.AZURE_CLIENT_ID
        ? new ManagedIdentityCredential({ clientId: process.env.AZURE_CLIENT_ID })
        : new DefaultAzureCredential();
    }

    this.secretClient = new SecretClient(this.vaultUrl, credential);
  }

  /**
   * Retrieves a secret from Azure Key Vault
   * Implements caching to reduce API calls
   * @param secretName - Name of the secret in Key Vault
   * @param useCache - Whether to use cached value (default: true)
   * @returns Secret value
   */
  async getSecret(secretName: string, useCache: boolean = true): Promise<string> {
    try {
      // Check cache first
      if (useCache) {
        const cached = this.cache.get(secretName);
        if (cached && cached.expiresAt > Date.now()) {
          logger.debug('Secret retrieved from cache', { secretName: '[REDACTED]' });
          return cached.value;
        }
      }

      // Retrieve from Key Vault
      const secret = await this.secretClient.getSecret(secretName);

      if (!secret.value) {
        throw new Error(`Secret ${secretName} has no value`);
      }

      // Cache the value
      if (useCache) {
        this.cache.set(secretName, {
          value: secret.value,
          expiresAt: Date.now() + this.CACHE_TTL_MS,
        });
      }

      logger.info('Secret retrieved from Key Vault', {
        secretName: '[REDACTED]',
      });

      return secret.value;
    } catch (error) {
      logger.error('Failed to retrieve secret from Key Vault', {
        error: error instanceof Error ? error.message : 'Unknown error',
        secretName: '[REDACTED]',
      });
      throw new Error(`Failed to retrieve secret: ${secretName}`);
    }
  }

  /**
   * Stores a secret in Azure Key Vault
   * @param secretName - Name of the secret
   * @param secretValue - Value to store
   * @param options - Optional secret properties
   */
  async setSecret(
    secretName: string,
    secretValue: string,
    options?: {
      contentType?: string;
      enabled?: boolean;
      expiresOn?: Date;
      notBefore?: Date;
      tags?: Record<string, string>;
    }
  ): Promise<void> {
    try {
      await this.secretClient.setSecret(secretName, secretValue, {
        contentType: options?.contentType,
        enabled: options?.enabled ?? true,
        expiresOn: options?.expiresOn,
        notBefore: options?.notBefore,
        tags: options?.tags,
      });

      // Clear cache for this secret
      this.cache.delete(secretName);

      logger.info('Secret stored in Key Vault', {
        secretName: '[REDACTED]',
      });
    } catch (error) {
      logger.error('Failed to store secret in Key Vault', {
        error: error instanceof Error ? error.message : 'Unknown error',
        secretName: '[REDACTED]',
      });
      throw new Error(`Failed to store secret: ${secretName}`);
    }
  }

  /**
   * Deletes a secret from Azure Key Vault
   * @param secretName - Name of the secret to delete
   */
  async deleteSecret(secretName: string): Promise<void> {
    try {
      const poller = await this.secretClient.beginDeleteSecret(secretName);
      await poller.pollUntilDone();

      // Clear cache
      this.cache.delete(secretName);

      logger.info('Secret deleted from Key Vault', {
        secretName: '[REDACTED]',
      });
    } catch (error) {
      logger.error('Failed to delete secret from Key Vault', {
        error: error instanceof Error ? error.message : 'Unknown error',
        secretName: '[REDACTED]',
      });
      throw new Error(`Failed to delete secret: ${secretName}`);
    }
  }

  /**
   * Lists all secrets in the vault (without values)
   * @returns Array of secret names
   */
  async listSecrets(): Promise<string[]> {
    try {
      const secrets: string[] = [];
      for await (const secretProperties of this.secretClient.listPropertiesOfSecrets()) {
        if (secretProperties.name) {
          secrets.push(secretProperties.name);
        }
      }
      return secrets;
    } catch (error) {
      logger.error('Failed to list secrets from Key Vault', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to list secrets');
    }
  }

  /**
   * Clears the secret cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Secret cache cleared');
  }

  /**
   * Checks if Key Vault is accessible
   * @returns True if accessible, false otherwise
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Try to list secrets as a health check
      await this.secretClient.listPropertiesOfSecrets().next();
      return true;
    } catch {
      return false;
    }
  }
}
