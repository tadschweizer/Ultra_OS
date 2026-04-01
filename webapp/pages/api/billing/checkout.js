import { getAthleteByCookie } from '../../../lib/authServer';
import { getBillingPlan, getBillingPriceId } from '../../../lib/billingPlans';
import { getStripeClient } from '../../../lib/stripeServer';
import { supabase } from '../../../lib/supabaseClient';
import cookie from 'cookie';

function getRequestOrigin(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = req.headers.host;
  if (host) {
    const protocol = host.includes('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https';
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

function appendSetCookie(res, nextCookie) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', nextCookie);
    return;
  }

  const cookies = Array.isArray(current) ? current : [current];
  res.setHeader('Set-Cookie', [...cookies, nextCookie]);
}

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
    const siteUrl = getRequestOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: `${siteUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
      line_items: [{ price: priceId, quantity: 1 }],
      customer: athlete.stripe_customer_id || undefined,
      customer_email: athlete.stripe_customer_id ? undefined : athlete.email || undefined,
      allow_promotion_codes: true,
      client_reference_id: athlete.id,
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

    appendSetCookie(
      res,
      cookie.serialize('pending_checkout_session_id', session.id, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60,
      })
    );

    res.redirect(303, session.url);
  } catch (error) {
    console.error('[billing/checkout] failed:', error);
    res.status(500).json({ error: 'Could not start checkout session.' });
  }
}
