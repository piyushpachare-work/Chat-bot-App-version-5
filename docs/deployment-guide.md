# Deployment Guide

## Prerequisites

- Azure subscription with appropriate permissions
- Azure CLI installed and configured
- Node.js 20+ and npm installed
- GitHub Actions secrets configured (for CI/CD)

## Pre-Deployment Checklist

- [ ] Azure Key Vault created and accessible
- [ ] App Registration created in Azure AD
- [ ] Required secrets stored in Key Vault
- [ ] CORS origins configured in environment variables
- [ ] Rate limiting configured appropriately
- [ ] SSL/TLS certificates obtained
- [ ] Production database configured (if applicable)
- [ ] Monitoring and logging configured (ensure reverse proxies preserve `X-Request-Id`)
- [ ] Environment values aligned with the provided `.env.example` templates

## Azure Deployment

### 1. Create Azure Resources

```bash
# Create Resource Group
az group create --name chatbot-rg --location eastus

# Create Key Vault
az keyvault create \
  --name chatbot-keyvault \
  --resource-group chatbot-rg \
  --location eastus \
  --enable-soft-delete true \
  --enable-purge-protection true

# Create App Service Plan
az appservice plan create \
  --name chatbot-plan \
  --resource-group chatbot-rg \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --name chatbot-app \
  --resource-group chatbot-rg \
  --plan chatbot-plan \
  --runtime "NODE|20-lts"
```

### 2. Configure Key Vault Access

```bash
# Get Managed Identity Object ID
PRINCIPAL_ID=$(az webapp identity show --name chatbot-app --resource-group chatbot-rg --query principalId -o tsv)

# Grant Key Vault access
az keyvault set-policy \
  --name chatbot-keyvault \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

### 3. Store Secrets in Key Vault

```bash
# Store client secret
az keyvault secret set \
  --vault-name chatbot-keyvault \
  --name azure-client-secret \
  --value "your-client-secret"

# Store signing key (if using Key Vault)
az keyvault secret set \
  --vault-name chatbot-keyvault \
  --name jwt-signing-key \
  --value "your-signing-key"
```

### 4. Configure Application Settings

```bash
az webapp config appsettings set \
  --name chatbot-app \
  --resource-group chatbot-rg \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    AZURE_CLIENT_ID="your-client-id" \
    AZURE_TENANT_ID="your-tenant-id" \
    AZURE_KEY_VAULT_URL="https://chatbot-keyvault.vault.azure.net/" \
    AZURE_REDIRECT_URI="https://chatbot-app.azurewebsites.net/auth/callback" \
    CORS_ALLOWED_ORIGINS="https://your-frontend.com,https://www.your-frontend.com" \
    CORS_CREDENTIALS="true" \
    RATE_LIMIT_WINDOW_MS="900000" \
    RATE_LIMIT_MAX_REQUESTS="100" \
    LOG_LEVEL="info"
```

### 5. Configure HTTPS

```bash
# Enable HTTPS only
az webapp update \
  --name chatbot-app \
  --resource-group chatbot-rg \
  --https-only true

# Configure custom domain SSL (if applicable)
az webapp config ssl bind \
  --name chatbot-app \
  --resource-group chatbot-rg \
  --certificate-thumbprint "thumbprint" \
  --ssl-type SNI
```

### 6. Deploy Application

#### Option A: Direct Deploy (Local Build)

```bash
# Build application
npm install
npm run build

# Deploy using Azure CLI
az webapp deploy \
  --name chatbot-app \
  --resource-group chatbot-rg \
  --src-path ./dist \
  --type zip
```

#### Option B: GitHub Actions (Recommended)

1. Configure GitHub Secrets:
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`
   - `AZURE_RESOURCE_GROUP`

2. Push to `integration/v4-master` or open a PR into `main`/`release/*` - CI will run unit tests for Node, Python, and mobile packages.

### 7. Verify Deployment

```bash
# Check health endpoint
curl https://chatbot-app.azurewebsites.net/health

# Check logs
az webapp log tail --name chatbot-app --resource-group chatbot-rg
```

## Container Deployment

### 1. Create Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 2. Build and Push to Container Registry

```bash
# Build image
docker build -t chatbot-app:latest .

# Tag for registry
docker tag chatbot-app:latest ghcr.io/your-org/chatbot-app:latest

# Push to registry
docker push ghcr.io/your-org/chatbot-app:latest
```

### 3. Deploy to Azure Container Instances or App Service

```bash
# For Azure Container Instances
az container create \
  --resource-group chatbot-rg \
  --name chatbot-container \
  --image ghcr.io/your-org/chatbot-app:latest \
  --environment-variables \
    NODE_ENV=production \
    AZURE_KEY_VAULT_URL="https://chatbot-keyvault.vault.azure.net/"
```

## Environment-Specific Configuration

### Development

```bash
# Use environment variables directly
export AZURE_CLIENT_ID="dev-client-id"
export AZURE_CLIENT_SECRET="dev-secret"
export AZURE_TENANT_ID="dev-tenant-id"
export NODE_ENV="development"
export CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
```

### Staging

```bash
# Use Key Vault with managed identity
AZURE_KEY_VAULT_URL="https://staging-keyvault.vault.azure.net/"
CORS_ALLOWED_ORIGINS="https://staging.example.com"
```

### Production

```bash
# Strict configuration
NODE_ENV="production"
AZURE_KEY_VAULT_URL="https://prod-keyvault.vault.azure.net/"
CORS_ALLOWED_ORIGINS="https://example.com,https://www.example.com"
CORS_CREDENTIALS="true"
RATE_LIMIT_MAX_REQUESTS="100"
```

## Monitoring and Logging

### Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app chatbot-insights \
  --location eastus \
  --resource-group chatbot-rg

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app chatbot-insights \
  --resource-group chatbot-rg \
  --query instrumentationKey -o tsv)

# Configure in App Service
az webapp config appsettings set \
  --name chatbot-app \
  --resource-group chatbot-rg \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY
```

### Log Analytics

- Enable diagnostic logs in Azure Portal
- Configure log retention policies
- Set up alerts for errors and performance issues

## Scaling

### Horizontal Scaling

```bash
# Enable auto-scale
az monitor autoscale create \
  --name chatbot-autoscale \
  --resource-group chatbot-rg \
  --resource /subscriptions/{sub-id}/resourceGroups/chatbot-rg/providers/Microsoft.Web/serverfarms/chatbot-plan \
  --min-count 2 \
  --max-count 10 \
  --count 2
```

### Vertical Scaling

```bash
# Scale up App Service Plan
az appservice plan update \
  --name chatbot-plan \
  --resource-group chatbot-rg \
  --sku P1V2
```

## Backup and Recovery

### Database Backup (if applicable)

- Configure automated backups
- Test restore procedures regularly
- Store backups in geo-redundant storage

### Application Configuration Backup

- Export App Service configuration regularly
- Document all environment variables
- Version control application code

## Security Hardening

1. **Enable Managed Identity** for Key Vault access
2. **Disable remote debugging** in production
3. **Enable diagnostic logs** for security auditing
4. **Configure IP restrictions** if needed
5. **Enable DDoS protection**
6. **Regular security updates** for dependencies

## Rollback Procedure

```bash
# List deployment history
az webapp deployment list-publishing-profiles \
  --name chatbot-app \
  --resource-group chatbot-rg

# Rollback to previous version
az webapp deployment source sync \
  --name chatbot-app \
  --resource-group chatbot-rg
```

## Troubleshooting

### Common Issues

1. **Key Vault Access Denied**
   - Verify managed identity is enabled
   - Check Key Vault access policies
   - Verify principal ID matches

2. **CORS Errors**
   - Verify allowed origins in configuration
   - Check for wildcards in production
   - Verify credentials setting

3. **Rate Limiting Too Strict**
   - Adjust `RATE_LIMIT_MAX_REQUESTS`
   - Check rate limit headers in responses
   - Review logs for rate limit violations

## Post-Deployment Verification

- [ ] Health endpoint returns 200
- [ ] Authentication flow works end-to-end
- [ ] Chat endpoints respond correctly
- [ ] Rate limiting is active
- [ ] CORS is configured correctly
- [ ] Logs are being captured
- [ ] Monitoring alerts are configured
- [ ] SSL certificate is valid
- [ ] All secrets retrieved from Key Vault
- [ ] No secrets in logs or errors
