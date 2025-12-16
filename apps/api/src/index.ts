import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import monitorRoutes from './routes/monitors';
import changesRoutes from './routes/changes';
import apiKeysRoutes from './routes/api-keys';
import usersRoutes from './routes/users';
import organizationsRoutes from './routes/organizations';
import membersRoutes from './routes/members';
import webhooksRoutes from './routes/webhooks';
import analyticsRoutes from './routes/analytics';
import adminRoutes from './routes/admin';
import auditRoutes from './routes/audit';
import notificationsRoutes from './routes/notifications';
import preferencesRoutes from './routes/preferences';
import documentsRoutes from './routes/documents';
import reportsRoutes from './routes/reports';
import changelogRoutes from './routes/changelog';
import authRoutes from './routes/auth';
import billingRoutes from './routes/billing';
import paystackWebhookRoutes from './routes/paystack-webhook';
import cronRoutes from './routes/cron';
import { authenticate, requireEmailVerification } from './middleware/auth';
import { authenticateApiKey } from './middleware/api-key';
import { conditionalRateLimiter } from './middleware/rate-limiter';
import { swaggerSpec } from './config/swagger';
import trackApiUsage from './middleware/usage-tracker';
import prisma from './db/client';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// Security Middleware
app.use(helmet());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

// Rate Limiting (applied to all routes except health/docs)
app.use(conditionalRateLimiter);

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 timestamp: { type: string, format: date-time }
 *       503:
 *         description: Service unavailable
 */
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

// OpenAPI Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Clausync API Docs',
}));
app.get('/openapi.json', (req, res) => res.json(swaggerSpec));

// Public changelog endpoint
app.use('/api/v1/changelog', changelogRoutes);

// Webhook endpoints (no auth)
app.use('/webhooks/paystack', express.raw({ type: 'application/json' }), paystackWebhookRoutes);

// Cron endpoints (protected by cron secret, not user auth)
app.use('/api/v1/cron', cronRoutes);

// Combined authentication: API Key first, then Firebase token, then email verification
const combinedAuth = [authenticateApiKey, authenticate, requireEmailVerification];

// ============ API v1 Routes (Current) ============
// Track API usage for billing (runs async, non-blocking)
app.use('/api/v1', trackApiUsage);

app.use('/api/v1/auth', combinedAuth, authRoutes);
app.use('/api/v1/monitors', combinedAuth, monitorRoutes);
app.use('/api/v1/changes', combinedAuth, changesRoutes);
app.use('/api/v1/api-keys', combinedAuth, apiKeysRoutes);
app.use('/api/v1/users', combinedAuth, usersRoutes);
app.use('/api/v1/organizations', combinedAuth, organizationsRoutes);
app.use('/api/v1/organizations/:id/members', combinedAuth, membersRoutes);
app.use('/api/v1/organizations/:id/webhooks', combinedAuth, webhooksRoutes);
app.use('/api/v1/analytics', combinedAuth, analyticsRoutes);
app.use('/api/v1/admin', combinedAuth, adminRoutes);
app.use('/api/v1/audit-logs', combinedAuth, auditRoutes);
app.use('/api/v1/notifications', combinedAuth, notificationsRoutes);
app.use('/api/v1/preferences', combinedAuth, preferencesRoutes);
app.use('/api/v1/documents', combinedAuth, documentsRoutes);
app.use('/api/v1/reports', combinedAuth, reportsRoutes);
app.use('/api/v1/billing', combinedAuth, billingRoutes);

// ============ Legacy Routes (Deprecated - will be removed in 6 months) ============
// These routes are deprecated. Use /api/v1/* instead.
import { legacyRouteDeprecation } from './middleware/deprecation';

app.use('/monitors', legacyRouteDeprecation, combinedAuth, monitorRoutes);
app.use('/changes', legacyRouteDeprecation, combinedAuth, changesRoutes);
app.use('/api-keys', legacyRouteDeprecation, combinedAuth, apiKeysRoutes);
app.use('/users', legacyRouteDeprecation, combinedAuth, usersRoutes);
app.use('/organizations', legacyRouteDeprecation, combinedAuth, organizationsRoutes);
app.use('/organizations/:id/members', legacyRouteDeprecation, combinedAuth, membersRoutes);
app.use('/organizations/:id/webhooks', legacyRouteDeprecation, combinedAuth, webhooksRoutes);
app.use('/analytics', legacyRouteDeprecation, combinedAuth, analyticsRoutes);
app.use('/admin', legacyRouteDeprecation, combinedAuth, adminRoutes);
app.use('/audit-logs', legacyRouteDeprecation, combinedAuth, auditRoutes);
app.use('/notifications', legacyRouteDeprecation, combinedAuth, notificationsRoutes);
app.use('/preferences', legacyRouteDeprecation, combinedAuth, preferencesRoutes);
app.use('/documents', legacyRouteDeprecation, combinedAuth, documentsRoutes);
app.use('/reports', legacyRouteDeprecation, combinedAuth, reportsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.listen(port, () => {
  console.log(`API Service listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Docs available at http://localhost:${port}/docs`);
});

export default app;

