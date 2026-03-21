import { useEffect, useState } from 'react';

function formatActivityDate(startDate) {
  return new Date(startDate).toLocaleString();
}

function formatDistance(distanceMeters) {
  if (!distanceMeters) return 'N/A';
  return `${(distanceMeters / 1609.34).toFixed(1)} mi`;
}

function formatDuration(seconds) {
  if (!seconds) return 'N/A';
  return `${Math.round(seconds / 60)} min`;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState(null);
  const [activities, setActivities] = useState([]);
  const [interventionCount, setInterventionCount] = useState(0);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
          const me = await meRes.json();
          setAthlete(me.athlete);
          setInterventionCount(me.interventionCount);

          const settingsRes = await fetch('/api/settings');
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            setSettings(settingsData.settings);
          }

          const actRes = await fetch('/api/activities');
          if (actRes.ok) {
            const actData = await actRes.json();
            const sortedActivities = [...actData.activities].sort(
              (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
            );
            setActivities(sortedActivities);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!athlete) {
    return (
      <div className="p-4">
        <p>You are not logged in.</p>
        <a href="/" className="text-accent underline">
          Go to Home
        </a>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">UltraOS Dashboard</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/" className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink">
              Home
            </a>
            <a href="/settings" className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink">
              Settings
            </a>
            <a href="/log-intervention" className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper">
              Log Intervention
            </a>
          </div>
        </div>

        <div className="mb-12 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Athlete Snapshot</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                Hello, {athlete.name}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/80">
                Your dashboard should feel like the landing page after login: same product language,
                but now pointed at your actual intervention history, baseline context, and recent training data.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="/log-intervention" className="rounded-full bg-ink px-6 py-3 font-semibold text-paper">
                  Log an Intervention
                </a>
                <a href="/history" className="rounded-full border border-ink/20 bg-white/50 px-6 py-3 font-semibold text-ink">
                  View History
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">Recent Activities</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{activities.length}</p>
                  <p className="mt-1 text-sm text-ink/75">Last 7 days from Strava</p>
                </div>
                <div className="rounded-[24px] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">Interventions Logged</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{interventionCount}</p>
                  <p className="mt-1 text-sm text-ink/75">Structured entries in your log</p>
                </div>
                <div className="rounded-[24px] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">Settings Status</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{settings ? 'Ready' : 'Needs Setup'}</p>
                  <p className="mt-1 text-sm text-ink/75">Baseline context for later analysis</p>
                </div>
              </div>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.25em] text-accent">Baseline Context</p>
                <a href="/settings" className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                  Edit
                </a>
              </div>
              {settings ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-accent">Sleep Altitude</p>
                    <p className="mt-2 text-xl font-semibold">{settings.baseline_sleep_altitude_ft ?? '-'} ft</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-accent">Training Altitude</p>
                    <p className="mt-2 text-xl font-semibold">{settings.baseline_training_altitude_ft ?? '-'} ft</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-accent">Carbs</p>
                    <p className="mt-2 text-xl font-semibold">{settings.normal_long_run_carb_g_per_hr ?? '-'} g/hr</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-accent">Sodium</p>
                    <p className="mt-2 text-xl font-semibold">{settings.sodium_target_mg_per_hr ?? '-'} mg/hr</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-accent">Resting HR</p>
                    <p className="mt-2 text-xl font-semibold">{settings.resting_hr ?? '-'}</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-accent">Sleep</p>
                    <p className="mt-2 text-xl font-semibold">{settings.typical_sleep_hours ?? '-'} hrs</p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[24px] border border-accent/30 bg-accent/10 p-4">
                  <p className="text-sm text-white/85">
                    Add athlete settings so altitude, fueling, sodium, and HR-based analysis has usable baseline context.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.22em] text-accent">Intervention Log</p>
            <p className="mt-4 text-sm leading-6 text-ink/80">
              Add the protocol, attach the workout when relevant, and keep race context tied to the entry.
            </p>
          </article>
          <article className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.22em] text-accent">History Review</p>
            <p className="mt-4 text-sm leading-6 text-ink/80">
              Review intervention entries by race, date, and subjective response instead of reconstructing prep from memory.
            </p>
          </article>
          <article className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.22em] text-accent">Athlete Baselines</p>
            <p className="mt-4 text-sm leading-6 text-ink/80">
              Your altitude, fueling, sleep, and HR context live here so future analysis has something real to compare against.
            </p>
          </article>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] border border-ink/10 bg-white p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Action Shortcuts</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/log-intervention" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper">
                New Intervention
              </a>
              <a href="/history" className="rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-ink">
                Open History
              </a>
              <a href="/settings" className="rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-ink">
                Update Settings
              </a>
            </div>
          </div>
          <div className="rounded-[30px] bg-[linear-gradient(135deg,#1b2421_0%,#29302d_100%)] p-6 text-white">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Recent Activity Feed</p>
            <div className="mt-5 space-y-3">
              {activities.slice(0, 5).map((act) => (
                <div key={act.id} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">{act.name}</p>
                  <p className="mt-1 text-sm text-white/70">{formatActivityDate(act.start_date)}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/80">
                    <span>{formatDistance(act.distance)}</span>
                    <span>{formatDuration(act.moving_time)}</span>
                    <span>
                      {act.total_elevation_gain
                        ? `${Math.round(act.total_elevation_gain * 3.28084)} ft gain`
                        : 'Elevation N/A'}
                    </span>
                  </div>
                </div>
              ))}
              {activities.length === 0 ? (
                <p className="text-sm text-white/70">No recent Strava activities were found.</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
