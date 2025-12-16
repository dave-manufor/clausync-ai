/**
 * Subscription Service
 * 
 * Handles complete subscription lifecycle:
 * - Auto-assign free tier on account creation
 * - Trial period management (14 days)
 * - Grace period (past_due) on payment failure
 * - Payment recovery
 * - Downgrade to free tier on final failure
 * - Compliance audit logging for all transitions
 */

import prisma from '../db/client';
import { sendBillingNotification, BillingNotificationType } from './billing-notifications';

// Subscription status types
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused';
export type StatusChangeReason = 'payment_failed' | 'user_canceled' | 'trial_expired' | 'payment_recovered' | 'upgraded' | 'created';
export type TriggeredBy = 'webhook' | 'user' | 'system';

const DEFAULT_TRIAL_DAYS = 14;
const GRACE_PERIOD_DAYS = 7; // PayStack typically retries for 7 days

/**
 * Get the free tier - creates it if it doesn't exist (seed)
 */
export async function getFreeTier() {
  let freeTier = await prisma.subscriptionTier.findUnique({
    where: { name: 'free' },
  });

  // Auto-seed free tier if it doesn't exist
  if (!freeTier) {
    freeTier = await prisma.subscriptionTier.create({
      data: {
        name: 'free',
        displayName: 'Explorer',
        priceMonthly: 0,
        priceYearly: 0,
        currency: 'USD',
        monitorLimit: 3,
        teamLimit: 1,
        documentLimit: 0,
        apiRateLimit: 0,
        checkFrequency: 'weekly',
        historyDays: 30,
        reportsPerMonth: 0,
        webhookLimit: 0,
        isActive: true,
      },
    });
    console.log('Auto-seeded free tier');
  }

  return freeTier;
}

/**
 * Assign free tier to an organization (silent - no notification)
 * Used for initial org creation only
 */
export async function assignFreeTier(organizationId: string): Promise<void> {
  const freeTier = await getFreeTier();

  await prisma.organizationSubscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      tierId: freeTier.id,
      status: 'active',
      paymentSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      trialEndsAt: null,
    },
    update: {
      tierId: freeTier.id,
      status: 'active',
      paymentSubscriptionId: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
  });
}

/**
 * Start a trial period for a paid tier
 */
export async function startTrial(
  organizationId: string,
  tierId: string,
  days: number = DEFAULT_TRIAL_DAYS
): Promise<void> {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + days);

  const tier = await prisma.subscriptionTier.findUnique({ where: { id: tierId } });
  if (!tier) throw new Error('Tier not found');

  const subscription = await prisma.organizationSubscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      tierId,
      status: 'trialing',
      trialEndsAt,
    },
    update: {
      tierId,
      status: 'trialing',
      trialEndsAt,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
  });

  await logStatusChange(subscription.id, 'active', 'trialing', 'upgraded', 'user');
  await sendBillingNotification(organizationId, 'trial_started', { tierName: tier.displayName, trialEndsAt });
  
  console.log(`Trial started for org ${organizationId}, ends ${trialEndsAt.toISOString()}`);
}

/**
 * End trial - convert to active (if payment) or downgrade to free
 */
export async function endTrial(organizationId: string, hasPaymentMethod: boolean): Promise<void> {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    include: { tier: true },
  });

  if (!subscription || subscription.status !== 'trialing') return;

  if (hasPaymentMethod) {
    // Convert to active subscription
    await prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        status: 'active',
        trialEndsAt: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: getNextBillingDate(),
      },
    });

    await logStatusChange(subscription.id, 'trialing', 'active', 'payment_recovered', 'system');
    await sendBillingNotification(organizationId, 'trial_converted', { tierName: subscription.tier.displayName });
  } else {
    // Downgrade to free tier
    await downgradeToFreeTier(organizationId, 'trial_expired', undefined, 'system');
  }
}

/**
 * Set subscription to past_due (grace period begins)
 * Called on first payment failure
 */
export async function setSubscriptionPastDue(organizationId: string): Promise<void> {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    include: { tier: true },
  });

  if (!subscription) return;

  const previousStatus = subscription.status;
  const gracePeriodEndsAt = new Date();
  gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + GRACE_PERIOD_DAYS);

  await prisma.organizationSubscription.update({
    where: { organizationId },
    data: { status: 'past_due' },
  });

  await logStatusChange(subscription.id, previousStatus, 'past_due', 'payment_failed', 'webhook');
  await sendBillingNotification(organizationId, 'payment_failed', { 
    tierName: subscription.tier.displayName,
    gracePeriodEndsAt,
  });

  console.log(`Organization ${organizationId} set to past_due (grace period until ${gracePeriodEndsAt.toISOString()})`);
}

/**
 * Recover subscription from past_due to active
 * Called when payment succeeds during grace period
 */
export async function recoverSubscription(organizationId: string): Promise<void> {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    include: { tier: true },
  });

  if (!subscription || subscription.status !== 'past_due') return;

  await prisma.organizationSubscription.update({
    where: { organizationId },
    data: {
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: getNextBillingDate(),
    },
  });

  await logStatusChange(subscription.id, 'past_due', 'active', 'payment_recovered', 'webhook');
  await sendBillingNotification(organizationId, 'payment_recovered', { 
    tierName: subscription.tier.displayName,
  });

  console.log(`Organization ${organizationId} recovered from past_due to active`);
}

/**
 * Cancel subscription - user initiated
 * Sets cancelAtPeriodEnd = true (downgrade happens at period end)
 */
export async function cancelSubscription(
  organizationId: string,
  userId?: string
): Promise<{ canceledAt: Date; currentPeriodEnd: Date | null }> {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    include: { tier: true },
  });

  if (!subscription) throw new Error('No subscription found');

  const now = new Date();

  await prisma.organizationSubscription.update({
    where: { organizationId },
    data: {
      cancelAtPeriodEnd: true,
      canceledAt: now,
    },
  });

  await logStatusChange(subscription.id, subscription.status, subscription.status, 'user_canceled', 'user', userId);
  await sendBillingNotification(organizationId, 'subscription_canceled', { 
    tierName: subscription.tier.displayName,
    effectiveDate: subscription.currentPeriodEnd || now,
  });

  return { canceledAt: now, currentPeriodEnd: subscription.currentPeriodEnd };
}

/**
 * Downgrade to free tier with notification and audit log
 */
export async function downgradeToFreeTier(
  organizationId: string,
  reason: StatusChangeReason,
  userId?: string,
  triggeredBy: TriggeredBy = 'webhook'
): Promise<void> {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    include: { tier: true },
  });

  if (!subscription) return;

  const previousTier = subscription.tier.displayName;
  const previousStatus = subscription.status;

  await assignFreeTier(organizationId);

  await logStatusChange(subscription.id, previousStatus, 'active', reason, triggeredBy, userId);
  await sendBillingNotification(organizationId, 'subscription_downgraded', { 
    previousTier,
    reason,
  });

  console.log(`Organization ${organizationId} downgraded to free tier (reason: ${reason})`);
}

/**
 * Upgrade subscription to a new tier
 */
export async function upgradeSubscription(
  organizationId: string,
  tierId: string,
  paymentSubscriptionId: string,
  userId?: string
): Promise<void> {
  const tier = await prisma.subscriptionTier.findUnique({ where: { id: tierId } });
  if (!tier) throw new Error('Tier not found');

  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    include: { tier: true },
  });

  const previousStatus = subscription?.status || 'active';

  await prisma.organizationSubscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      tierId,
      paymentSubscriptionId,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: getNextBillingDate(),
    },
    update: {
      tierId,
      paymentSubscriptionId,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: getNextBillingDate(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
  });

  await logStatusChange(subscription?.id || organizationId, previousStatus, 'active', 'upgraded', 'user', userId);
  await sendBillingNotification(organizationId, 'subscription_upgraded', { tierName: tier.displayName });
}

/**
 * Check if subscription is in grace period
 */
export async function isInGracePeriod(organizationId: string): Promise<boolean> {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
  });

  return subscription?.status === 'past_due';
}

/**
 * Check if subscription is trialing
 */
export async function isTrialing(organizationId: string): Promise<boolean> {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
  });

  return subscription?.status === 'trialing';
}

/**
 * Get grace period end date (estimated based on PayStack retry schedule)
 */
export function getGracePeriodEndDate(): Date {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + GRACE_PERIOD_DAYS);
  return endDate;
}

// Helper: Get next billing date (1 month from now)
function getNextBillingDate(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date;
}

// Helper: Log status change for compliance
async function logStatusChange(
  subscriptionId: string,
  previousStatus: string,
  newStatus: string,
  reason: StatusChangeReason,
  triggeredBy: TriggeredBy,
  userId?: string
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: userId || null,
      action: 'SUBSCRIPTION_STATUS_CHANGE',
      entityType: 'subscription',
      entityId: subscriptionId,
      details: {
        previousStatus,
        newStatus,
        reason,
        triggeredBy,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

