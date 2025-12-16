/**
 * Billing Lifecycle Worker
 * 
 * HTTP-triggered worker for subscription lifecycle tasks.
 * Called by Cloud Scheduler (production) or manually (development).
 * 
 * Tasks:
 * - Trial ending soon notifications (3 days warning)
 * - Expired trial processing (convert or downgrade)
 * - Canceled subscription processing (end of period)
 */

import express from 'express';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { sendTrialEndingSoonNotifications, processExpiredTrials } from './tasks/trials';
import { processCanceledSubscriptions } from './tasks/subscriptions';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-secret';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Middleware
app.use(express.json());

// Auth middleware
function verifyCronAuth(req: express.Request): boolean {
  const authHeader = req.headers['x-cron-secret'] || req.headers['authorization'];
  if (authHeader === CRON_SECRET) return true;
  if (authHeader === `Bearer ${CRON_SECRET}`) return true;
  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

/**
 * Health check
 */
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ healthy: true, database: true });
  } catch {
    res.status(503).json({ healthy: false, database: false });
  }
});

/**
 * Run all daily billing lifecycle tasks
 * POST /run
 */
app.post('/run', async (req, res) => {
  if (!verifyCronAuth(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const startTime = Date.now();
  const results: Record<string, unknown> = {};

  try {
    console.log('=== Starting Billing Lifecycle Tasks ===');

    // 1. Trial ending soon notifications
    try {
      results.trialWarnings = await sendTrialEndingSoonNotifications();
    } catch (error) {
      console.error('Trial warnings failed:', error);
      results.trialWarningsError = String(error);
    }

    // 2. Process expired trials
    try {
      results.expiredTrials = await processExpiredTrials();
    } catch (error) {
      console.error('Expired trials failed:', error);
      results.expiredTrialsError = String(error);
    }

    // 3. Process canceled subscriptions
    try {
      results.canceledSubscriptions = await processCanceledSubscriptions();
    } catch (error) {
      console.error('Canceled subscriptions failed:', error);
      results.canceledSubscriptionsError = String(error);
    }

    const duration = Date.now() - startTime;
    console.log(`=== Billing Lifecycle Complete (${duration}ms) ===`);

    res.json({
      success: true,
      duration,
      ...results,
    });
  } catch (error) {
    console.error('Billing lifecycle failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Run trial tasks only
 * POST /trials
 */
app.post('/trials', async (req, res) => {
  if (!verifyCronAuth(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const warnings = await sendTrialEndingSoonNotifications();
    const expired = await processExpiredTrials();
    res.json({ success: true, warnings, expired });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down...');
  await pool.end();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`Billing Lifecycle Worker listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
