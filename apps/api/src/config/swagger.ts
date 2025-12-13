import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Clausync API',
      version: '1.0.0',
      description: `
## Terms & Policy Change Monitoring API

Clausync monitors Terms of Service, Privacy Policies, and legal agreements for changes.
Get AI-powered analysis of what changed and how it affects you.

### Authentication

The API supports two authentication methods:

1. **Bearer Token** - Firebase/Identity Platform JWT
2. **API Key** - For programmatic access (recommended for integrations)

### Rate Limits

| Tier | Limit |
|------|-------|
| Unauthenticated | 20/min |
| Authenticated (Token) | 100/min |
| API Key | 1000/min |
      `,
      contact: {
        name: 'Clausync Support',
        email: 'support@clausync.ai',
      },
    },
    servers: [
      { url: 'http://localhost:8080', description: 'Development' },
      { url: 'https://api.clausync.ai', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Firebase/Identity Platform JWT token',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for programmatic access (format: clau_live_xxxx)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object' },
          },
        },
        Monitor: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            urlNormalized: { type: 'string', format: 'uri' },
            selector: { type: 'string', default: 'body' },
            currentHash: { type: 'string', nullable: true },
            lastScrapedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ChangeEvent: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            resourceId: { type: 'string', format: 'uuid' },
            globalAiSummary: { type: 'string', nullable: true },
            globalRiskScore: { type: 'integer', minimum: 0, maximum: 100, nullable: true },
            riskKeywords: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            maskedKey: { type: 'string' },
            scopes: { type: 'array', items: { type: 'string' } },
            lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            pages: { type: 'integer' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }, { apiKey: [] }],
    tags: [
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Monitors', description: 'Manage monitored resources' },
      { name: 'Changes', description: 'View change events and analysis' },
      { name: 'API Keys', description: 'Manage API keys for programmatic access' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/index.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
