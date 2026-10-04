export default function StravaAttribution({ activityId = null, dark = false }) {
  const id = String(activityId || '');
  return <p className={`mt-3 text-xs leading-6 ${dark ? 'text-white/80' : 'text-ink/80'}`}>
    Strava integration: Powered by Strava
    {/^\d+$/.test(id) && <> · <a href={`https://www.strava.com/activities/${id}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">View on Strava</a></>}
  </p>;
}
