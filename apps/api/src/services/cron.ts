/**
 * Cron Jobs Service
 * 
 * Scheduled tasks for subscription management:
 * - Trial expiry reminders (3 days before)
 * - Trial expiry processing
 * - Subscription period end processing
 * 
 * Run these via Cloud Scheduler or local cron in development.
 */

import prisma from '../db/client';
import { sendTrialEndingSoonNotifications, processExpiredTrials } from './billing-notifications';
import { downgradeToFreeTier } from './subscription';

/**
 * Daily cron job - run at 00:00 UTC
 * Handles trial warnings and expirations
 */
export async function runDailyCron(): Promise<{ results: CronResult[] }> {
  const results: CronResult[] = [];
  const startTime = Date.now();

  console.log('=== Starting Daily Cron ===');

  // 1. Send trial ending soon notifications (3 days warning)
  try {
    await sendTrialEndingSoonNotifications();
    results.push({ task: 'trial_ending_soon', success: true });
  } catch (error) {
    console.error('Error sending trial ending soon notifications:', error);
    results.push({ task: 'trial_ending_soon', success: false, error: String(error) });
  }

  // 2. Process expired trials
  try {
    await processExpiredTrials();
    results.push({ task: 'process_expired_trials', success: true });
  } catch (error) {
    console.error('Error processing expired trials:', error);
    results.push({ task: 'process_expired_trials', success: false, error: String(error) });
  }

  // 3. Process subscriptions that should be downgraded (cancelAtPeriodEnd = true)
  try {
    await processCanceledSubscriptions();
    results.push({ task: 'process_canceled_subscriptions', success: true });
  } catch (error) {
    console.error('Error processing canceled subscriptions:', error);
    results.push({ task: 'process_canceled_subscriptions', success: false, error: String(error) });
  }

  const duration = Date.now() - startTime;
  console.log(`=== Daily Cron Complete (${duration}ms) ===`);

  return { results };
}

interface CronResult {
  task: string;
  success: boolean;
  error?: string;
  count?: number;
}

/**
 * Process subscriptions marked for cancellation at period end
 */
async function processCanceledSubscriptions(): Promise<void> {
  const now = new Date();

  const subscriptionsToDowngrade = await prisma.organizationSubscription.findMany({
    where: {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { lte: now },
      status: { not: 'canceled' },
    },
  });

  for (const subscription of subscriptionsToDowngrade) {
    try {
      await downgradeToFreeTier(subscription.organizationId, 'user_canceled', undefined, 'system');
      console.log(`Downgraded org ${subscription.organizationId} after period end`);
    } catch (error) {
      console.error(`Failed to downgrade org ${subscription.organizationId}:`, error);
    }
  }

  console.log(`Processed ${subscriptionsToDowngrade.length} canceled subscriptions`);
}

/**
 * Health check for cron service
 */
export async function cronHealthCheck(): Promise<{ healthy: boolean; lastRun?: Date }> {
  try {
    // Check if we can connect to database
    await prisma.$queryRaw`SELECT 1`;
    return { healthy: true };
  } catch (error) {
    return { healthy: false };
  }
}
