# Migration Guide: Version 3 to Version 4

## Overview

This guide helps you migrate from Version 3 to Version 4 of the Chatbot Application. Version 4 introduces significant security enhancements, Azure Key Vault integration, improved authentication, and production-grade features.

## Breaking Changes

### 1. Configuration Changes

**Version 3:**
```typescript
// Direct environment variables
const config = {
  clientSecret: process.env.AZURE_CLIENT_SECRET
};
```

**Version 4:**
```typescript
// Async configuration with Key Vault support
const config = await getAppConfig();
// Falls back to environment variables if Key Vault not configured
```

**Migration Steps:**
1. Update configuration access to use async `getAppConfig()`
2. Add `AZURE_KEY_VAULT_URL` environment variable (optional for development)
3. Configure Key Vault secrets if using production deployment

### 2. Authentication Flow Updates

**Version 3:**
- Basic OAuth2 flow
- State stored in memory

**Version 4:**
- PKCE implementation (RFC 7636)
- Code verifier stored securely
- Enhanced CSRF protection

**Migration Steps:**
1. No client-side changes required
2. Backend automatically uses PKCE
3. Update callback handler if custom logic exists

### 3. Secret Management

**Version 3:**
```typescript
// Secrets from environment variables only
clientSecret: process.env.AZURE_CLIENT_SECRET
```

**Version 4:**
```typescript
// Key Vault integration with fallback
const keyVault = new KeyVaultClient(vaultUrl);
const secret = await keyVault.getSecret('azure-client-secret');
```

**Migration Steps:**
1. Create Azure Key Vault
2. Store secrets in Key Vault:
   - `azure-client-secret`
   - `jwt-signing-key` (if using)
3. Update environment variables:
   ```bash
   AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/
   ```
4. Grant managed identity access to Key Vault

### 4. CORS Configuration

**Version 3:**
```typescript
// Potentially permissive CORS
app.use(cors());
```

**Version 4:**
```typescript
// Strict allowlist only
CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com
```

**Migration Steps:**
1. List all allowed origins
2. Set `CORS_ALLOWED_ORIGINS` environment variable
3. Remove any wildcard configurations
4. Test CORS with each origin

### 5. Rate Limiting

**Version 3:**
- No rate limiting (or basic implementation)

**Version 4:**
- Express-rate-limit with configurable limits
- Different limits for auth vs API endpoints

**Migration Steps:**
1. Configure rate limits:
   ```bash
   RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
   RATE_LIMIT_MAX_REQUESTS=100
   ```
2. Test rate limiting behavior
3. Adjust limits based on usage patterns

### 6. Security Headers

**Version 3:**
- Basic security headers

**Version 4:**
- Comprehensive security headers
- HTTPS enforcement in production
- Content Security Policy

**Migration Steps:**
1. Verify HTTPS is enabled
2. Test security headers:
   ```bash
   curl -I https://your-api.com
   ```
3. Update CSP if needed for frontend

## Step-by-Step Migration

### Phase 1: Preparation

1. **Review Current Configuration**
   ```bash
   # Export current environment variables
   env | grep AZURE > v3-config.env
   env | grep CORS >> v3-config.env
   ```

2. **Create Azure Key Vault**
   ```bash
   az keyvault create \
     --name your-keyvault \
     --resource-group your-rg \
     --location eastus
   ```

3. **Migrate Secrets to Key Vault**
   ```bash
   # Store client secret
   az keyvault secret set \
     --vault-name your-keyvault \
     --name azure-client-secret \
     --value "$AZURE_CLIENT_SECRET"
   ```

### Phase 2: Code Updates

1. **Update Dependencies**
   ```bash
   npm install @azure/keyvault-secrets express-rate-limit swagger-jsdoc swagger-ui-express
   ```

2. **Update Configuration Imports**
   ```typescript
   // Old
   import { getAppConfig } from './config/app-config';
   const config = getAppConfig();
   
   // New
   import { getAppConfig } from './config/app-config.js';
   const config = await getAppConfig();
   ```

3. **Update Service Initialization**
   ```typescript
   // Old
   const authService = new EntraIdAuthService();
   
   // New - async initialization may be needed
   const config = await getAppConfig();
   const authService = new EntraIdAuthService();
   ```

4. **Update Route Handlers**
   - Ensure all route handlers that use config are async
   - Update error handling for Key Vault failures

### Phase 3: Environment Configuration

1. **Development Environment**
   ```bash
   # .env.development
   NODE_ENV=development
   AZURE_CLIENT_ID=your-dev-client-id
   AZURE_CLIENT_SECRET=your-dev-secret  # Still works, but Key Vault recommended
   AZURE_TENANT_ID=your-tenant-id
   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

2. **Production Environment**
   ```bash
   # Use Key Vault
   NODE_ENV=production
   AZURE_CLIENT_ID=your-prod-client-id
   AZURE_TENANT_ID=your-tenant-id
   AZURE_KEY_VAULT_URL=https://your-keyvault.vault.azure.net/
   CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com
   CORS_CREDENTIALS=true
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

### Phase 4: Testing

1. **Unit Tests**
   ```bash
   npm test
   ```

2. **Integration Tests**
   - Test authentication flow end-to-end
   - Verify Key Vault secret retrieval
   - Test rate limiting
   - Verify CORS with all origins

3. **Security Testing**
   - Verify no secrets in logs
   - Test HTTPS enforcement
   - Verify security headers
   - Test rate limiting limits

### Phase 5: Deployment

1. **Staging Deployment**
   ```bash
   # Deploy to staging first
   git checkout develop
   # Merge V4 changes
   git merge feature/v4-migration
   # Deploy via CI/CD or manually
   ```

2. **Production Deployment**
   ```bash
   # After staging validation
   git checkout main
   git merge develop
   # Deploy via CI/CD
   ```

3. **Post-Deployment Verification**
   - [ ] Health endpoint responds
   - [ ] Authentication works
   - [ ] All secrets from Key Vault
   - [ ] Rate limiting active
   - [ ] CORS working correctly
   - [ ] No errors in logs

## Rollback Plan

If issues occur:

1. **Quick Rollback**
   ```bash
   # Revert to previous deployment
   az webapp deployment source sync \
     --name your-app \
     --resource-group your-rg
   ```

2. **Configuration Rollback**
   - Remove `AZURE_KEY_VAULT_URL` to use env vars
   - Restore V3 CORS configuration
   - Disable rate limiting if needed

3. **Code Rollback**
   ```bash
   git revert <commit-hash>
   ```

## Common Issues and Solutions

### Issue 1: Key Vault Access Denied

**Symptom:**
```
Error: Failed to retrieve secret: azure-client-secret
```

**Solution:**
```bash
# Enable managed identity
az webapp identity assign \
  --name your-app \
  --resource-group your-rg

# Grant Key Vault access
PRINCIPAL_ID=$(az webapp identity show \
  --name your-app \
  --resource-group your-rg \
  --query principalId -o tsv)

az keyvault set-policy \
  --name your-keyvault \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

### Issue 2: CORS Errors After Migration

**Symptom:**
```
Access to fetch at 'https://api.example.com/chat/message' from origin 'https://example.com' has been blocked by CORS policy
```

**Solution:**
1. Verify origin is in `CORS_ALLOWED_ORIGINS`
2. Check `CORS_CREDENTIALS` setting
3. Verify no wildcards in production

### Issue 3: Rate Limiting Too Aggressive

**Symptom:**
```
429 Too Many Requests
```

**Solution:**
```bash
# Adjust rate limits
RATE_LIMIT_WINDOW_MS=1800000  # 30 minutes
RATE_LIMIT_MAX_REQUESTS=200
```

## Performance Considerations

Version 4 adds:
- Key Vault API calls (cached for 5 minutes)
- Rate limiting checks
- Additional security headers

Expected impact:
- ~50ms latency for first secret retrieval (subsequent cached)
- Negligible impact from rate limiting
- Minimal impact from security headers

## Checklist

- [ ] Azure Key Vault created
- [ ] Secrets migrated to Key Vault
- [ ] Managed identity configured
- [ ] Code updated for async config
- [ ] CORS origins configured
- [ ] Rate limits configured
- [ ] Tests updated and passing
- [ ] Staging deployment successful
- [ ] Production deployment successful
- [ ] Monitoring configured
- [ ] Documentation updated

## Support

For issues during migration:
1. Check logs: `az webapp log tail`
2. Review Key Vault access policies
3. Verify environment variables
4. Check CI/CD pipeline logs

## Additional Resources

- [Azure Key Vault Documentation](https://docs.microsoft.com/azure/key-vault/)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [Authentication Architecture](./auth-architecture.md)
- [Deployment Guide](./deployment-guide.md)
