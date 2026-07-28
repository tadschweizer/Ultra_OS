import { getConnector } from './connectors';
import { createOAuthState, clearOAuthState, verifyOAuthState } from './auth/oauthState.js';
import { getAthleteIdFromRequest } from './auth/sessionCookies.js';

/**
 * Shared OAuth handlers for the wearable connectors (Garmin, Oura, COROS,
 * Ultrahuman). All eight route files were byte-identical copies; they now
 * delegate here so a fix lands once instead of four times.
 *
 * Two things were wrong with the copies:
 *
 * 1. The callback exchanged the authorization code and then echoed the raw
 *    access and refresh tokens back to the browser as JSON — on a route that
 *    required no authentication at all. Anyone who reached it walked away with
 *    live provider credentials.
 *
 * 2. `state` was the static string `provider:<name>`, which is the same for
 *    every user and therefore no CSRF protection whatsoever.
 *
 * Persistence for these providers was never built (the callbacks' own comment
 * said "persist this once credentials are approved"). Rather than exchange a
 * code and drop the result on the floor, the callback now stops before the
 * exchange and reports that the connector is unfinished. No token is ever
 * minted, so none can leak.
 */

function requireConfiguredConnector(provider, res) {
  const connector = getConnector(provider);
  if (!connector?.isConfigured()) {
    res.status(503).json({
      error: `${provider} connector not configured`,
      missing_env: [
        `${provider.toUpperCase()}_CLIENT_ID`,
        `${provider.toUpperCase()}_CLIENT_SECRET`,
        `${provider.toUpperCase()}_REDIRECT_URI`,
      ],
    });
    return null;
  }
  return connector;
}

/**
 * Starts a connector link. Requires a session: connecting a wearable attaches
 * it to a specific athlete, so there is no such thing as an anonymous start.
 */
export function handleConnectorLogin(provider, req, res) {
  if (!getAthleteIdFromRequest(req)) {
    res.setHeader('Location', `/login?next=${encodeURIComponent('/connections')}`);
    res.statusCode = 302;
    res.end();
    return;
  }

  const connector = requireConfiguredConnector(provider, res);
  if (!connector) return;

  const state = createOAuthState(res, provider);
  res.setHeader('Location', connector.buildLoginUrl(state));
  res.statusCode = 302;
  res.end();
}

/**
 * Finishes a connector link. Verifies the session and the CSRF nonce, then
 * stops: there is nowhere to store the tokens yet, and returning them to the
 * browser is what made the old handler dangerous.
 */
export async function handleConnectorCallback(provider, req, res) {
  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const connector = requireConfiguredConnector(provider, res);
  if (!connector) return;

  const stateOk = verifyOAuthState(req, provider, req.query?.state);
  clearOAuthState(res, provider);
  if (!stateOk) {
    res.status(400).json({ error: 'Invalid OAuth state. Start the connection again.' });
    return;
  }

  if (!req.query?.code) {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  // Deliberately no `exchangeToken` call. Storage for these providers does not
  // exist, so an exchange would produce credentials with nowhere safe to go.
  res.status(501).json({
    provider,
    error: `The ${provider} connection is not available yet.`,
  });
}
