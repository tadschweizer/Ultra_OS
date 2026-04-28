import { getBillingPlan, getBillingPriceId } from '../../../../lib/billingPlans';
import { syncCoachProfileFromSubscription } from '../../../../lib/coachBilling';
import { getSupabaseAdminClient } from '../../../../lib/authServer';
import { getAuthenticatedAthlete, getCoachProfileByAthleteId } from '../../../../lib/coachServer';
import { getStripeClient } from '../../../../lib/stripeServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const athlete = await getAuthenticatedAthlete(req);
  if (!athlete) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const planId = String(req.body?.planId || '').trim();
  const plan = getBillingPlan(planId);
  if (!plan || !plan.id.startsWith('coach_')) {
    res.status(400).json({ error: 'Unknown coach billing plan.' });
    return;
  }

  const priceId = getBillingPriceId(planId);
  if (!priceId) {
    res.status(500).json({ error: 'Missing Stripe price configuration for that coach plan.' });
    return;
  }

  try {
    const admin = getSupabaseAdminClient();
    const profile = await getCoachProfileByAthleteId(admin, athlete.id);
    if (!profile?.stripe_subscription_id) {
      res.status(400).json({ error: 'No active coach subscription found to switch.' });
      return;
    }

    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, {
      expand: ['items.data.price'],
    });
    const subscriptionItem = subscription?.items?.data?.[0];

    if (!subscriptionItem?.id) {
      res.status(400).json({ error: 'Stripe did not return a subscription item for this coach plan.' });
      return;
    }

    const updatedSubscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: false,
      proration_behavior: 'create_prorations',
      items: [
        {
          id: subscriptionItem.id,
          price: priceId,
        },
      ],
      metadata: {
        athlete_id: athlete.id,
        subscription_tier: 'coach',
        billing_plan: plan.id,
      },
    });

    const syncedProfile = await syncCoachProfileFromSubscription({
      athleteId: athlete.id,
      customerId: typeof updatedSubscription.customer === 'string'
        ? updatedSubscription.customer
        : updatedSubscription.customer?.id || profile.stripe_customer_id || null,
      subscription: updatedSubscription,
    });

    res.status(200).json({
      switched: true,
      profile: syncedProfile,
    });
  } catch (error) {
    console.error('[coach/billing/switch] failed:', error);
    res.status(500).json({ error: 'Could not switch coach billing plan.' });
  }
}
