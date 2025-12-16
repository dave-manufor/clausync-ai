/**
 * PayStack Payment Processor
 * 
 * Implements the PaymentProcessor interface for PayStack.
 * https://paystack.com/docs/api/
 */

import crypto from 'crypto';
import {
  PaymentProcessor,
  PaymentCustomer,
  PaymentPlan,
  PaymentSubscription,
  PaymentInvoice,
  WebhookEvent,
} from './types';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export class PaystackProcessor implements PaymentProcessor {
  readonly providerName = 'paystack';
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    if (!this.secretKey) {
      console.warn('PAYSTACK_SECRET_KEY not set');
    }
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any
  ): Promise<T> {
    const response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `PayStack API error: ${response.status}`);
    }

    return data;
  }

  // Customer management
  async createCustomer(email: string, name?: string): Promise<PaymentCustomer> {
    const result = await this.request<any>('POST', '/customer', {
      email,
      first_name: name?.split(' ')[0],
      last_name: name?.split(' ').slice(1).join(' '),
    });

    return {
      id: result.data.customer_code,
      email: result.data.email,
      name: `${result.data.first_name || ''} ${result.data.last_name || ''}`.trim(),
    };
  }

  async getCustomer(customerId: string): Promise<PaymentCustomer | null> {
    try {
      const result = await this.request<any>('GET', `/customer/${customerId}`);
      return {
        id: result.data.customer_code,
        email: result.data.email,
        name: `${result.data.first_name || ''} ${result.data.last_name || ''}`.trim(),
      };
    } catch {
      return null;
    }
  }

  async updateCustomer(customerId: string, data: { email?: string; name?: string }): Promise<PaymentCustomer> {
    const result = await this.request<any>('PUT', `/customer/${customerId}`, {
      email: data.email,
      first_name: data.name?.split(' ')[0],
      last_name: data.name?.split(' ').slice(1).join(' '),
    });

    return {
      id: result.data.customer_code,
      email: result.data.email,
      name: `${result.data.first_name || ''} ${result.data.last_name || ''}`.trim(),
    };
  }

  // Plan management
  async getPlans(): Promise<PaymentPlan[]> {
    const result = await this.request<any>('GET', '/plan');
    return result.data.map((plan: any) => ({
      id: plan.plan_code,
      name: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      interval: plan.interval === 'annually' ? 'yearly' : 'monthly',
    }));
  }

  async getPlan(planId: string): Promise<PaymentPlan | null> {
    try {
      const result = await this.request<any>('GET', `/plan/${planId}`);
      return {
        id: result.data.plan_code,
        name: result.data.name,
        amount: result.data.amount,
        currency: result.data.currency,
        interval: result.data.interval === 'annually' ? 'yearly' : 'monthly',
      };
    } catch {
      return null;
    }
  }

  // Subscription management
  async createSubscription(customerId: string, planId: string): Promise<PaymentSubscription> {
    const result = await this.request<any>('POST', '/subscription', {
      customer: customerId,
      plan: planId,
    });

    return this.mapSubscription(result.data);
  }

  async getSubscription(subscriptionId: string): Promise<PaymentSubscription | null> {
    try {
      const result = await this.request<any>('GET', `/subscription/${subscriptionId}`);
      return this.mapSubscription(result.data);
    } catch {
      return null;
    }
  }

  async updateSubscription(subscriptionId: string, planId: string): Promise<PaymentSubscription> {
    // PayStack doesn't support direct plan update on subscription
    // Would need to cancel and create new subscription
    throw new Error('PayStack does not support direct subscription plan updates. Cancel and create new subscription.');
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd = false): Promise<void> {
    // PayStack uses a token-based disable
    // For now, we'll use the API endpoint
    await this.request<any>('POST', '/subscription/disable', {
      code: subscriptionId,
      token: '', // Would need the email token
    });
  }

  async reactivateSubscription(subscriptionId: string): Promise<PaymentSubscription> {
    const result = await this.request<any>('POST', '/subscription/enable', {
      code: subscriptionId,
      token: '', // Would need the email token
    });
    return this.mapSubscription(result.data);
  }

  // Invoice management
  async getInvoices(customerId: string, limit = 10): Promise<PaymentInvoice[]> {
    const result = await this.request<any>('GET', `/transaction?customer=${customerId}&perPage=${limit}`);
    return result.data.map((tx: any) => ({
      id: tx.reference,
      customerId: tx.customer?.customer_code || customerId,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status === 'success' ? 'paid' : tx.status === 'failed' ? 'failed' : 'pending',
      paidAt: tx.paid_at ? new Date(tx.paid_at) : undefined,
      invoiceUrl: tx.receipt_number ? `https://paystack.com/receipt/${tx.receipt_number}` : undefined,
    }));
  }

  // Webhook verification
  verifyWebhook(payload: string, signature: string): WebhookEvent | null {
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');

    if (hash !== signature) {
      return null;
    }

    try {
      const event = JSON.parse(payload);
      return {
        type: event.event,
        data: event.data,
      };
    } catch {
      return null;
    }
  }

  // PayStack-specific: Get authorization URL for checkout
  async getAuthorizationUrl(customerId: string, planId: string, callbackUrl: string): Promise<string> {
    const result = await this.request<any>('POST', '/transaction/initialize', {
      email: customerId, // PayStack uses email for this
      plan: planId,
      callback_url: callbackUrl,
    });

    return result.data.authorization_url;
  }

  private mapSubscription(data: any): PaymentSubscription {
    return {
      id: data.subscription_code,
      customerId: data.customer?.customer_code || '',
      planId: data.plan?.plan_code || '',
      status: this.mapStatus(data.status),
      currentPeriodStart: new Date(data.createdAt || data.created_at),
      currentPeriodEnd: new Date(data.next_payment_date),
      cancelAtPeriodEnd: false,
    };
  }

  private mapStatus(status: string): PaymentSubscription['status'] {
    switch (status) {
      case 'active': return 'active';
      case 'non-renewing': return 'canceled';
      case 'attention': return 'past_due';
      default: return 'active';
    }
  }
}
