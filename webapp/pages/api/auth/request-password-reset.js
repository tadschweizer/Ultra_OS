import { getSupabaseAdminClient } from '../../../lib/authServer';
import { assertAuthPostMethod } from '../../../lib/auth/contracts.js';
import {
  enforceAuthRateLimit,
  getClientIp,
  recordAuthAttempt,
} from '../../../lib/auth/rateLimit.js';
import { getSiteUrl, sendPasswordResetEmail } from '../../../lib/email/transactional.js';

/**
 * POST /api/auth/request-password-reset  { email }
 *
 * Starts the "forgot password" flow, which previously did not exist anywhere
 * in the product — a user who forgot their password was locked out for good.
 *
 * Always answers 200 with the same body, whether or not an account exists.
 * Reporting "no such account" would turn this endpoint into a free membership
 * oracle: anyone could test a list of addresses to learn who trains here.
 */
export default async function handler(req, res) {
  if (!assertAuthPostMethod(req, res)) return;

  const { email } = req.body || {};
  const genericResponse = () =>
    res.status(200).json({
      ok: true,
      message: 'If an account exists for that email, a reset link is on its way.',
    });

  if (!email || typeof email !== 'string') {
    return genericResponse();
  }

  const admin = getSupabaseAdminClient();
  const ip = getClientIp(req);

  // Rate limited on both buckets so this cannot be used to flood someone's
  // inbox, or to walk a list of addresses looking for slow/fast responses.
  if (!(await enforceAuthRateLimit(admin, res, { kind: 'password_reset', identifier: email, ip }))) {
    return undefined;
  }
  await recordAuthAttempt(admin, { kind: 'password_reset', identifier: email, ip, succeeded: false });

  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${getSiteUrl()}/reset-password` },
    });

    // An unknown address lands here. Swallow it and answer as if it worked.
    if (error || !data?.properties?.action_link) {
      return genericResponse();
    }

    // Look up the display name for the greeting, but never let a failure here
    // change the response — the reply must not vary with account existence.
    let name = null;
    try {
      const { data: athlete } = await admin
        .from('athletes')
        .select('name')
        .eq('email', email)
        .limit(1);
      name = athlete?.[0]?.name || null;
    } catch {
      // Greeting falls back to "there".
    }

    await sendPasswordResetEmail({ name, email, resetUrl: data.properties.action_link });
  } catch (error) {
    console.error('[request-password-reset] failed:', error?.message);
  }

  return genericResponse();
}
