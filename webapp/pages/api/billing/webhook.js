import { getPlanIdFromPriceId, getTierFromPriceId } from '../../../lib/billingPlans';
import { getStripeClient } from '../../../lib/stripeServer';
import { getSupabaseAdminClient } from '../../../lib/authServer';
import { syncCoachProfileFromSubscription } from '../../../lib/coachBilling';

export const config = {
  api: {
    bodyParser: false,
  },
};

function isPaidAthleteSubscription(subscription) {
  if (!subscription) {
    return false;
  }

  if (subscription.cancel_at_period_end) {
    return true;
  }

  return ['active', 'trialing', 'past_due'].includes(subscription.status);
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function upsertAthleteSubscriptionFromObject(subscription, fallbackAthleteId = null) {
  const admin = getSupabaseAdminClient();
  const athleteId = subscription?.metadata?.athlete_id || fallbackAthleteId;
  if (!athleteId) return null;

  const primaryItem = subscription?.items?.data?.[0];
  const priceId = primaryItem?.price?.id || null;
  const athleteTier = subscription?.metadata?.subscription_tier || getTierFromPriceId(priceId);
  const paid = isPaidAthleteSubscription(subscription);

  const { data, error } = await admin
    .from('athletes')
    .update({
      subscription_tier: paid ? athleteTier : 'free',
      subscription_activated_at: paid
        ? new Date(subscription.created * 1000).toISOString()
        : null,
      stripe_customer_id: subscription.customer || null,
      stripe_subscription_id: subscription.id || null,
      stripe_price_id: priceId,
      stripe_subscription_status: subscription.status || null,
    })
    .eq('id', athleteId)
    .select('id, subscription_tier, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_subscription_status')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function syncCoachIfNeeded(subscription, customerId, eventType = null) {
  const primaryItem = subscription?.items?.data?.[0];
  const priceId = primaryItem?.price?.id || null;
  const billingPlanId = subscription?.metadata?.billing_plan || getPlanIdFromPriceId(priceId);

  if (!billingPlanId?.startsWith('coach_')) {
    return null;
  }

  return syncCoachProfileFromSubscription({
    athleteId: subscription?.metadata?.athlete_id || null,
    customerId,
    subscription,
    eventType,
  });
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

  await upsertAthleteSubscriptionFromObject(subscription, athleteId);
  await syncCoachIfNeeded(subscription, typeof session.customer === 'string' ? session.customer : session.customer?.id || null);
}

async function handleInvoicePaymentFailed(invoice) {
  if (!invoice?.subscription) {
    return;
  }

  const stripe = getStripeClient();
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription.id;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });

  await upsertAthleteSubscriptionFromObject(subscription);
  await syncCoachIfNeeded(
    subscription,
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null,
    'payment_failed'
  );
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
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await upsertAthleteSubscriptionFromObject(subscription);
        await syncCoachIfNeeded(
          subscription,
          typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await upsertAthleteSubscriptionFromObject(subscription);
        await syncCoachIfNeeded(
          subscription,
          typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null,
          'deleted'
        );
        break;
      }
      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(event.data.object);
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
