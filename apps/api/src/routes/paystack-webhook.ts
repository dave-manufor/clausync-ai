/**
 * PayStack Webhook Handler
 * 
 * Receives and processes PayStack webhook events.
 * https://paystack.com/docs/api/#webhook
 */

import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { getPaymentProcessor } from '../services/payment';
import { downgradeToFreeTier } from '../services/subscription';

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
        await handleSubscriptionCancel(event.data);
        break;

      case 'charge.success':
        await handleChargeSuccess(event.data);
        break;

      case 'invoice.payment_failed':
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

  await prisma.organizationSubscription.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      tierId: tier.id,
      paymentSubscriptionId: subscriptionCode,
      status: 'active',
      currentPeriodStart: new Date(data.createdAt),
      currentPeriodEnd: new Date(data.next_payment_date),
    },
    update: {
      tierId: tier.id,
      paymentSubscriptionId: subscriptionCode,
      status: 'active',
      currentPeriodStart: new Date(data.createdAt),
      currentPeriodEnd: new Date(data.next_payment_date),
    },
  });

  console.log(`Subscription created for org: ${org.id}`);
}

async function handleSubscriptionCancel(data: any): Promise<void> {
  const subscriptionCode = data.subscription_code;

  if (!subscriptionCode) return;

  const subscription = await prisma.organizationSubscription.findFirst({
    where: { paymentSubscriptionId: subscriptionCode },
  });

  if (!subscription) return;

  // Downgrade to free tier on cancellation
  await downgradeToFreeTier(subscription.organizationId, 'canceled');

  console.log(`Subscription canceled, downgraded to free: ${subscription.organizationId}`);
}

async function handleChargeSuccess(data: any): Promise<void> {
  // Log successful payment for audit
  const customerCode = data.customer?.customer_code;
  const amount = data.amount;
  const reference = data.reference;

  console.log(`Payment success: ${customerCode}, amount: ${amount}, ref: ${reference}`);

  // Find organization and log
  const org = await prisma.organization.findFirst({
    where: { paymentCustomerId: customerCode },
  });

  if (org) {
    // Update subscription period if needed
    const subscription = await prisma.organizationSubscription.findUnique({
      where: { organizationId: org.id },
    });

    if (subscription) {
      await prisma.organizationSubscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          // Extend period based on charge
        },
      });
    }
  }
}

async function handlePaymentFailed(data: any): Promise<void> {
  const customerCode = data.customer?.customer_code;

  if (!customerCode) return;

  const org = await prisma.organization.findFirst({
    where: { paymentCustomerId: customerCode },
  });

  if (!org) return;

  // Downgrade to free tier on payment failure
  await downgradeToFreeTier(org.id, 'payment_failed');

  console.log(`Payment failed, downgraded to free: ${org.id}`);
}

export default router;
