import { getTierFromPriceId } from '../../../lib/billingPlans';
import { getStripeClient } from '../../../lib/stripeServer';
import { getSupabaseAdminClient } from '../../../lib/authServer';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function upsertSubscriptionFromObject(subscription, fallbackAthleteId = null) {
  const admin = getSupabaseAdminClient();
  const athleteId = subscription.metadata?.athlete_id || fallbackAthleteId;
  if (!athleteId) return;

  const primaryItem = subscription.items?.data?.[0];
  const priceId = primaryItem?.price?.id || null;
  const subscriptionTier = subscription.metadata?.subscription_tier || getTierFromPriceId(priceId);

  await admin
    .from('athletes')
    .update({
      subscription_tier: subscription.status === 'active' || subscription.status === 'trialing'
        ? subscriptionTier
        : 'free',
      subscription_activated_at: subscription.status === 'active' || subscription.status === 'trialing'
        ? new Date(subscription.created * 1000).toISOString()
        : null,
      stripe_customer_id: subscription.customer || null,
      stripe_subscription_id: subscription.id || null,
      stripe_price_id: priceId,
      stripe_subscription_status: subscription.status || null,
    })
    .eq('id', athleteId);
}

async function syncCheckoutSessionSubscription(session) {
  const athleteId = session.metadata?.athlete_id || null;
  if (!athleteId || !session.subscription) {
    return;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(session.subscription, {
    expand: ['items.data.price'],
  });

  await upsertSubscriptionFromObject(subscription, athleteId);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    res.status(400).json({ error: 'Missing Stripe signature.' });
    return;
  }

  try {
    const stripe = getStripeClient();
    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const athleteId = session.metadata?.athlete_id || null;
        if (session.customer && athleteId) {
          await getSupabaseAdminClient()
            .from('athletes')
            .update({ stripe_customer_id: session.customer })
            .eq('id', athleteId);
        }
        await syncCheckoutSessionSubscription(session);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await upsertSubscriptionFromObject(event.data.object);
        break;
      }
      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[billing/webhook] failed:', error);
    res.status(400).json({ error: 'Webhook signature verification failed.' });
  }
}
