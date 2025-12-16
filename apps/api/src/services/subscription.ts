/**
 * Subscription Service
 * 
 * Handles automatic subscription management including:
 * - Auto-assign free tier on account creation
 * - Downgrade to free tier on payment failure
 * - Downgrade to free tier on subscription cancellation
 */

import prisma from '../db/client';

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
        apiRateLimit: 0,  // No API access on free tier
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
 * Assign free tier to an organization
 * Called on:
 * - Organization creation
 * - Payment failure
 * - Subscription cancellation (when period ends)
 */
export async function assignFreeTier(organizationId: string): Promise<void> {
  const freeTier = await getFreeTier();

  await prisma.organizationSubscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      tierId: freeTier.id,
      status: 'active',
      // No payment info for free tier
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
 * Ensure organization has a subscription (creates free tier if none)
 */
export async function ensureSubscription(organizationId: string): Promise<void> {
  const existing = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
  });

  if (!existing) {
    await assignFreeTier(organizationId);
  }
}

/**
 * Downgrade to free tier (for payment failure or cancellation)
 * Also creates audit log
 */
export async function downgradeToFreeTier(
  organizationId: string,
  reason: 'payment_failed' | 'canceled' | 'expired',
  userId?: string
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { subscription: { include: { tier: true } } },
  });

  if (!org) return;

  const previousTier = org.subscription?.tier.name || 'unknown';

  await assignFreeTier(organizationId);

  // Audit log the downgrade
  await prisma.auditLog.create({
    data: {
      userId: userId || null,
      action: 'SUBSCRIPTION_DOWNGRADE',
      entityType: 'subscription',
      entityId: org.subscription?.id || organizationId,
      details: {
        previousTier,
        newTier: 'free',
        reason,
      },
    },
  });

  console.log(`Organization ${organizationId} downgraded to free tier (reason: ${reason})`);
}
