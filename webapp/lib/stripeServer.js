import Stripe from 'stripe';

let stripeClient = null;

export function getStripeClient() {
  const secretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secretKey) {
    throw new Error('Missing required environment variable: STRIPE_SECRET_KEY');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  return stripeClient;
}
