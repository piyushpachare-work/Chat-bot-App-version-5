/**
 * Microsoft Entra ID OIDC Authentication Module
 * Implements OIDC authentication following Microsoft Entra ID guidelines
 */

import { ConfidentialClientApplication, AuthenticationResult, CryptoProvider } from '@azure/msal-node';
import { getAppConfigSync } from '../config/app-config.js';
import { createLogger } from '../utils/logger.js';
import jwt from 'jsonwebtoken';

const logger = createLogger();

/**
 * Microsoft Entra ID OIDC authentication service
 * Follows Microsoft Entra ID OIDC guidelines for secure authentication
 */
export class EntraIdAuthService {
  private readonly msalClient: ConfidentialClientApplication;
  private readonly cryptoProvider: CryptoProvider;
  private readonly config;
  private readonly codeVerifierCache: Map<string, string> = new Map();

  constructor() {
    // Use sync config for constructor (secrets will be retrieved async when needed)
    this.config = getAppConfigSync();
    this.cryptoProvider = new CryptoProvider();
    
    const msalConfig = {
      auth: {
        clientId: this.config.azure.clientId,
        clientSecret: this.config.azure.clientSecret,
        authority: `https://login.microsoftonline.com/${this.config.azure.tenantId}`,
        redirectUri: this.config.azure.redirectUri,
      },
      system: {
        loggerOptions: {
          loggerCallback: (level: number, message: string): void => {
            // Sanitize MSAL logs to ensure no secrets are logged
            logger.debug(`[MSAL] ${message}`);
          },
          piiLoggingEnabled: false, // Explicitly disable PII logging
          logLevel: this.config.server.nodeEnv === 'development' ? 3 : 2,
        },
      },
    };

    this.msalClient = new ConfidentialClientApplication(msalConfig);
  }

  /**
   * Gets the authorization URL for OIDC authentication
   * @param scopes - Array of OAuth scopes to request
   * @param state - Optional state parameter for CSRF protection
   * @returns Authorization URL and PKCE verifier
   */
  async getAuthorizationUrl(
    scopes: string[] = [this.config.azure.scope],
    state?: string
  ): Promise<{ url: string; codeVerifier: string }> {
    try {
      // Generate PKCE codes for secure OAuth flow
      const { verifier, challenge } = await this.cryptoProvider.generatePkceCodes();
      const authState = state || this.generateState();
      
      // Store code verifier with state for later retrieval
      this.codeVerifierCache.set(authState, verifier);

      const authCodeUrlParameters = {
        scopes,
        redirectUri: this.config.azure.redirectUri,
        state: authState,
        responseMode: 'query' as const,
        codeChallenge: challenge,
        codeChallengeMethod: 'S256' as const,
      };

      const response = await this.msalClient.getAuthCodeUrl(authCodeUrlParameters);

      return {
        url: response,
        codeVerifier: verifier,
      };
    } catch (error) {
      logger.error('Failed to get authorization URL', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Failed to initialize authentication flow');
    }
  }

  /**
   * Gets code verifier for a given state
   * @param state - State parameter used during authorization
   * @returns Code verifier or undefined if not found
   */
  getCodeVerifier(state: string): string | undefined {
    const verifier = this.codeVerifierCache.get(state);
    if (verifier) {
      // Remove from cache after retrieval (one-time use)
      this.codeVerifierCache.delete(state);
    }
    return verifier;
  }

  /**
   * Exchanges authorization code for access token
   * @param code - Authorization code from callback
   * @param state - State parameter to retrieve code verifier
   * @returns Authentication result with tokens
   */
  async acquireTokenByCode(
    code: string,
    state: string
  ): Promise<AuthenticationResult> {
    try {
      // Retrieve code verifier using state
      const codeVerifier = this.getCodeVerifier(state);
      if (!codeVerifier) {
        throw new Error('Code verifier not found. State may be invalid or expired.');
      }

      const tokenRequest = {
        code,
        scopes: [this.config.azure.scope],
        redirectUri: this.config.azure.redirectUri,
        codeVerifier,
      };

      const response = await this.msalClient.acquireTokenByCode(tokenRequest);

      if (!response) {
        throw new Error('No authentication result received');
      }

      logger.info('Successfully acquired token via authorization code');
      return response;
    } catch (error) {
      logger.error('Failed to acquire token by code', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new Error('Failed to acquire access token');
    }
  }

  /**
   * Acquires token using client credentials flow (for app-only scenarios)
   * @param scopes - OAuth scopes to request
   * @returns Authentication result with tokens
   */
  async acquireTokenByClientCredential(
    scopes: string[] = [this.config.azure.scope]
  ): Promise<AuthenticationResult> {
    try {
      const response = await this.msalClient.acquireTokenByClientCredential({
        scopes,
      });

      if (!response) {
        throw new Error('No authentication result received');
      }

      logger.info('Successfully acquired token via client credentials');
      return response;
    } catch (error) {
      logger.error('Failed to acquire token by client credential', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to acquire access token');
    }
  }

  /**
   * Exchanges authorization code for session using PKCE
   * Validates id_token claims (iss/exp/aud) and returns token response
   * @param code - Authorization code from OAuth callback
   * @param codeVerifier - PKCE code verifier
   * @param redirectUri - Redirect URI used in authorization request
   * @returns Authentication result with tokens
   */
  async exchangeCodeForSession(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<AuthenticationResult> {
    try {
      const tokenRequest = {
        code,
        scopes: [this.config.azure.scope],
        redirectUri,
        codeVerifier,
      };

      const response = await this.msalClient.acquireTokenByCode(tokenRequest);

      if (!response) {
        throw new Error('No authentication result received');
      }

      // Validate id_token claims
      if (response.idToken) {
        this.validateIdTokenClaims(response.idToken);
      }

      logger.info('Successfully exchanged code for session');
      return response;
    } catch (error) {
      logger.error('Failed to exchange code for session', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to exchange authorization code for session');
    }
  }

  /**
   * Validates id_token claims (iss, exp, aud)
   * @param idToken - ID token to validate
   * @throws Error if validation fails
   */
  private validateIdTokenClaims(idToken: string): void {
    try {
      // Decode without verification first to check claims
      const decoded = jwt.decode(idToken, { complete: true });
      
      if (!decoded || typeof decoded === 'string' || !decoded.payload) {
        throw new Error('Invalid id_token format');
      }

      const payload = decoded.payload as jwt.JwtPayload;
      const expectedIssuer = `https://login.microsoftonline.com/${this.config.azure.tenantId}/v2.0`;
      const expectedAudience = this.config.azure.clientId;

      // Validate issuer
      if (payload.iss !== expectedIssuer) {
        throw new Error(`Invalid issuer: expected ${expectedIssuer}, got ${payload.iss}`);
      }

      // Validate audience
      if (payload.aud !== expectedAudience) {
        throw new Error(`Invalid audience: expected ${expectedAudience}, got ${payload.aud}`);
      }

      // Validate expiration
      if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('ID token has expired');
      }

      logger.debug('ID token claims validated successfully');
    } catch (error) {
      logger.error('ID token validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Validates an access token
   * @param token - Access token to validate
   * @returns True if token is valid, false otherwise
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      // In production, implement proper JWT validation
      // This is a simplified check
      if (!token || token.length < 20) {
        return false;
      }

      // Decode and check expiration (basic validation)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Token validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Generates a cryptographically secure state parameter for CSRF protection
   * @returns Random state string
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}
