/**
 * Subscription Lifecycle Tasks
 * 
 * Handles subscription-related scheduled tasks:
 * - Process canceled subscriptions (cancelAtPeriodEnd)
 */

import { Pool } from 'pg';
import { PubSub } from '@google-cloud/pubsub';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });
const NOTIFY_TOPIC = process.env.PUBSUB_TOPIC_NOTIFY || 'cmd.send_notification';

/**
 * Process subscriptions marked for cancellation at period end
 */
export async function processCanceledSubscriptions(): Promise<number> {
  const now = new Date();
  let count = 0;

  // Find subscriptions to downgrade
  const result = await pool.query(`
    SELECT 
      os.organization_id,
      os.tier_id,
      st.display_name as tier_name,
      u.id as user_id,
      u.email
    FROM organization_subscriptions os
    JOIN subscription_tiers st ON os.tier_id = st.id
    JOIN organizations o ON os.organization_id = o.id
    JOIN users u ON u.organization_id = o.id AND u.role IN ('owner', 'admin')
    WHERE 
      os.cancel_at_period_end = true
      AND os.current_period_end <= $1
      AND os.status NOT IN ('canceled', 'free')
  `, [now]);

  // Get free tier ID
  const freeTierResult = await pool.query(`
    SELECT id FROM subscription_tiers WHERE name = 'free' LIMIT 1
  `);

  if (freeTierResult.rows.length === 0) {
    console.error('Free tier not found!');
    return 0;
  }

  const freeTierId = freeTierResult.rows[0].id;

  for (const row of result.rows) {
    try {
      // Downgrade to free tier
      await pool.query(`
        UPDATE organization_subscriptions
        SET 
          tier_id = $1,
          status = 'active',
          cancel_at_period_end = false,
          canceled_at = NOW(),
          updated_at = NOW()
        WHERE organization_id = $2
      `, [freeTierId, row.organization_id]);

      // Log status change
      await pool.query(`
        INSERT INTO audit_logs (id, action, entity_type, entity_id, details, created_at)
        VALUES (gen_random_uuid(), 'SUBSCRIPTION_STATUS_CHANGE', 'subscription', $1, $2, NOW())
      `, [row.organization_id, JSON.stringify({
        previousTier: row.tier_name,
        newTier: 'free',
        reason: 'user_canceled',
        triggeredBy: 'system',
      })]);

      // Send notification
      const notifResult = await pool.query(`
        INSERT INTO notifications (id, user_id, personalized_summary, risk_level, created_at)
        VALUES (gen_random_uuid(), $1, $2, 'medium', NOW())
        RETURNING id
      `, [row.user_id, `Your ${row.tier_name} subscription has ended. You've been moved to the free tier.`]);

      const topic = pubsub.topic(NOTIFY_TOPIC);
      await topic.publishMessage({
        data: Buffer.from(JSON.stringify({
          notification_id: notifResult.rows[0].id,
          user_id: row.user_id,
          email: row.email,
          subject: 'Your subscription has ended',
          summary: `Your ${row.tier_name} subscription has ended. You've been moved to the free tier.`,
          is_billing_notification: true,
          billing_notification_type: 'subscription_downgraded',
          previous_tier: row.tier_name,
        })),
      });

      count++;
      console.log(`Downgraded org ${row.organization_id} after period end`);
    } catch (error) {
      console.error(`Failed to process canceled subscription for org ${row.organization_id}:`, error);
    }
  }

  console.log(`Processed ${count} canceled subscriptions`);
  return count;
}
