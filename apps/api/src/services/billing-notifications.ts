/**
 * Billing Notifications Service
 * 
 * Sends billing email notifications via the notification worker (Pub/Sub).
 * All notifications are logged for compliance.
 * 
 * Architecture:
 * API -> Pub/Sub (cmd.send_notification) -> notification-worker -> Resend
 */

import prisma from '../db/client';
import { publishMessage } from './pubsub';

const NOTIFY_TOPIC = process.env.PUBSUB_TOPIC_NOTIFY || 'cmd.send_notification';

// Notification type definitions
export type BillingNotificationType =
  | 'trial_started'
  | 'trial_ending_soon'
  | 'trial_converted'
  | 'trial_expired'
  | 'payment_failed'
  | 'payment_recovered'
  | 'subscription_upgraded'
  | 'subscription_downgraded'
  | 'subscription_canceled';

// Notification data schemas
interface NotificationData {
  tierName?: string;
  trialEndsAt?: Date;
  gracePeriodEndsAt?: Date;
  previousTier?: string;
  reason?: string;
  effectiveDate?: Date;
  [key: string]: string | Date | undefined;
}

// Email subjects by notification type
const EMAIL_SUBJECTS: Record<BillingNotificationType, (data: NotificationData) => string> = {
  trial_started: (d) => `Welcome to your ${d.tierName || 'Pro'} trial!`,
  trial_ending_soon: () => 'Your trial ends in 3 days - Action required',
  trial_converted: (d) => `Your ${d.tierName || ''} subscription is now active`,
  trial_expired: () => 'Your trial has ended',
  payment_failed: () => '⚠️ Payment failed - Action required',
  payment_recovered: () => '✅ Payment successful - Service restored',
  subscription_upgraded: (d) => `Welcome to ${d.tierName || 'your new plan'}!`,
  subscription_downgraded: () => 'Your subscription has been downgraded',
  subscription_canceled: () => 'Subscription cancellation confirmed',
};

// Risk levels for UI prioritization
const NOTIFICATION_RISK_LEVELS: Record<BillingNotificationType, string> = {
  trial_started: 'low',
  trial_ending_soon: 'medium',
  trial_converted: 'low',
  trial_expired: 'medium',
  payment_failed: 'critical',
  payment_recovered: 'low',
  subscription_upgraded: 'low',
  subscription_downgraded: 'high',
  subscription_canceled: 'medium',
};

/**
 * Send a billing notification to organization admins via notification worker
 */
export async function sendBillingNotification(
  organizationId: string,
  type: BillingNotificationType,
  data: NotificationData
): Promise<void> {
  try {
    // Get organization with owner/admin users
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          where: { role: { in: ['owner', 'admin'] } },
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!org || org.users.length === 0) {
      console.warn(`No admins found for org ${organizationId}, skipping notification`);
      return;
    }

    const subject = EMAIL_SUBJECTS[type](data);
    const riskLevel = NOTIFICATION_RISK_LEVELS[type];
    const summary = buildNotificationSummary(type, data);

    // Send notification to each admin via Pub/Sub
    for (const user of org.users) {
      // Create notification record for tracking
      const notification = await prisma.notification.create({
        data: {
          userId: user.id,
          personalizedSummary: summary,
          riskLevel,
        },
      });

      // Publish to notification worker via Pub/Sub
      await publishMessage(NOTIFY_TOPIC, {
        notification_id: notification.id,
        user_id: user.id,
        email: user.email,
        subject,
        summary,
        change_event_id: null, // No change event for billing notifications
        is_billing_notification: true,
        billing_notification_type: type,
        risk_level: riskLevel,
        // Additional context
        tier_name: data.tierName,
        trial_ends_at: data.trialEndsAt?.toISOString(),
        grace_period_ends_at: data.gracePeriodEndsAt?.toISOString(),
        previous_tier: data.previousTier,
        reason: data.reason,
      });

      console.log(`Published billing notification ${type} for user ${user.id} to Pub/Sub`);
    }

    // Log notification for compliance
    await prisma.auditLog.create({
      data: {
        action: 'BILLING_NOTIFICATION_SENT',
        entityType: 'organization',
        entityId: organizationId,
        details: {
          notificationType: type,
          recipients: org.users.map(u => u.email),
          ...serializeNotificationData(data),
        },
      },
    });

    console.log(`Billing notification ${type} queued for org ${organizationId}`);
  } catch (error) {
    console.error(`Failed to send billing notification ${type}:`, error);
    // Don't throw - notifications shouldn't block subscription operations
  }
}

/**
 * Build human-readable summary for notification
 */
function buildNotificationSummary(type: BillingNotificationType, data: NotificationData): string {
  const summaries: Record<BillingNotificationType, () => string> = {
    trial_started: () => 
      `Your 14-day trial of ${data.tierName || 'the Pro plan'} has started. Enjoy full access to all features!`,
    trial_ending_soon: () => 
      `Your trial ends on ${data.trialEndsAt?.toLocaleDateString() || 'in 3 days'}. Add a payment method to continue.`,
    trial_converted: () => 
      `Your trial has converted to a paid ${data.tierName || ''} subscription. Thank you for choosing Clausync!`,
    trial_expired: () => 
      'Your trial has ended. Your account has been moved to the free tier. Upgrade anytime to regain access.',
    payment_failed: () => 
      `Your payment has failed. Please update your payment method to avoid service interruption. ` +
      `You have until ${data.gracePeriodEndsAt?.toLocaleDateString() || '7 days'} before your account is downgraded.`,
    payment_recovered: () => 
      `Your payment was successful! Your ${data.tierName || ''} subscription is now active again.`,
    subscription_upgraded: () => 
      `Welcome to ${data.tierName || 'your new plan'}! You now have access to all the features included in this tier.`,
    subscription_downgraded: () => 
      `Your subscription has been downgraded from ${data.previousTier || 'your previous plan'} to the free tier. ` +
      `Reason: ${data.reason || 'subscription ended'}.`,
    subscription_canceled: () => 
      `Your subscription cancellation has been confirmed. You'll retain access until ` +
      `${data.effectiveDate?.toLocaleDateString() || 'the end of your billing period'}.`,
  };

  return summaries[type]();
}

/**
 * Send trial ending soon notifications
 * Should be called daily by a cron job
 */
export async function sendTrialEndingSoonNotifications(): Promise<void> {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const endOfDay = new Date(threeDaysFromNow);
  endOfDay.setHours(23, 59, 59, 999);

  const startOfDay = new Date(threeDaysFromNow);
  startOfDay.setHours(0, 0, 0, 0);

  // Find trials ending in exactly 3 days
  const expiringTrials = await prisma.organizationSubscription.findMany({
    where: {
      status: 'trialing',
      trialEndsAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: { tier: true },
  });

  for (const trial of expiringTrials) {
    await sendBillingNotification(trial.organizationId, 'trial_ending_soon', {
      tierName: trial.tier.displayName,
      trialEndsAt: trial.trialEndsAt!,
    });
  }

  console.log(`Sent ${expiringTrials.length} trial ending soon notifications`);
}

/**
 * Process expired trials
 * Should be called daily by a cron job
 */
export async function processExpiredTrials(): Promise<void> {
  const now = new Date();

  // Find expired trials
  const expiredTrials = await prisma.organizationSubscription.findMany({
    where: {
      status: 'trialing',
      trialEndsAt: { lt: now },
    },
    include: {
      organization: true,
    },
  });

  for (const trial of expiredTrials) {
    // Check if org has payment method (via paymentCustomerId)
    const hasPaymentMethod = !!trial.organization.paymentCustomerId;

    // Import dynamically to avoid circular dependency
    const { endTrial } = await import('./subscription');
    await endTrial(trial.organizationId, hasPaymentMethod);
  }

  console.log(`Processed ${expiredTrials.length} expired trials`);
}

// Helper: Serialize notification data for JSON storage
function serializeNotificationData(data: NotificationData): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (value !== undefined) {
      result[key] = String(value);
    } else {
      result[key] = null;
    }
  }
  return result;
}


