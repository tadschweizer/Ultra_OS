import { exchangeToken, getStravaRedirectUri } from '../../../lib/strava';
import cookie from 'cookie';
import { syncAthleteStravaActivities } from '../../../lib/stravaSync';
import { normalizeSubscriptionTier } from '../../../lib/subscriptionTiers';
import {
  clearAdminAccessCookie,
  getAthleteIdFromRequest,
  getSupabaseAdminClient,
  setAdminAccessCookie,
  setSignedAthleteSessionCookie,
} from '../../../lib/authServer';
import { upsertProviderConnection } from '../../../lib/providerEvents';


/**
 * Handle the Strava OAuth callback.
 *
 * Exchanges the provided code for an access token and refresh token,
 * upserts the athlete record in Supabase, sets a cookie with the athlete
 * ID, and then redirects the browser to the dashboard page.
 */
export default async function handler(req, res) {
  const { code } = req.query;
  const cookies = cookie.parse(req.headers.cookie || '');
  const isLinkMode = cookies.pending_account_link === '1';
  if (!code) {
    res.status(400).send('Missing authorisation code');
    return;
  }
  try {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const redirectUri = getStravaRedirectUri(req);
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'Missing Strava environment variables: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and STRAVA_REDIRECT_URI are required.'
      );
    }
    const tokenData = await exchangeToken(code, clientId, clientSecret, redirectUri);
    const { access_token, refresh_token, expires_at, athlete } = tokenData;
    const athleteName = [athlete.firstname, athlete.lastname].filter(Boolean).join(' ').trim();
    const existingAthleteId = isLinkMode ? getAthleteIdFromRequest(req) : null;
    const adminClient = getSupabaseAdminClient();
    const grantedScopes = String(tokenData.scope || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const athletePayload = {
      strava_id: athlete.id.toString(),
      access_token,
      refresh_token,
      token_expires_at: new Date(expires_at * 1000).toISOString(),
      email: athlete.email || null,
    };
    let savedAthlete;

    if (existingAthleteId) {
        const { data: linkedAthlete, error: linkError } = await adminClient
          .from('athletes')
          .update({
            ...athletePayload,
          })
          .eq('id', existingAthleteId)
          .select('id, onboarding_complete, name, subscription_tier, is_admin')
          .single();
      if (linkError) throw linkError;
      savedAthlete = linkedAthlete;
    } else {
      if (athlete.email) {
        const { data: matchedAthlete } = await adminClient
          .from('athletes')
          .select('id, subscription_tier')
          .eq('email', athlete.email)
          .maybeSingle();

        if (matchedAthlete) {
          const { data: linkedAthlete, error: linkError } = await adminClient
            .from('athletes')
            .update({
              ...athletePayload,
              subscription_tier: normalizeSubscriptionTier(matchedAthlete.subscription_tier),
            })
            .eq('id', matchedAthlete.id)
            .select('id, onboarding_complete, name, subscription_tier, is_admin')
            .single();
          if (linkError) throw linkError;
          savedAthlete = linkedAthlete;
        }
      }

      if (!savedAthlete) {
        const { data: upsertedAthlete, error: athleteError } = await adminClient
          .from('athletes')
          .upsert(
            {
              name: athleteName || null,
              ...athletePayload,
              subscription_tier: 'free',
            },
            { onConflict: 'strava_id' }
          )
          .select('id, onboarding_complete, name, subscription_tier, is_admin')
          .single();
        if (athleteError) throw athleteError;
        savedAthlete = upsertedAthlete;
      }
    }

    const athleteId = savedAthlete.id;
    await upsertProviderConnection(adminClient, {
      athleteId,
      provider: 'strava',
      providerAthleteId: athlete.id,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt: new Date(expires_at * 1000).toISOString(),
      scopes: grantedScopes,
      metadata: {
        athlete_name: athleteName || null,
      },
    });

    try {
      await syncAthleteStravaActivities({
        admin: adminClient,
        athleteId,
        force: true,
      });
    } catch (syncError) {
      console.warn('[strava/callback] initial activity sync failed:', syncError.message || syncError);
    }

    // If there's a pending invite token cookie, mark it used now
    const inviteToken = cookies.pending_invite_token;
    if (inviteToken) {
      await adminClient
        .from('invites')
        .update({ used_at: new Date().toISOString(), used_by: athleteId })
        .eq('token', inviteToken)
        .is('used_at', null);
    }

    const cookieOptions = { secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };

    // Set athlete_id cookie + clear the pending invite token cookie
    const setCookies = [
      cookie.serialize('athlete_id', athleteId, {
        ...cookieOptions,
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 30, // 30 days
      }),
      cookie.serialize('pending_account_link', '', {
        ...cookieOptions,
        httpOnly: true,
        maxAge: 0,
      }),
      cookie.serialize('pending_invite_token', '', {
        ...cookieOptions,
        httpOnly: true,
        maxAge: 0, // clear it
      }),
    ];
    res.setHeader('Set-Cookie', setCookies);
    setSignedAthleteSessionCookie(res, athleteId);
    if (savedAthlete.is_admin) {
      setAdminAccessCookie(res, athleteId);
    } else {
      clearAdminAccessCookie(res);
    }

    const destination = savedAthlete.onboarding_complete
      ? '/dashboard'
      : `/onboarding?strava=connected&name=${encodeURIComponent(savedAthlete.name || athleteName || 'Strava athlete')}`;
    res.setHeader('Location', destination);
    res.statusCode = 302;
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to process Strava callback');
  }
}
