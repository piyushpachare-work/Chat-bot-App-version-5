/**
 * Generate Swagger/OpenAPI documentation
 * Run: node scripts/generate-swagger.js
 * Note: This file uses CommonJS for compatibility
 */

const swaggerJsdoc = require('swagger-jsdoc');
const { writeFileSync } = require('fs');
const { join } = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Version 5 Chatbot API',
      version: '5.0.0',
      description: 'Chatbot application using Microsoft Entra ID OIDC and Microsoft 365 Agents SDK',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        OAuth2: {
          type: 'oauth2',
          flows: {
            authorizationCode: {
              authorizationUrl: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize',
              tokenUrl: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token',
              scopes: {
                'https://graph.microsoft.com/.default': 'Access Microsoft Graph API',
              },
            },
          },
        },
        BearerJWT: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from OAuth2 authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        ChatMessage: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            role: { type: 'string', enum: ['user', 'assistant'] },
            content: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ChatSession: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        HealthStatus: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'OIDC authentication endpoints' },
      { name: 'Chat', description: 'Chatbot interaction endpoints' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
  },
  apis: [join(__dirname, '../src/routes/*.ts'), join(__dirname, '../src/server/app.ts')],
};

const swaggerSpec = swaggerJsdoc(options);
const outputPath = join(__dirname, '../src/docs/swagger.json');

writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
console.log(`Swagger documentation generated at ${outputPath}`);
