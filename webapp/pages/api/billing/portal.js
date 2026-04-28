import { getAthleteByCookie, getSupabaseAdminClient } from '../../../lib/authServer';
import { getStripeClient } from '../../../lib/stripeServer';


export default async function handler(req, res) {
  const athlete = await getAthleteByCookie(req, getSupabaseAdminClient());
  if (!athlete) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  if (!athlete.stripe_customer_id) {
    res.status(400).json({ error: 'No Stripe customer found for this athlete yet.' });
    return;
  }

  try {
    const stripe = getStripeClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: athlete.stripe_customer_id,
      return_url: `${siteUrl}/account`,
    });

    res.redirect(303, session.url);
  } catch (error) {
    console.error('[billing/portal] failed:', error);
    res.status(500).json({ error: 'Could not open billing portal.' });
  }
}
