import { getSupabaseAdminClient } from '../../../lib/authServer';
import { buildCoachSeatSnapshot, coachSubscriptionHasAccess, getCoachPlanPresentation, syncCoachProfileFromStripe } from '../../../lib/coachBilling';
import { ensureCoachProfile, getAuthenticatedAthlete } from '../../../lib/coachServer';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const athlete = await getAuthenticatedAthlete(req);
    if (!athlete) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }

    const admin = getSupabaseAdminClient();
    const existingProfile = await ensureCoachProfile(admin, athlete);

    const profile = await syncCoachProfileFromStripe({
      athlete,
      profile: existingProfile,
      force: req.query.force === '1',
    });
    const seats = await buildCoachSeatSnapshot(admin, profile);
    const plan = getCoachPlanPresentation(profile.subscription_tier);

    res.status(200).json({
      authenticated: true,
      profile,
      plan,
      seats,
      hasAccess: coachSubscriptionHasAccess(profile),
    });
  } catch (error) {
    console.error('[coach/subscription] failed:', error);
    res.status(500).json({ error: 'Could not load coach subscription.' });
  }
}
