import { getAthleteByCookie, getSupabaseAdminClient } from '../../../lib/authServer';
import { getStripeClient } from '../../../lib/stripeServer';

export default async function handler(req, res) {
  const athlete = await getAthleteByCookie(req, getSupabaseAdminClient());
  if (!athlete) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  try {
    const stripe = getStripeClient();

    // The customer id is normally written by the checkout webhook, but a slow
    // or missed webhook should not block the portal right after purchase —
    // fall back to looking the customer up by email and persist the result.
    let customerId = athlete.stripe_customer_id || null;
    if (!customerId && athlete.email) {
      const customers = await stripe.customers.list({ email: athlete.email, limit: 1 });
      customerId = customers.data?.[0]?.id || null;
      if (customerId) {
        await getSupabaseAdminClient()
          .from('athletes')
          .update({ stripe_customer_id: customerId })
          .eq('id', athlete.id);
      }
    }

    if (!customerId) {
      res.status(400).json({ error: 'No Stripe customer found for this athlete yet.' });
      return;
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/account`,
    });

    res.redirect(303, session.url);
  } catch (error) {
    console.error('[billing/portal] failed:', error);
    res.status(500).json({ error: 'Could not open billing portal.' });
  }
}
