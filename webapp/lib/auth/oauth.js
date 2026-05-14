export function buildAbsoluteSiteUrl(req) {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const proto = req?.headers?.['x-forwarded-proto'] || 'http';
  const host = req?.headers?.host;
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

export function getStravaRedirectUri(req) {
  const explicit = process.env.STRAVA_REDIRECT_URI;
  if (explicit) return explicit;
  // Only fall back to dynamic detection when NEXT_PUBLIC_SITE_URL is explicitly
  // set, so we don't silently produce a URL that won't match Strava's registered
  // redirect URI (Strava rejects mismatches with a 400 Bad Request).
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/api/strava/callback`;
  }
  return null;
}

export function getAccessTokenFromCallbackUrl(rawUrl) {
  const url = new URL(rawUrl, 'http://localhost');
  if (url.searchParams.get('code')) return null;
  const hash = (url.hash || '').replace(/^#/, '');
  const params = new URLSearchParams(hash);
  return {
    accessToken: params.get('access_token') || null,
    refreshToken: params.get('refresh_token') || null,
  };
}
