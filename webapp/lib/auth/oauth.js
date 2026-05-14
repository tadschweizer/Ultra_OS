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
  return `${buildAbsoluteSiteUrl(req)}/api/strava/callback`;
}

export function getGoogleRedirectUri(req) {
  return `${buildAbsoluteSiteUrl(req)}/auth/callback`;
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
