import {
  findOrCreateAthleteForAuthUser,
  getAthleteIdFromRequest,
  getSupabaseAdminClient,
  setAthleteCookie,
  syncAdminAccessCookie,
} from '../../../lib/authServer';
import { syncAthleteSubscriptionFromStripe } from '../../../lib/billingSync';


async function sendWelcomeEmail({ athleteId, name, email }) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/email/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteId, name, email }),
    });
  } catch (error) {
    console.warn('[session] Welcome email failed (non-fatal):', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { accessToken, linkAccount = false } = req.body || {};
  if (!accessToken) {
    res.status(400).json({ error: 'Missing access token.' });
    return;
  }

  const admin = getSupabaseAdminClient();
  const { data: { user }, error: userError } = await admin.auth.getUser(accessToken);

  if (userError || !user) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }

  try {
    const { athlete, isNewAthlete } = await findOrCreateAthleteForAuthUser({
      admin,
      supabaseUserId: user.id,
      email: user.email || null,
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      existingAthleteId: linkAccount ? getAthleteIdFromRequest(req) : null,
    });
    const hydratedAthlete = await syncAthleteSubscriptionFromStripe({ athlete });

    setAthleteCookie(res, hydratedAthlete.id);
    syncAdminAccessCookie(res, hydratedAthlete);

    if (isNewAthlete) {
      sendWelcomeEmail({ athleteId: hydratedAthlete.id, name: hydratedAthlete.name, email: hydratedAthlete.email });
    }

    res.status(200).json({
      athleteId: hydratedAthlete.id,
      name: hydratedAthlete.name,
      onboardingComplete: Boolean(hydratedAthlete.onboarding_complete),
      subscriptionTier: hydratedAthlete.subscription_tier,
      isNewAthlete,
    });
  } catch (error) {
    console.error('[session] sync error:', error);
    res.status(500).json({ error: 'Could not finish sign-in. Please try again.' });
  }
}
