# Environment Variables Setup Guide

This document describes all required and optional environment variables for the Chatbot App.

## Frontend/TypeScript (Root Directory)

Create a `.env` file in the root directory with the following variables:

### Required Variables

```bash
# Azure/Entra ID Configuration
AZURE_CLIENT_ID=your-azure-client-id
AZURE_TENANT_ID=your-azure-tenant-id

# Client Secret - ONE of the following is required:
AZURE_CLIENT_SECRET=your-azure-client-secret
# OR
AZURE_KEY_VAULT_URL=https://your-keyvault.vault.azure.net/

# Session Configuration
SESSION_SIGNING_KEY=your-session-signing-key-min-32-chars
```

### Optional Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Azure Redirect URI
AZURE_REDIRECT_URI=http://localhost:3000/auth/callback

# Microsoft 365 Scope
MICROSOFT_365_SCOPE=https://graph.microsoft.com/.default

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Chatbot Configuration
CHATBOT_NAME=Version5Chatbot
CHATBOT_DESCRIPTION=Chatbot powered by Microsoft 365 Agents SDK

# Swagger Documentation
ENABLE_SWAGGER=true
```

## Backend/Python (backend/ Directory)

Create a `.env` file in the `backend/` directory with the following variables:

### Required Variables

```bash
# Entra ID / Azure AD Configuration
ENTRA_TENANT_ID=your-entra-tenant-id
ENTRA_CLIENT_ID=your-entra-client-id
ENTRA_CLIENT_SECRET=your-entra-client-secret

# Session Configuration - ONE of the following is required:
SESSION_SIGNING_KEY=your-session-signing-key-min-32-chars
# OR (if using Key Vault)
KEY_VAULT_URI=https://your-keyvault.vault.azure.net/
SESSION_SIGNING_KEY_NAME=session-signing-key
```

### Optional Variables

```bash
# OIDC Configuration
OIDC_REDIRECT_URI=http://localhost:3000/auth/callback
OIDC_SCOPES=["openid", "profile", "offline_access"]

# Token Store Configuration (only if NOT using Key Vault)
# If you skip KEY_VAULT_URI and TOKEN_STORE_ENCRYPTION_KEY, the backend uses an
# in-memory token cache (good for local dev; tokens reset on restart).
# Set these to persist/secure tokens without Key Vault:
# TOKEN_STORE_ENCRYPTION_KEY=your-fernet-encryption-key-base64-32-bytes
# TOKEN_STORE_DB_PATH=./.secure_tokens.db

# Session JWT Configuration
SESSION_JWT_TTL_MINUTES=15

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Copilot Studio Configuration (Required for Copilot integration)
COPILOTSTUDIOAGENT__ENVIRONMENTID=your-environment-id
COPILOTSTUDIOAGENT__SCHEMANAME=your-schema-name
COPILOTSTUDIOAGENT__AGENTAPPID=your-agent-app-id
COPILOTSTUDIOAGENT__TENANTID=your-tenant-id
```

## Quick Start

1. **Copy environment templates:**
   ```bash
   # Frontend
   cp ENV_SETUP.md .env  # Manually copy the variables you need
   
   # Backend
   cd backend
   cp ENV_SETUP.md .env  # Manually copy the variables you need
   ```

2. **Fill in your Azure credentials** from the Azure Portal

3. **Generate a secure session signing key:**
   ```bash
   # For Node.js/TypeScript
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   
   # For Python
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

4. **Start the application:**
   ```bash
   # Frontend
   npm run dev
   
   # Backend
   cd backend
   uvicorn main:app --reload
   ```

## Error Messages

If you see errors about missing environment variables, the application will now provide helpful error messages indicating exactly which variables are missing and where to set them.

## Security Notes

- Never commit `.env` files to version control
- Use Azure Key Vault for production secrets
- Rotate secrets regularly
- Use strong, randomly generated session signing keys

