import { getAthleteByCookie } from '../../../lib/authServer';
import { getBillingPlan, getBillingPriceId } from '../../../lib/billingPlans';
import { getStripeClient } from '../../../lib/stripeServer';
import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  const { plan: planId } = req.query;
  const plan = getBillingPlan(planId);

  if (!plan) {
    res.status(400).json({ error: 'Unknown billing plan.' });
    return;
  }

  const athlete = await getAthleteByCookie(req, supabase);
  if (!athlete) {
    res.redirect(`/signup?plan=${encodeURIComponent(planId)}`);
    return;
  }

  const priceId = getBillingPriceId(planId);
  if (!priceId) {
    res.status(500).json({ error: `Missing Stripe price configuration for ${plan.label}.` });
    return;
  }

  try {
    const stripe = getStripeClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: `${siteUrl}/account?checkout=success`,
      cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
      line_items: [{ price: priceId, quantity: 1 }],
      customer: athlete.stripe_customer_id || undefined,
      customer_email: athlete.stripe_customer_id ? undefined : athlete.email || undefined,
      allow_promotion_codes: true,
      metadata: {
        athlete_id: athlete.id,
        subscription_tier: plan.tier,
        billing_plan: plan.id,
      },
      subscription_data: {
        metadata: {
          athlete_id: athlete.id,
          subscription_tier: plan.tier,
          billing_plan: plan.id,
        },
      },
    });

    res.redirect(303, session.url);
  } catch (error) {
    console.error('[billing/checkout] failed:', error);
    res.status(500).json({ error: 'Could not start checkout session.' });
  }
}
