/**
 * Payment Processor Factory
 * 
 * Returns the appropriate payment processor based on configuration.
 * Allows hot-swapping between PayStack, Stripe, etc.
 */

import { PaymentProcessor, PaymentProcessorType } from './types';
import { PaystackProcessor } from './paystack';

// Cache the processor instance
let processorInstance: PaymentProcessor | null = null;

/**
 * Get the configured payment processor
 */
export function getPaymentProcessor(): PaymentProcessor {
  if (processorInstance) {
    return processorInstance;
  }

  const processorType = (process.env.PAYMENT_PROCESSOR || 'paystack') as PaymentProcessorType;

  switch (processorType) {
    case 'stripe':
      // Future: import and instantiate StripeProcessor
      throw new Error('Stripe processor not yet implemented. Use PAYMENT_PROCESSOR=paystack');
    
    case 'paystack':
    default:
      processorInstance = new PaystackProcessor();
      break;
  }

  console.log(`Payment processor initialized: ${processorInstance.providerName}`);
  return processorInstance;
}

/**
 * Reset the processor instance (useful for testing)
 */
export function resetPaymentProcessor(): void {
  processorInstance = null;
}

// Re-export types
export * from './types';
export { PaystackProcessor } from './paystack';
