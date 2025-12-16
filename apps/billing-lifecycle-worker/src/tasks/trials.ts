/**
 * Trial Lifecycle Tasks
 * 
 * Handles trial-related scheduled tasks:
 * - Send trial ending soon notifications (3 days warning)
 * - Process expired trials (convert or downgrade)
 */

import { Pool } from 'pg';
import { PubSub } from '@google-cloud/pubsub';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });
const NOTIFY_TOPIC = process.env.PUBSUB_TOPIC_NOTIFY || 'cmd.send_notification';

interface TrialResult {
  trialWarningsSent: number;
  trialsConverted: number;
  trialsDowngraded: number;
  errors: number;
}

/**
 * Send notifications to users whose trials end in 3 days
 */
export async function sendTrialEndingSoonNotifications(): Promise<number> {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  
  const startOfDay = new Date(threeDaysFromNow);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(threeDaysFromNow);
  endOfDay.setHours(23, 59, 59, 999);

  // Find trials ending in 3 days
  const result = await pool.query(`
    SELECT 
      os.organization_id,
      os.trial_ends_at,
      st.display_name as tier_name,
      u.id as user_id,
      u.email
    FROM organization_subscriptions os
    JOIN subscription_tiers st ON os.tier_id = st.id
    JOIN organizations o ON os.organization_id = o.id
    JOIN users u ON u.organization_id = o.id AND u.role IN ('owner', 'admin')
    WHERE 
      os.status = 'trialing'
      AND os.trial_ends_at >= $1
      AND os.trial_ends_at <= $2
  `, [startOfDay, endOfDay]);

  let sentCount = 0;
  for (const row of result.rows) {
    try {
      // Create notification record
      const notifResult = await pool.query(`
        INSERT INTO notifications (id, user_id, personalized_summary, risk_level, created_at)
        VALUES (gen_random_uuid(), $1, $2, 'medium', NOW())
        RETURNING id
      `, [row.user_id, `Your ${row.tier_name} trial ends in 3 days. Add a payment method to continue.`]);

      // Publish to notification worker
      const topic = pubsub.topic(NOTIFY_TOPIC);
      await topic.publishMessage({
        data: Buffer.from(JSON.stringify({
          notification_id: notifResult.rows[0].id,
          user_id: row.user_id,
          email: row.email,
          subject: 'Your trial ends in 3 days - Action required',
          summary: `Your ${row.tier_name} trial ends on ${new Date(row.trial_ends_at).toLocaleDateString()}.`,
          is_billing_notification: true,
          billing_notification_type: 'trial_ending_soon',
          tier_name: row.tier_name,
          trial_ends_at: row.trial_ends_at,
        })),
      });

      sentCount++;
    } catch (error) {
      console.error(`Failed to send trial warning for user ${row.user_id}:`, error);
    }
  }

  console.log(`Sent ${sentCount} trial ending soon notifications`);
  return sentCount;
}

/**
 * Process expired trials - convert to active or downgrade to free
 */
export async function processExpiredTrials(): Promise<{ converted: number; downgraded: number }> {
  const now = new Date();
  let converted = 0;
  let downgraded = 0;

  // Find expired trials
  const result = await pool.query(`
    SELECT 
      os.organization_id,
      os.tier_id,
      o.payment_customer_id,
      st.display_name as tier_name
    FROM organization_subscriptions os
    JOIN organizations o ON os.organization_id = o.id
    JOIN subscription_tiers st ON os.tier_id = st.id
    WHERE 
      os.status = 'trialing'
      AND os.trial_ends_at < $1
  `, [now]);

  for (const row of result.rows) {
    try {
      const hasPaymentMethod = !!row.payment_customer_id;

      if (hasPaymentMethod) {
        // Convert to active subscription
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await pool.query(`
          UPDATE organization_subscriptions
          SET 
            status = 'active',
            trial_ends_at = NULL,
            current_period_start = NOW(),
            current_period_end = $1,
            updated_at = NOW()
          WHERE organization_id = $2
        `, [periodEnd, row.organization_id]);

        await logStatusChange(row.organization_id, 'trialing', 'active', 'trial_converted');
        converted++;
      } else {
        // Downgrade to free tier
        const freeTierResult = await pool.query(`
          SELECT id FROM subscription_tiers WHERE name = 'free' LIMIT 1
        `);
        
        if (freeTierResult.rows.length > 0) {
          await pool.query(`
            UPDATE organization_subscriptions
            SET 
              tier_id = $1,
              status = 'active',
              trial_ends_at = NULL,
              updated_at = NOW()
            WHERE organization_id = $2
          `, [freeTierResult.rows[0].id, row.organization_id]);

          await logStatusChange(row.organization_id, 'trialing', 'active', 'trial_expired');
          downgraded++;
        }
      }
    } catch (error) {
      console.error(`Failed to process trial for org ${row.organization_id}:`, error);
    }
  }

  console.log(`Processed expired trials: ${converted} converted, ${downgraded} downgraded`);
  return { converted, downgraded };
}

async function logStatusChange(
  orgId: string,
  previousStatus: string,
  newStatus: string,
  reason: string
): Promise<void> {
  await pool.query(`
    INSERT INTO audit_logs (id, action, entity_type, entity_id, details, created_at)
    VALUES (gen_random_uuid(), 'SUBSCRIPTION_STATUS_CHANGE', 'subscription', $1, $2, NOW())
  `, [orgId, JSON.stringify({ previousStatus, newStatus, reason, triggeredBy: 'system' })]);
}

export { TrialResult };
