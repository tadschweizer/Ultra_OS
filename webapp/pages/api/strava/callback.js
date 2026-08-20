import { exchangeToken } from '../../../lib/strava';
import { getSupabaseAdminClient } from '../../../lib/authServer';
import cookie from 'cookie';
import { normalizeSubscriptionTier } from '../../../lib/subscriptionTiers';
import { getStravaRedirectUri } from '../../../lib/auth/oauth.js';
import { clearOAuthState, consumeOAuthReturnPath, verifyOAuthState } from '../../../lib/auth/oauthState.js';
import { isCoachInvitationPath } from '../../../lib/auth/redirects.js';
import {
  appendSetCookie,
  getAthleteIdFromRequest,
  setAthleteCookie,
} from '../../../lib/auth/sessionCookies.js';

// Server-side routes cannot use the anon client: it carries no Supabase
// session, so auth.uid() is null and every RLS policy denies it. This route
// uses the service-role client and authorises from the session athlete id.
const supabase = getSupabaseAdminClient();

/**
 * Handle the Strava OAuth callback.
 *
 * Exchanges the provided code for an access token and refresh token,
 * upserts the athlete record in Supabase, sets a cookie with the athlete
 * ID, and then redirects the browser to the dashboard page.
 */
export default async function handler(req, res) {
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
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const redirectUri = getStravaRedirectUri(req);
    if (!clientId || !clientSecret) {
      throw new Error(
        'Missing Strava environment variables: STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET are required.'
      );
    }
    const tokenData = await exchangeToken(code, clientId, clientSecret, redirectUri);
    const { access_token, refresh_token, expires_at, athlete } = tokenData;
    const athleteName = [athlete.firstname, athlete.lastname].filter(Boolean).join(' ').trim();
    const existingAthleteId = getAthleteIdFromRequest(req);
    let savedAthlete;

    if (existingAthleteId) {
      // Deliberately does NOT write `email`. Overwriting the account's address
      // with whatever Strava reports would silently move the account to a
      // different identity — and that address is what password reset and
      // identity linking key off.
      const { data: linkedAthlete, error: linkError } = await supabase
        .from('athletes')
        .update({
          strava_id: athlete.id.toString(),
          access_token,
          refresh_token,
          token_expires_at: new Date(expires_at * 1000).toISOString(),
        })
        .eq('id', existingAthleteId)
        .select('id, onboarding_complete, name, subscription_tier, session_version')
        .single();
      if (linkError) throw linkError;
      savedAthlete = linkedAthlete;
    } else {
      // No session: this is a sign-in, not a link. Matching an existing
      // athlete by the email Strava reports used to happen here, and it let
      // anyone who could set that address on a Strava profile walk into the
      // matching Threshold account — including accounts that already had a
      // password login. We cannot verify Strava's email claim, so the only
      // safe anonymous match is on `strava_id` (the upsert below).
      //
      // A returning user whose account exists under that email is sent to log
      // in instead, so they end up connecting Strava from inside their own
      // session rather than silently forking a second account.
      if (athlete.email) {
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
        const { data: upsertedAthlete, error: athleteError } = await supabase
          .from('athletes')
          .upsert(
            {
              name: athleteName || null,
              email: athlete.email || null,
              strava_id: athlete.id.toString(),
              access_token,
              refresh_token,
              token_expires_at: new Date(expires_at * 1000).toISOString(),
              subscription_tier: 'free',
            },
            { onConflict: 'strava_id' }
          )
          .select('id, onboarding_complete, name, subscription_tier, session_version')
          .single();
        if (athleteError) throw athleteError;
        savedAthlete = upsertedAthlete;
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

    const destination = savedAthlete.onboarding_complete || isCoachInvitationPath(returnPath)
      ? (returnPath || '/dashboard')
      : `/onboarding?strava=connected&name=${encodeURIComponent(savedAthlete.name || athleteName || 'Strava athlete')}`;
    res.setHeader('Location', destination);
    res.statusCode = 302;
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to process Strava callback');
  }
}
