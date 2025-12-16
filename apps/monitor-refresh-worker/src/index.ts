/**
 * Monitor Refresh Worker
 * 
 * HTTP-triggered worker for periodic monitor refresh.
 * Called by Cloud Scheduler (production) or manually (development).
 */

import express from 'express';
import * as dotenv from 'dotenv';
import { scheduleMonitorRefresh, healthCheck, shutdown } from './scheduler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-secret';

// Middleware
app.use(express.json());

// Auth middleware for cron endpoints
function verifyCronAuth(req: express.Request): boolean {
  const authHeader = req.headers['x-cron-secret'] || req.headers['authorization'];
  if (authHeader === CRON_SECRET) return true;
  if (authHeader === `Bearer ${CRON_SECRET}`) return true;
  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  const health = await healthCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

/**
 * Run monitor refresh
 * POST /run
 */
app.post('/run', async (req, res) => {
  if (!verifyCronAuth(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    console.log('Monitor refresh triggered');
    const result = await scheduleMonitorRefresh();
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Monitor refresh failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  await shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down...');
  await shutdown();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`Monitor Refresh Worker listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
