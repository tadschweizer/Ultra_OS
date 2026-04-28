import { syncCoachProfileFromStripe } from '../../../../lib/coachBilling';
import { getStripeClient } from '../../../../lib/stripeServer';
import { getAuthenticatedAthlete, getCoachProfileByAthleteId } from '../../../../lib/coachServer';
import { getSupabaseAdminClient } from '../../../../lib/authServer';

function getRequestOrigin(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = req.headers.host;
  if (!host) {
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  }

  const protocol = host.includes('localhost') || host.startsWith('127.0.0.1')
    ? 'http'
    : 'https';

  return `${protocol}://${host}`;
}

export default async function handler(req, res) {
  const athlete = await getAuthenticatedAthlete(req);
  if (!athlete) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  try {
    const admin = getSupabaseAdminClient();
    const existingProfile = await getCoachProfileByAthleteId(admin, athlete.id);
    const profile = existingProfile
      ? await syncCoachProfileFromStripe({ athlete, profile: existingProfile, force: true })
      : null;
    const customerId = profile?.stripe_customer_id || athlete.stripe_customer_id || null;

    if (!customerId) {
      res.status(400).json({ error: 'No Stripe customer found for this coach yet.' });
      return;
    }

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getRequestOrigin(req)}/coach/settings`,
    });

    res.redirect(303, session.url);
  } catch (error) {
    console.error('[coach/billing/portal] failed:', error);
    res.status(500).json({ error: 'Could not open coach billing portal.' });
  }
}
