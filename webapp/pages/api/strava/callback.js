import { exchangeToken } from '../../../lib/strava.js';
import { getAthleteByCookie, getSupabaseAdminClient } from '../../../lib/authServer.js';
import cookie from 'cookie';
import { getStravaRedirectUri } from '../../../lib/auth/oauth.js';
import { clearOAuthState, consumeOAuthReturnPath, verifyOAuthState } from '../../../lib/auth/oauthState.js';
import { buildOnboardingPath, isCoachInvitationPath } from '../../../lib/auth/redirects.js';
import {
  appendSetCookie,
  getAthleteIdFromRequest,
  setAthleteCookie,
} from '../../../lib/auth/sessionCookies.js';
import { getPersistedPrimaryRoleIntent } from '../../../lib/auth/signupRoleIntent.js';
import { loadAccountAccess } from '../../../lib/auth/roleAccessServer.js';

// Server-side routes cannot use the anon client: it carries no Supabase
// session, so auth.uid() is null and every RLS policy denies it. This route
// uses the service-role client and authorises from the session athlete id.

/**
 * Handle the Strava OAuth callback.
 *
 * Exchanges the provided code for an access token and refresh token,
 * links or signs in the athlete in Supabase, sets a cookie with the athlete
 * ID, and then redirects the browser to the dashboard page.
 */
export function createStravaCallbackHandler({ getClient = getSupabaseAdminClient, exchange = exchangeToken } = {}) {
return async function handler(req, res) {
  const { code, state } = req.query;
  const cookies = cookie.parse(req.headers.cookie || '');
  if (!code) {
    res.status(400).send('Missing authorisation code');
    return;
  }

  // Without this check an attacker can hold their own authorization code and
  // trick a signed-in victim into loading this URL, grafting the attacker's
  // Strava account onto the victim's — or, with the victim's code, walking off
  // with their Strava tokens.
  if (!verifyOAuthState(req, 'strava', state)) {
    clearOAuthState(res, 'strava');
    res.setHeader('Location', '/connections?error=oauth_state');
    res.statusCode = 302;
    res.end();
    return;
  }
  clearOAuthState(res, 'strava');
  const returnPath = consumeOAuthReturnPath(req, res, 'strava');

  try {
    const scopes = typeof req.query.scope === 'string' ? req.query.scope.split(',') : [];
    if (!scopes.some(scope => ['activity:read', 'activity:read_all'].includes(scope))) {
      res.setHeader('Location', '/connections?error=strava_permissions');
      res.statusCode = 302; res.end(); return;
    }
    const supabase = getClient();
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const redirectUri = getStravaRedirectUri(req);
    if (!clientId || !clientSecret) {
      throw new Error(
        'Missing Strava environment variables: STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET are required.'
      );
    }
    const tokenData = await exchange(code, clientId, clientSecret, redirectUri);
    const { access_token, refresh_token, expires_at, athlete } = tokenData;
    if (!/^\d+$/.test(String(athlete?.id || '')) || !access_token || !refresh_token || !Number.isFinite(expires_at)) {
      throw new Error('Invalid Strava token response');
    }
    const athleteName = [athlete.firstname, athlete.lastname].filter(Boolean).join(' ').trim();
    const existingAthleteId = getAthleteIdFromRequest(req);
    const existingSession = existingAthleteId ? await getAthleteByCookie(req, supabase) : null;
    if (existingAthleteId && !existingSession) return res.status(401).send('Please sign in again before connecting Strava.');
    if (existingSession?.strava_id && String(existingSession.strava_id) !== String(athlete.id)) {
      return res.status(409).send('Disconnect the previous Strava account before connecting a different one.');
    }
    const tokenFields = { strava_id: athlete.id.toString(), access_token, refresh_token,
      token_expires_at: new Date(expires_at * 1000).toISOString(),
      last_activity_sync_at: null, last_activity_sync_error: null };
    const primaryRoleIntent = getPersistedPrimaryRoleIntent(req);
    let savedAthlete;

    if (existingAthleteId) {
      // Deliberately does NOT write `email`. Overwriting the account's address
      // with whatever Strava reports would silently move the account to a
      // different identity — and that address is what password reset and
      // identity linking key off.
      const { data: linkedAthlete, error: linkError } = await supabase
        .from('athletes')
        .update(tokenFields)
        .eq('id', existingAthleteId)
        .select('id, onboarding_complete, primary_role, name, subscription_tier, session_version')
        .single();
      if (linkError) throw linkError;
      savedAthlete = linkedAthlete;
    } else {
      // No session: this is a sign-in, not a link. Matching an existing
      // athlete by the email Strava reports used to happen here, and it let
      // anyone who could set that address on a Strava profile walk into the
      // matching Threshold account — including accounts that already had a
      // password login. We cannot verify Strava's email claim, so the only
      // safe anonymous match is on `strava_id`.
      //
      // A returning user whose account exists under that email is sent to log
      // in instead, so they end up connecting Strava from inside their own
      // session rather than silently forking a second account.
      const { data: returningAthlete, error: returningError } = await supabase.from('athletes')
        .select('id').eq('strava_id', athlete.id.toString()).maybeSingle();
      if (returningError) throw returningError;
      if (returningAthlete) {
        // Returning Strava sign-in must preserve paid tiers, profile and role.
        const { data, error } = await supabase.from('athletes').update(tokenFields)
          .eq('id', returningAthlete.id).eq('strava_id', athlete.id.toString())
          .select('id, onboarding_complete, primary_role, name, subscription_tier, session_version').single();
        if (error) throw error;
        savedAthlete = data;
      }
      if (!savedAthlete && athlete.email) {
        const { data: emailMatches } = await supabase
          .from('athletes')
          .select('id')
          .eq('email', athlete.email)
          .is('strava_id', null)
          .limit(1);

        if (emailMatches?.length) {
          res.setHeader('Location', '/login?error=strava_email_exists');
          res.statusCode = 302;
          res.end();
          return;
        }
      }

      if (!savedAthlete) {
        const { data: insertedAthlete, error: athleteError } = await supabase
          .from('athletes')
          .insert(
            {
              name: athleteName || null,
              email: athlete.email || null,
              ...tokenFields,
              subscription_tier: 'free',
              ...(primaryRoleIntent ? { primary_role: primaryRoleIntent } : {}),
            }
          )
          .select('id, onboarding_complete, primary_role, name, subscription_tier, session_version')
          .single();
        if (athleteError) throw athleteError;
        savedAthlete = insertedAthlete;
      }
    }

    const athleteId = savedAthlete.id;

    // If there's a pending invite token cookie, mark it used now
    const inviteToken = cookies.pending_invite_token;
    if (inviteToken) {
      await supabase
        .from('invites')
        .update({ used_at: new Date().toISOString(), used_by: athleteId })
        .eq('token', inviteToken)
        .is('used_at', null);
    }

    // Both writes APPEND. Assigning the Set-Cookie header outright, as this
    // did before, would drop the OAuth-state cookie cleared at the top of the
    // handler and leave a spent nonce live for its full 30 minutes.
    setAthleteCookie(res, athleteId, savedAthlete.session_version);
    appendSetCookie(
      res,
      cookie.serialize('pending_invite_token', '', {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        httpOnly: true,
        maxAge: 0,
      })
    );

    const access = await loadAccountAccess(supabase, savedAthlete);
    const destination = savedAthlete.onboarding_complete || isCoachInvitationPath(returnPath)
      ? (returnPath || access.defaultPath)
      : buildOnboardingPath(returnPath, {
        strava: 'connected',
        name: savedAthlete.name || athleteName || 'Strava athlete',
      });
    res.setHeader('Location', destination);
    res.statusCode = 302;
    res.end();
  } catch (err) {
    console.error('[strava/callback] failed:', { code: err?.code || 'provider_error' });
    res.status(500).send('Failed to process Strava callback');
  }
};
}
export default createStravaCallbackHandler();
