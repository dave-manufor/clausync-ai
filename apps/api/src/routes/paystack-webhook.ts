/**
 * PayStack Webhook Handler
 * 
 * Receives and processes PayStack webhook events.
 * Implements proper subscription lifecycle with grace periods.
 * https://paystack.com/docs/api/#webhook
 */

import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { getPaymentProcessor } from '../services/payment';
import { 
  setSubscriptionPastDue, 
  recoverSubscription, 
  downgradeToFreeTier,
  upgradeSubscription,
} from '../services/subscription';
import { sendBillingNotification } from '../services/billing-notifications';

const router = Router();

/**
 * @openapi
 * /webhooks/paystack:
 *   post:
 *     summary: PayStack webhook endpoint
 *     description: Receives PayStack webhook events (subscription, payment, etc.)
 *     tags: [Webhooks]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook received
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    const payload = JSON.stringify(req.body);

    // Verify webhook signature
    const processor = getPaymentProcessor();
    const event = processor.verifyWebhook(payload, signature);

    if (!event) {
      console.warn('Invalid PayStack webhook signature');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    console.log(`PayStack webhook received: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'subscription.create':
        await handleSubscriptionCreate(event.data);
        break;

      case 'subscription.not_renew':
      case 'subscription.disable':
        // Final cancellation - after all retries exhausted
        await handleSubscriptionDisabled(event.data);
        break;

      case 'charge.success':
        await handleChargeSuccess(event.data);
        break;

      case 'invoice.payment_failed':
        // First failure - enter grace period
        await handlePaymentFailed(event.data);
        break;

      default:
        console.log(`Unhandled PayStack event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('PayStack webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle new subscription creation from PayStack
 */
async function handleSubscriptionCreate(data: any): Promise<void> {
  const customerCode = data.customer?.customer_code;
  const subscriptionCode = data.subscription_code;
  const planCode = data.plan?.plan_code;

  if (!customerCode) return;

  // Find organization by payment customer ID
  const org = await prisma.organization.findFirst({
    where: { paymentCustomerId: customerCode },
  });

  if (!org) {
    console.warn(`No org found for customer: ${customerCode}`);
    return;
  }

  // Find tier by name (plan code)
  const tier = await prisma.subscriptionTier.findFirst({
    where: { name: planCode },
  });

  if (!tier) {
    console.warn(`No tier found for plan: ${planCode}`);
    return;
  }

  // Use subscription service for proper lifecycle management
  await upgradeSubscription(org.id, tier.id, subscriptionCode);

  console.log(`Subscription created for org: ${org.id}, tier: ${tier.name}`);
}

/**
 * Handle subscription disabled (after all payment retries failed)
 * This is the FINAL cancellation - downgrade to free tier
 */
async function handleSubscriptionDisabled(data: any): Promise<void> {
  const subscriptionCode = data.subscription_code;

  if (!subscriptionCode) return;

  const subscription = await prisma.organizationSubscription.findFirst({
    where: { paymentSubscriptionId: subscriptionCode },
  });

  if (!subscription) return;

  // Final downgrade to free tier after PayStack exhausted retries
  await downgradeToFreeTier(subscription.organizationId, 'payment_failed', undefined, 'webhook');

  console.log(`Subscription disabled, downgraded to free: ${subscription.organizationId}`);
}

/**
 * Handle successful charge
 * If subscription is past_due, this recovers it to active
 */
async function handleChargeSuccess(data: any): Promise<void> {
  const customerCode = data.customer?.customer_code;
  const amount = data.amount;
  const reference = data.reference;

  console.log(`Payment success: ${customerCode}, amount: ${amount}, ref: ${reference}`);

  if (!customerCode) return;

  // Find organization
  const org = await prisma.organization.findFirst({
    where: { paymentCustomerId: customerCode },
  });

  if (!org) return;

  // Get current subscription
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId: org.id },
  });

  if (!subscription) return;

  // If in grace period (past_due), recover to active
  if (subscription.status === 'past_due') {
    await recoverSubscription(org.id);
    console.log(`Subscription recovered from past_due: ${org.id}`);
  } else {
    // Normal renewal - extend period
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    await prisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: nextMonth,
      },
    });
    console.log(`Subscription renewed: ${org.id}`);
  }
}

/**
 * Handle first payment failure
 * Sets subscription to past_due (grace period begins)
 * PayStack will retry payment automatically
 */
async function handlePaymentFailed(data: any): Promise<void> {
  const customerCode = data.customer?.customer_code;

  if (!customerCode) return;

  const org = await prisma.organization.findFirst({
    where: { paymentCustomerId: customerCode },
  });

  if (!org) return;

  // Set to past_due (grace period) - NOT immediate downgrade
  await setSubscriptionPastDue(org.id);

  console.log(`Payment failed, grace period started for org: ${org.id}`);
}

export default router;

