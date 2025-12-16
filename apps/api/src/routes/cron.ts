/**
 * Cron Routes
 * 
 * Endpoints for triggering scheduled tasks.
 * Protected by API key or internal service authentication.
 */

import { Router, Request, Response } from 'express';
import { runDailyCron, cronHealthCheck } from '../services/cron';
import { sendSuccess, errors } from '../middleware/response-formatter';

const router = Router();

// Verify cron secret for Cloud Scheduler
const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-secret';

function verifyCronAuth(req: Request): boolean {
  const authHeader = req.headers['x-cron-secret'] || req.headers['authorization'];
  if (authHeader === CRON_SECRET) return true;
  if (authHeader === `Bearer ${CRON_SECRET}`) return true;
  
  // Allow in development
  if (process.env.NODE_ENV === 'development') return true;
  
  return false;
}

/**
 * @openapi
 * /api/v1/cron/health:
 *   get:
 *     summary: Cron health check
 *     description: Check if cron service is healthy
 *     tags: [Cron]
 *     security: []
 *     responses:
 *       200:
 *         description: Health status
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  const health = await cronHealthCheck();
  sendSuccess(res, health);
});

/**
 * @openapi
 * /api/v1/cron/daily:
 *   post:
 *     summary: Run daily cron jobs
 *     description: Triggers trial expiry, notifications, and subscription processing
 *     tags: [Cron]
 *     security:
 *       - cronSecret: []
 *     responses:
 *       200:
 *         description: Cron results
 *       401:
 *         description: Unauthorized
 */
router.post('/daily', async (req: Request, res: Response): Promise<void> => {
  if (!verifyCronAuth(req)) {
    errors.unauthorized(res, 'Invalid cron secret');
    return;
  }

  try {
    const results = await runDailyCron();
    sendSuccess(res, results);
  } catch (error) {
    console.error('Cron execution failed:', error);
    errors.internal(res, 'Cron execution failed');
  }
});

/**
 * @openapi
 * /api/v1/cron/trial-reminders:
 *   post:
 *     summary: Send trial ending reminders
 *     description: Send notifications to users whose trials end in 3 days
 *     tags: [Cron]
 *     security:
 *       - cronSecret: []
 *     responses:
 *       200:
 *         description: Reminders sent
 */
router.post('/trial-reminders', async (req: Request, res: Response): Promise<void> => {
  if (!verifyCronAuth(req)) {
    errors.unauthorized(res, 'Invalid cron secret');
    return;
  }

  try {
    const { sendTrialEndingSoonNotifications } = await import('../services/billing-notifications');
    await sendTrialEndingSoonNotifications();
    sendSuccess(res, { message: 'Trial reminders sent' });
  } catch (error) {
    console.error('Trial reminders failed:', error);
    errors.internal(res, 'Failed to send trial reminders');
  }
});

/**
 * @openapi
 * /api/v1/cron/process-trials:
 *   post:
 *     summary: Process expired trials
 *     description: Convert or downgrade expired trials
 *     tags: [Cron]
 *     security:
 *       - cronSecret: []
 *     responses:
 *       200:
 *         description: Trials processed
 */
router.post('/process-trials', async (req: Request, res: Response): Promise<void> => {
  if (!verifyCronAuth(req)) {
    errors.unauthorized(res, 'Invalid cron secret');
    return;
  }

  try {
    const { processExpiredTrials } = await import('../services/billing-notifications');
    await processExpiredTrials();
    sendSuccess(res, { message: 'Expired trials processed' });
  } catch (error) {
    console.error('Process trials failed:', error);
    errors.internal(res, 'Failed to process trials');
  }
});

export default router;
