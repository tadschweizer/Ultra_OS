import { getSupabaseAdminClient } from '../../../lib/authServer';
import { assertAuthPostMethod, AUTH_STATUS } from '../../../lib/auth/contracts.js';
import { requireLiveAthleteId } from '../../../lib/auth/requireAthlete.js';
import { enforceAuthRateLimit, getClientIp } from '../../../lib/auth/rateLimit.js';
import { getSiteUrl, sendVerificationEmail } from '../../../lib/email/transactional.js';

/**
 * POST /api/auth/resend-verification
 *
 * Re-sends the confirmation email for the signed-in account. Requires a
 * session rather than taking an address in the body, so it cannot be used to
 * mail arbitrary people.
 */
export default async function handler(req, res) {
  if (!assertAuthPostMethod(req, res)) return;

  const admin = getSupabaseAdminClient();
  const athleteId = await requireLiveAthleteId(req, res, admin);
  if (!athleteId) return;

  const { data: athlete, error } = await admin
    .from('athletes')
    .select('id, name, email, supabase_user_id, email_verified_at')
    .eq('id', athleteId)
    .maybeSingle();

  if (error || !athlete) {
    res.status(AUTH_STATUS.SERVER_ERROR).json({ error: 'Could not load your account.' });
    return;
  }
  if (!athlete.email || !athlete.supabase_user_id) {
    res.status(AUTH_STATUS.BAD_REQUEST).json({ error: 'This account has no email address to confirm.' });
    return;
  }
  if (athlete.email_verified_at) {
    res.status(200).json({ ok: true, alreadyVerified: true });
    return;
  }

  const ip = getClientIp(req);
  if (!(await enforceAuthRateLimit(admin, res, { kind: 'password_reset', identifier: athlete.email, ip }))) {
    return;
  }

  try {
    const { data, error: linkError } = await admin.auth.admin.generateLink({
      type: 'signup',
      email: athlete.email,
      options: { redirectTo: `${getSiteUrl()}/auth/callback` },
    });
    if (linkError || !data?.properties?.action_link) {
      throw linkError || new Error('no action link');
    }
    await sendVerificationEmail({
      name: athlete.name,
      email: athlete.email,
      verifyUrl: data.properties.action_link,
    });
  } catch (linkError) {
    console.error('[resend-verification] failed:', linkError?.message);
    res.status(AUTH_STATUS.SERVER_ERROR).json({ error: 'Could not send the email. Try again shortly.' });
    return;
  }

  res.status(200).json({ ok: true });
}
