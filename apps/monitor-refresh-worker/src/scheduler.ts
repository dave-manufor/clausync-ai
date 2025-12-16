/**
 * Monitor Refresh Scheduler
 * 
 * Finds monitors due for refresh based on subscription tier frequency
 * and publishes scrape commands to Pub/Sub.
 */

import { Pool } from 'pg';
import { PubSub } from '@google-cloud/pubsub';

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || '';
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'clausync-dev';
const SCRAPE_TOPIC = process.env.PUBSUB_TOPIC_SCRAPE || 'cmd.scrape_url';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10);
const CLAIM_TIMEOUT_MINUTES = 10;

// Frequency to milliseconds
const FREQUENCY_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

// Initialize clients
const pool = new Pool({ connectionString: DATABASE_URL });
const pubsub = new PubSub({ projectId: GCP_PROJECT_ID });

interface MonitorToRefresh {
  resource_id: string;
  url: string;
  selector: string;
  check_frequency: string;
}

interface SchedulerResult {
  monitorsProcessed: number;
  monitorsScheduled: number;
  errors: number;
  duration: number;
}

/**
 * Get monitors due for refresh using transactional batch claiming
 */
async function getAndClaimMonitors(): Promise<MonitorToRefresh[]> {
  const now = new Date();
  const claimExpiry = new Date(Date.now() - CLAIM_TIMEOUT_MINUTES * 60 * 1000);

  // Step 1: Find eligible monitors (without FOR UPDATE since we use GROUP BY)
  const eligibleResult = await pool.query<{ resource_id: string }>(`
    SELECT DISTINCT mr.id as resource_id
    FROM monitored_resources mr
    JOIN subscriptions s ON s.resource_id = mr.id
    JOIN users u ON s.user_id = u.id
    JOIN organizations o ON u.organization_id = o.id
    JOIN organization_subscriptions os ON os.organization_id = o.id
    WHERE 
      mr.deleted_at IS NULL
      AND s.deleted_at IS NULL
      AND s.paused_at IS NULL
      AND os.status IN ('active', 'trialing')
      AND (mr.next_check_at IS NULL OR mr.next_check_at <= $1)
      AND (mr.claimed_at IS NULL OR mr.claimed_at < $2)
    LIMIT $3
  `, [now, claimExpiry, BATCH_SIZE]);

  if (eligibleResult.rows.length === 0) {
    return [];
  }

  const resourceIds = eligibleResult.rows.map(r => r.resource_id);

  // Step 2: Claim monitors atomically (only claim unclaimed ones)
  const claimResult = await pool.query(`
    UPDATE monitored_resources 
    SET claimed_at = $1
    WHERE id = ANY($2)
      AND (claimed_at IS NULL OR claimed_at < $3)
    RETURNING id as resource_id, url_normalized as url, selector
  `, [now, resourceIds, claimExpiry]);

  if (claimResult.rows.length === 0) {
    return [];
  }

  // Step 3: Get check frequencies for claimed monitors
  const claimedIds = claimResult.rows.map((r: { resource_id: string }) => r.resource_id);
  const freqResult = await pool.query<{ resource_id: string; check_frequency: string }>(`
    SELECT DISTINCT ON (mr.id)
      mr.id as resource_id,
      st.check_frequency
    FROM monitored_resources mr
    JOIN subscriptions s ON s.resource_id = mr.id
    JOIN users u ON s.user_id = u.id
    JOIN organizations o ON u.organization_id = o.id
    JOIN organization_subscriptions os ON os.organization_id = o.id
    JOIN subscription_tiers st ON os.tier_id = st.id
    WHERE mr.id = ANY($1)
  `, [claimedIds]);

  // Merge frequency into monitors
  const freqMap = new Map(freqResult.rows.map(r => [r.resource_id, r.check_frequency]));
  return claimResult.rows.map((r: { resource_id: string; url: string; selector: string }) => ({
    resource_id: r.resource_id,
    url: r.url,
    selector: r.selector,
    check_frequency: freqMap.get(r.resource_id) || 'daily',
  }));
}

/**
 * Publish scrape command to Pub/Sub
 */
async function publishScrapeCommand(monitor: MonitorToRefresh): Promise<void> {
  const topic = pubsub.topic(SCRAPE_TOPIC);
  const data = Buffer.from(JSON.stringify({
    resource_id: monitor.resource_id,
    url: monitor.url,
    selector: monitor.selector,
    scheduled: true,
    timestamp: Date.now(),
  }));

  await topic.publishMessage({ data });
}

/**
 * Update next check time for a monitor
 */
async function updateNextCheck(resourceId: string, frequency: string): Promise<void> {
  const nextCheckAt = new Date(Date.now() + (FREQUENCY_MS[frequency] || FREQUENCY_MS.daily));
  
  await pool.query(`
    UPDATE monitored_resources 
    SET next_check_at = $1, claimed_at = NULL 
    WHERE id = $2
  `, [nextCheckAt, resourceId]);
}

/**
 * Release claim on failed monitor (so it can retry)
 */
async function releaseClaim(resourceId: string): Promise<void> {
  await pool.query(`
    UPDATE monitored_resources 
    SET claimed_at = NULL 
    WHERE id = $1
  `, [resourceId]);
}

/**
 * Main scheduler function - process all due monitors
 */
export async function scheduleMonitorRefresh(): Promise<SchedulerResult> {
  const startTime = Date.now();
  let monitorsScheduled = 0;
  let errors = 0;

  console.log('Starting monitor refresh cycle...');

  try {
    const monitors = await getAndClaimMonitors();
    console.log(`Claimed ${monitors.length} monitors for processing`);

    // Process in parallel with controlled concurrency
    const results = await Promise.allSettled(
      monitors.map(async (monitor) => {
        try {
          await publishScrapeCommand(monitor);
          await updateNextCheck(monitor.resource_id, monitor.check_frequency);
          return true;
        } catch (error) {
          console.error(`Failed to process monitor ${monitor.resource_id}:`, error);
          await releaseClaim(monitor.resource_id);
          throw error;
        }
      })
    );

    // Count results
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        monitorsScheduled++;
      } else {
        errors++;
      }
    });

    const duration = Date.now() - startTime;
    console.log(`Completed: ${monitorsScheduled} scheduled, ${errors} errors, ${duration}ms`);

    return {
      monitorsProcessed: monitors.length,
      monitorsScheduled,
      errors,
      duration,
    };
  } catch (error) {
    console.error('Scheduler error:', error);
    throw error;
  }
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ healthy: boolean; database: boolean }> {
  try {
    await pool.query('SELECT 1');
    return { healthy: true, database: true };
  } catch {
    return { healthy: false, database: false };
  }
}

/**
 * Graceful shutdown
 */
export async function shutdown(): Promise<void> {
  await pool.end();
}
