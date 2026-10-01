// Only Strava has token persistence and activity ingestion today.
export function integrationAvailability(env = process.env) {
  return { strava: Boolean(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET
    && (env.STRAVA_REDIRECT_URI || env.NEXT_PUBLIC_SITE_URL)) };
}
