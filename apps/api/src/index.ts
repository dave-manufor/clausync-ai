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
import { authenticate, requireEmailVerification } from './middleware/auth';
import { authenticateApiKey } from './middleware/api-key';
import { conditionalRateLimiter } from './middleware/rate-limiter';
import { swaggerSpec } from './config/swagger';
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

// Combined authentication: API Key first, then Firebase token, then email verification
const combinedAuth = [authenticateApiKey, authenticate, requireEmailVerification];

// Protected Routes
app.use('/monitors', combinedAuth, monitorRoutes);
app.use('/changes', combinedAuth, changesRoutes);
app.use('/api-keys', combinedAuth, apiKeysRoutes);
app.use('/users', combinedAuth, usersRoutes);
app.use('/organizations', combinedAuth, organizationsRoutes);
app.use('/organizations/:id/members', combinedAuth, membersRoutes);
app.use('/organizations/:id/webhooks', combinedAuth, webhooksRoutes);
app.use('/analytics', combinedAuth, analyticsRoutes);
app.use('/admin', combinedAuth, adminRoutes);
app.use('/audit-logs', combinedAuth, auditRoutes);
app.use('/notifications', combinedAuth, notificationsRoutes);
app.use('/preferences', combinedAuth, preferencesRoutes);
app.use('/documents', combinedAuth, documentsRoutes);

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

