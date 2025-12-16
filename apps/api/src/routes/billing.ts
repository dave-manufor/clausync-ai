/**
 * Billing Routes
 * 
 * Subscription and billing management endpoints.
 */

import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { getPaymentProcessor } from '../services/payment';
import { sendSuccess, sendPaginated, errors } from '../middleware/response-formatter';
import { getPlanLimits, getMonitorCount, getDocumentCount, getTeamMemberCount } from '../middleware/plan-limits';
import { getAllUsage } from '../services/usage';

const router = Router();

/**
 * @openapi
 * /api/v1/billing/tiers:
 *   get:
 *     summary: List available subscription tiers
 *     description: Returns all active subscription tiers
 *     tags: [Billing]
 *     security: []
 *     responses:
 *       200:
 *         description: List of subscription tiers
 */
router.get('/tiers', async (req: Request, res: Response): Promise<void> => {
  try {
    const tiers = await prisma.subscriptionTier.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        priceMonthly: true,
        priceYearly: true,
        currency: true,
        monitorLimit: true,
        teamLimit: true,
        documentLimit: true,
        apiRateLimit: true,
        checkFrequency: true,
        historyDays: true,
        reportsPerMonth: true,
        webhookLimit: true,
        features: true,
      },
    });

    sendSuccess(res, tiers);
  } catch (error) {
    console.error('Error listing tiers:', error);
    errors.internal(res);
  }
});

/**
 * @openapi
 * /api/v1/billing/subscription:
 *   get:
 *     summary: Get current subscription
 *     description: Returns the organization's current subscription status
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription details
 */
router.get('/subscription', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
      include: {
        organization: {
          include: {
            subscription: {
              include: { tier: true },
            },
          },
        },
      },
    });

    if (!user) {
      errors.notFound(res, 'User not found');
      return;
    }

    if (!user.organization) {
      // Individual user without org - return free tier info
      sendSuccess(res, {
        tier: 'free',
        status: 'active',
        limits: await getPlanLimits(req.user!.uid),
      });
      return;
    }

    const subscription = user.organization.subscription;

    if (!subscription) {
      sendSuccess(res, {
        tier: 'free',
        status: 'active',
        limits: await getPlanLimits(req.user!.uid),
      });
      return;
    }

    sendSuccess(res, {
      id: subscription.id,
      tier: subscription.tier.name,
      tierDisplayName: subscription.tier.displayName,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      limits: await getPlanLimits(req.user!.uid),
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    errors.internal(res);
  }
});

/**
 * @openapi
 * /api/v1/billing/subscription:
 *   post:
 *     summary: Create or update subscription
 *     description: Subscribe to a tier or change current subscription
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tierId]
 *             properties:
 *               tierId: { type: string }
 *               interval: { type: string, enum: [monthly, yearly] }
 *               callbackUrl: { type: string }
 *     responses:
 *       200:
 *         description: Subscription created/updated
 */
router.post('/subscription', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tierId, interval = 'monthly', callbackUrl } = req.body;

    if (!tierId) {
      errors.badRequest(res, 'tierId is required');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
      include: { organization: true },
    });

    if (!user) {
      errors.notFound(res, 'User not found');
      return;
    }

    // Verify tier exists and is active
    const tier = await prisma.subscriptionTier.findUnique({
      where: { id: tierId },
    });

    if (!tier || !tier.isActive) {
      errors.notFound(res, 'Subscription tier not found or not available');
      return;
    }

    // Free tier - no payment needed
    if (tier.priceMonthly === 0) {
      const subscription = await prisma.organizationSubscription.upsert({
        where: { organizationId: user.organization?.id || '' },
        create: {
          organizationId: user.organization!.id,
          tierId: tier.id,
          status: 'active',
        },
        update: {
          tierId: tier.id,
          status: 'active',
        },
      });

      sendSuccess(res, {
        subscription: {
          id: subscription.id,
          tier: tier.name,
          status: subscription.status,
        },
      });
      return;
    }

    // Paid tier - initiate payment
    const processor = getPaymentProcessor();

    // Ensure organization has payment customer
    let customerId = user.organization?.paymentCustomerId;
    if (!customerId) {
      const customer = await processor.createCustomer(user.email, user.name || undefined);
      customerId = customer.id;
      
      await prisma.organization.update({
        where: { id: user.organization!.id },
        data: { paymentCustomerId: customerId },
      });
    }

    // For PayStack, redirect to authorization URL
    if (processor.getAuthorizationUrl && callbackUrl) {
      // Use tier name as plan ID (would need to map to PayStack plan codes)
      const authUrl = await processor.getAuthorizationUrl(user.email, tier.name, callbackUrl);
      sendSuccess(res, { authorizationUrl: authUrl });
      return;
    }

    // Direct subscription creation (for Stripe or when auth is complete)
    const paymentSub = await processor.createSubscription(customerId, tier.name);

    const subscription = await prisma.organizationSubscription.upsert({
      where: { organizationId: user.organization!.id },
      create: {
        organizationId: user.organization!.id,
        tierId: tier.id,
        paymentSubscriptionId: paymentSub.id,
        status: paymentSub.status,
        currentPeriodStart: paymentSub.currentPeriodStart,
        currentPeriodEnd: paymentSub.currentPeriodEnd,
      },
      update: {
        tierId: tier.id,
        paymentSubscriptionId: paymentSub.id,
        status: paymentSub.status,
        currentPeriodStart: paymentSub.currentPeriodStart,
        currentPeriodEnd: paymentSub.currentPeriodEnd,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'SUBSCRIBE',
        entityType: 'subscription',
        entityId: subscription.id,
        details: { tier: tier.name, interval },
        ipAddress: req.ip,
      },
    });

    sendSuccess(res, {
      subscription: {
        id: subscription.id,
        tier: tier.name,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    errors.internal(res);
  }
});

/**
 * @openapi
 * /api/v1/billing/subscription:
 *   delete:
 *     summary: Cancel subscription
 *     description: Cancel the current subscription at period end
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription canceled
 */
router.delete('/subscription', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
      include: {
        organization: {
          include: { subscription: true },
        },
      },
    });

    if (!user?.organization?.subscription) {
      errors.notFound(res, 'No active subscription');
      return;
    }

    const subscription = user.organization.subscription;

    if (subscription.paymentSubscriptionId) {
      const processor = getPaymentProcessor();
      await processor.cancelSubscription(subscription.paymentSubscriptionId, true);
    }

    await prisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CANCEL_SUBSCRIPTION',
        entityType: 'subscription',
        entityId: subscription.id,
        details: {},
        ipAddress: req.ip,
      },
    });

    sendSuccess(res, {
      message: 'Subscription will be canceled at period end',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: subscription.currentPeriodEnd,
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    errors.internal(res);
  }
});

/**
 * @openapi
 * /api/v1/billing/usage:
 *   get:
 *     summary: Get current usage
 *     description: Returns current usage against plan limits
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usage statistics
 */
router.get('/usage', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
      include: { organization: true },
    });

    const limits = await getPlanLimits(req.user!.uid);
    const monitors = await getMonitorCount(req.user!.uid);
    const documents = await getDocumentCount(req.user!.uid);
    const teamMembers = await getTeamMemberCount(req.user!.uid);

    // Get API usage from UsageRecord
    let apiRequestsUsed = 0;
    let webRequestsUsed = 0;
    if (user?.organization) {
      const usageMetrics = await getAllUsage(user.organization.id);
      apiRequestsUsed = usageMetrics.api_requests;
      webRequestsUsed = usageMetrics.web_requests;
    }

    sendSuccess(res, {
      usage: {
        monitors: { current: monitors, limit: limits.monitorLimit },
        documents: { current: documents, limit: limits.documentLimit },
        teamMembers: { current: teamMembers, limit: limits.teamLimit },
        // API key requests count toward billing limit
        apiRequests: { current: apiRequestsUsed, limit: limits.apiRateLimit, billable: true },
        // Web app requests are free (informational only)
        webRequests: { current: webRequestsUsed, limit: null, billable: false },
      },
    });
  } catch (error) {
    console.error('Error getting usage:', error);
    errors.internal(res);
  }
});

/**
 * @openapi
 * /api/v1/billing/invoices:
 *   get:
 *     summary: List invoices
 *     description: Returns payment history/invoices
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invoice list
 */
router.get('/invoices', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
      include: { organization: true },
    });

    if (!user?.organization?.paymentCustomerId) {
      sendSuccess(res, []);
      return;
    }

    const processor = getPaymentProcessor();
    const invoices = await processor.getInvoices(user.organization.paymentCustomerId);

    sendSuccess(res, invoices);
  } catch (error) {
    console.error('Error listing invoices:', error);
    errors.internal(res);
  }
});

export default router;
