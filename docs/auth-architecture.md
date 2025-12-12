# Authentication Architecture

## Overview

This document describes the authentication architecture for Version 5 Chatbot App, including PKCE flow, token exchange, session management, and backend-to-Copilot service integration.

## Authentication Flow

The application uses Microsoft Entra ID OIDC (OpenID Connect) with PKCE (Proof Key for Code Exchange) for secure authentication.

## PKCE Flow Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant EntraID
    participant KeyVault
    participant CopilotService

    User->>Frontend: Access Application
    Frontend->>Backend: GET /auth/login
    
    Backend->>Backend: Generate PKCE codes<br/>(code_verifier, code_challenge)
    Backend->>Backend: Store code_verifier<br/>(keyed by state)
    Backend->>Backend: Generate state parameter
    Backend->>Backend: Set auth_state cookie
    
    Backend-->>Frontend: 302 Redirect to Entra ID<br/>(with code_challenge & state)
    Frontend->>EntraID: Redirect to login
    
    EntraID->>User: Show login form
    User->>EntraID: Enter credentials
    EntraID->>EntraID: Validate credentials
    
    EntraID-->>Frontend: 302 Redirect to callback<br/>(with code & state)
    Frontend->>Backend: GET /auth/callback?code=xxx&state=yyy
    
    Backend->>Backend: Validate state parameter
    Backend->>Backend: Retrieve code_verifier<br/>(using state)
    Backend->>EntraID: Exchange code for token<br/>(POST with code_verifier)
    
    EntraID-->>Backend: Access Token + ID Token
    Backend->>KeyVault: Store refresh token securely
    Backend->>Backend: Initialize Graph Client
    Backend->>Backend: Create session
    Backend->>Backend: Generate session JWT
    Backend-->>Frontend: Set session_id cookie<br/>Redirect to app
```

## Token Exchange Sequence

```mermaid
sequenceDiagram
    participant Backend
    participant EntraID
    participant KeyVault
    participant Cache

    Backend->>EntraID: POST /token<br/>grant_type=authorization_code<br/>code=xxx<br/>code_verifier=yyy
    
    EntraID-->>Backend: access_token, id_token,<br/>refresh_token, expires_in
    
    Backend->>KeyVault: setSecret("refresh-token-{userId}", refresh_token)
    Backend->>Cache: Cache access_token (TTL: expires_in)
    
    Note over Backend: Access token used for API calls<br/>Refresh token stored in Key Vault<br/>for secure rotation
```

## Session JWT Management

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant KeyVault

    User->>Frontend: Authenticated Request
    Frontend->>Backend: Request with session_id cookie
    
    Backend->>Backend: Validate session JWT signature
    Backend->>Backend: Check JWT expiration
    Backend->>Backend: Extract user info from JWT
    
    alt JWT Expired
        Backend->>KeyVault: getSecret("refresh-token-{userId}")
        KeyVault-->>Backend: refresh_token
        Backend->>EntraID: POST /token<br/>grant_type=refresh_token
        EntraID-->>Backend: New access_token + refresh_token
        Backend->>KeyVault: Update refresh_token
        Backend->>Backend: Issue new session JWT
        Backend-->>Frontend: Continue with new session
    else JWT Valid
        Backend-->>Frontend: Process request
    end
```

## Backend to Copilot Service Integration

```mermaid
sequenceDiagram
    participant User
    participant Backend
    participant KeyVault
    participant GraphClient
    participant CopilotService

    User->>Backend: POST /chat/message
    
    Backend->>Backend: Validate session JWT
    Backend->>KeyVault: getSecret("access-token-{userId}")
    
    alt Token in Cache
        KeyVault-->>Backend: Cached access_token
    else Token Not in Cache
        Backend->>KeyVault: getSecret("refresh-token-{userId}")
        KeyVault-->>Backend: refresh_token
        Backend->>EntraID: Refresh access token
        EntraID-->>Backend: New access_token
        Backend->>KeyVault: Cache new access_token
    end
    
    Backend->>GraphClient: Initialize with access_token
    Backend->>CopilotService: processQuery(message, context)
    CopilotService->>GraphClient: API calls (if needed)
    GraphClient-->>CopilotService: Data
    CopilotService-->>Backend: Processed response
    Backend-->>User: Chat response
```

## Security Considerations

### PKCE Implementation

- **Code Verifier**: Cryptographically random string (43-128 characters)
- **Code Challenge**: SHA256 hash of code verifier (base64url encoded)
- **Storage**: Code verifier stored server-side, keyed by state parameter
- **Validation**: State parameter validated on callback to prevent CSRF

### Token Storage

- **Access Tokens**: Cached in-memory with TTL (never logged)
- **Refresh Tokens**: Stored in Azure Key Vault (encrypted at rest)
- **Session JWTs**: Signed with HS256, stored in HTTP-only cookies

### Secret Management

- All secrets retrieved from Azure Key Vault in production
- Fallback to environment variables in development
- Secrets never exposed in logs or error messages
- Automatic rotation supported via Key Vault

## API Endpoints

### Authentication Endpoints

- `GET /auth/login` - Initiates PKCE flow
- `GET /auth/callback` - Handles OIDC callback
- `POST /auth/logout` - Invalidates session

### Protected Endpoints

All chat endpoints require valid session:
- `POST /chat/message` - Send message
- `GET /chat/history` - Get chat history
- `DELETE /chat/session` - Clear session

## Configuration

### Required Environment Variables

```bash
AZURE_CLIENT_ID=<app-registration-client-id>
AZURE_TENANT_ID=<azure-ad-tenant-id>
AZURE_KEY_VAULT_URL=https://<vault-name>.vault.azure.net/
AZURE_REDIRECT_URI=https://your-app.com/auth/callback
SESSION_SIGNING_KEY=<secret-key-min-32-characters-for-hs256-jwt-signing>
```

### Key Vault Secrets

- `azure-client-secret` - Application client secret
- `refresh-token-{userId}` - Per-user refresh tokens
- `signing-key` - JWT signing key (optional, can use HS256 with env var)

## Session Management

### Session JWT Structure

```json
{
  "userId": "user-id-from-entra-id",
  "sessionId": "session-uuid",
  "exp": 1234567890,
  "iat": 1234567890,
  "iss": "version-5-chatbot-app"
}
```

### Cookie Configuration

- **Name**: `session_id`
- **HttpOnly**: true (prevents XSS)
- **Secure**: true (HTTPS only in production)
- **SameSite**: strict (prevents CSRF)
- **MaxAge**: 3600 seconds (1 hour)

## Mobile App Session Token Flow

The mobile app uses Authorization Code + PKCE flow to obtain session JWTs from the middleware, stores them securely, and includes them in API requests.

### Mobile PKCE Flow Sequence

```mermaid
sequenceDiagram
    participant User
    participant Mobile
    participant SystemBrowser
    participant EntraID
    participant Middleware
    participant Backend

    User->>Mobile: Initiate login
    Mobile->>Mobile: Generate PKCE pair<br/>(code_verifier, code_challenge)
    Mobile->>SystemBrowser: Open authorization URL<br/>(with code_challenge)
    SystemBrowser->>EntraID: Redirect to login
    EntraID->>User: Show login form
    User->>EntraID: Enter credentials
    EntraID->>SystemBrowser: Redirect with authorization code
    SystemBrowser->>Mobile: Return with code
    Mobile->>Middleware: POST /auth/callback<br/>{code, code_verifier, redirect_uri}
    Middleware->>EntraID: Exchange code for tokens
    EntraID-->>Middleware: Access token + refresh token
    Middleware->>Middleware: Generate session JWT
    Middleware-->>Mobile: {session_jwt, refresh_token, expires_at}
    Mobile->>Mobile: Store tokens securely<br/>(expo SecureStore)
```

### Mobile Session Management

```mermaid
sequenceDiagram
    participant Mobile
    participant SecureStore
    participant Middleware
    participant Backend

    Mobile->>SecureStore: Read session_token
    SecureStore-->>Mobile: session_token
    Mobile->>Backend: POST /chat<br/>Authorization: Bearer <session_token>
    
    alt Session Token Valid
        Backend-->>Mobile: 200 OK with response
    else Session Token Expired (401)
        Mobile->>SecureStore: Read refresh_token
        SecureStore-->>Mobile: refresh_token
        Mobile->>Middleware: POST /auth/refresh<br/>{refresh_token}
        Middleware->>Middleware: Validate refresh token
        Middleware->>Middleware: Generate new session JWT
        Middleware-->>Mobile: {session_jwt, refresh_token, expires_at}
        Mobile->>SecureStore: Update tokens<br/>(single-use replacement)
        Mobile->>Backend: Retry POST /chat<br/>Authorization: Bearer <new_session_token>
        Backend-->>Mobile: 200 OK with response
    else Refresh Failed
        Mobile->>SecureStore: Clear all tokens
        Mobile-->>User: Prompt for re-authentication
    end
```

### Mobile Token Storage

- **Session JWT**: Stored in `expo-secure-store` with key `session_jwt`
- **Refresh Token**: Stored in `expo-secure-store` with key `refresh_token`
- **Expiration**: Stored in `expo-secure-store` with key `session_exp` (timestamp in milliseconds)
- **Security**: All tokens stored using Expo SecureStore (encrypted storage, keychain on iOS, Keystore on Android)

### Mobile API Integration

The mobile app uses an `authenticatedFetch` wrapper that:
1. Automatically adds `Authorization: Bearer <session_token>` header to requests
2. Detects 401 Unauthorized responses
3. Automatically refreshes the session token using the stored refresh token
4. Retries the original request with the new session token
5. Handles single-use refresh token replacement (middleware returns new refresh_token)
6. Clears session on refresh failure and prompts for re-authentication

### Mobile Configuration

Required environment variables (set in `mobile/.env` or `app.json`):
```bash
EXPO_PUBLIC_BACKEND_URL=https://your-middleware.com
EXPO_PUBLIC_ENTRA_CLIENT_ID=<app-registration-client-id>
EXPO_PUBLIC_ENTRA_TENANT_ID=<azure-ad-tenant-id>
EXPO_PUBLIC_ENTRA_SCOPES=openid,profile,offline_access
```

**Note**: The mobile app does NOT store client secrets. All authentication uses PKCE flow which does not require client secrets.

## Token Refresh Strategy

### Web/Backend
1. Access tokens cached with expiration time
2. On expiration, refresh token retrieved from Key Vault
3. New access token obtained from Entra ID
4. New access token cached
5. Refresh token updated in Key Vault if rotated

### Mobile
1. Session JWT stored in SecureStore with expiration
2. On 401 response, refresh token retrieved from SecureStore
3. Refresh token sent to middleware `/auth/refresh` endpoint
4. Middleware validates and returns new session JWT + refresh token
5. New tokens stored in SecureStore (single-use replacement)
6. Original request retried with new session JWT

## Error Handling

All authentication errors:
- Never expose tokens or secrets
- Use generic error messages in production
- Log detailed errors server-side (sanitized)
- Return appropriate HTTP status codes

## Middleware-Side Authoritative Identity Processor

The middleware serves as the authoritative identity processor for Microsoft Entra ID OIDC authentication. The `verifySession` middleware validates session JWTs on protected routes (e.g., `/chat`), ensuring that all requests are authenticated before processing. Session JWTs are issued with a 15-minute TTL (Time To Live) and are signed using HS256 with the `SESSION_SIGNING_KEY`. Refresh tokens are single-use tokens stored in a process-scoped in-memory map, mapping refresh tokens to user subjects. When a refresh token is used to obtain a new session JWT, the old refresh token is invalidated and a new one is issued, providing secure token rotation without requiring persistent storage.

## Compliance

- **OIDC 1.0** compliant
- **PKCE RFC 7636** compliant
- **OWASP** security guidelines followed
- **GDPR** compliant (no PII in logs)
