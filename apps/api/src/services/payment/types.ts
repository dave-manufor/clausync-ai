/**
 * Payment Processor Interface
 * 
 * Abstraction layer for payment providers (PayStack, Stripe, etc.)
 * Allows hot-swapping payment processors without changing API code.
 */

export interface PaymentCustomer {
  id: string;
  email: string;
  name?: string;
}

export interface PaymentPlan {
  id: string;
  name: string;
  amount: number;  // in smallest currency unit (kobo, cents)
  currency: string;
  interval: 'monthly' | 'yearly';
}

export interface PaymentSubscription {
  id: string;
  customerId: string;
  planId: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface PaymentInvoice {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  paidAt?: Date;
  invoiceUrl?: string;
}

export interface WebhookEvent {
  type: string;
  data: any;
}

/**
 * Payment Processor Interface
 * All payment providers must implement this interface
 */
export interface PaymentProcessor {
  readonly providerName: string;

  // Customer management
  createCustomer(email: string, name?: string): Promise<PaymentCustomer>;
  getCustomer(customerId: string): Promise<PaymentCustomer | null>;
  updateCustomer(customerId: string, data: { email?: string; name?: string }): Promise<PaymentCustomer>;

  // Plan management
  getPlans(): Promise<PaymentPlan[]>;
  getPlan(planId: string): Promise<PaymentPlan | null>;

  // Subscription management
  createSubscription(customerId: string, planId: string): Promise<PaymentSubscription>;
  getSubscription(subscriptionId: string): Promise<PaymentSubscription | null>;
  updateSubscription(subscriptionId: string, planId: string): Promise<PaymentSubscription>;
  cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<void>;
  reactivateSubscription(subscriptionId: string): Promise<PaymentSubscription>;

  // Invoice management
  getInvoices(customerId: string, limit?: number): Promise<PaymentInvoice[]>;

  // Webhook verification
  verifyWebhook(payload: string, signature: string): WebhookEvent | null;

  // Check authorization URL (for PayStack redirect flow)
  getAuthorizationUrl?(customerId: string, planId: string, callbackUrl: string): Promise<string>;
}

export type PaymentProcessorType = 'paystack' | 'stripe';
