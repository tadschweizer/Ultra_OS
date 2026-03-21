import { useEffect, useMemo, useState } from 'react';
import {
  buildInsightCards,
  classifyActivity,
  metersToFeet,
  metersToMiles,
  secondsToHours,
  sortActivitiesMostRecentFirst,
  summarizeRecentTraining,
} from '../lib/activityInsights';

function formatActivityDate(startDate) {
  return new Date(startDate).toLocaleString();
}

function formatMiles(value) {
  return `${value.toFixed(1)} mi`;
}

function formatFeet(value) {
  return `${Math.round(value).toLocaleString()} ft`;
}

function formatHours(value) {
  return `${value.toFixed(1)} hrs`;
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
        if (!meRes.ok) return;

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
          setActivities(sortActivitiesMostRecentFirst(actData.activities));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const trainingSummary = useMemo(() => summarizeRecentTraining(activities), [activities]);
  const insightCards = useMemo(
    () => buildInsightCards(activities, interventionCount, settings || {}),
    [activities, interventionCount, settings]
  );
  const classifiedActivities = useMemo(
    () =>
      activities.slice(0, 6).map((activity) => ({
        ...activity,
        classification: classifyActivity(activity, settings || {}),
      })),
    [activities, settings]
  );

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
            <a href="/connections" className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink">
              Connections
            </a>
            <a href="/settings" className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink">
              Settings
            </a>
            <a href="/log-intervention" className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper">
              Log Intervention
            </a>
          </div>
        </div>

        <div className="mb-10 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Training Intelligence</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                Hello, {athlete.name}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/80">
                This is the operating surface. Weekly mileage, vertical, time, workout intent,
                intervention coverage, and future AI pattern detection belong here.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="/log-intervention" className="rounded-full bg-ink px-6 py-3 font-semibold text-paper">
                  Log an Intervention
                </a>
                <a href="/history" className="rounded-full border border-ink/20 bg-white/50 px-6 py-3 font-semibold text-ink">
                  Review History
                </a>
              </div>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.25em] text-accent">7-Day Training Snapshot</p>
                <a href="/connections" className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                  Manage Sources
                </a>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Mileage</p>
                  <p className="mt-2 text-xl font-semibold">{formatMiles(trainingSummary.mileage)}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Elevation</p>
                  <p className="mt-2 text-xl font-semibold">{formatFeet(trainingSummary.elevation)}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Time Spent</p>
                  <p className="mt-2 text-xl font-semibold">{formatHours(trainingSummary.hours)}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Interventions</p>
                  <p className="mt-2 text-xl font-semibold">{interventionCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.22em] text-accent">Activities</p>
            <p className="mt-4 text-3xl font-semibold text-ink">{trainingSummary.activityCount}</p>
            <p className="mt-2 text-sm text-ink/75">Sessions in the last 7 days.</p>
          </article>
          <article className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.22em] text-accent">Threshold Readiness</p>
            <p className="mt-4 text-3xl font-semibold text-ink">
              {settings?.hr_zone_3_min ? 'Configured' : 'Needs zones'}
            </p>
            <p className="mt-2 text-sm text-ink/75">HR-zone-driven workout classification depends on saved zones.</p>
          </article>
          <article className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.22em] text-accent">Source Coverage</p>
            <p className="mt-4 text-3xl font-semibold text-ink">1</p>
            <p className="mt-2 text-sm text-ink/75">Strava is active. Garmin, COROS, Zwift, and TrainingPeaks are next.</p>
          </article>
          <article className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.22em] text-accent">AI Status</p>
            <p className="mt-4 text-3xl font-semibold text-ink">Seeded</p>
            <p className="mt-2 text-sm text-ink/75">Heuristics are live. Personalized causal claims still need more paired data.</p>
          </article>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">AI Insight Queue</p>
            <div className="mt-5 space-y-4">
              {insightCards.map((card) => (
                <div key={card.title} className="rounded-[24px] bg-paper p-4">
                  <p className="text-sm font-semibold text-ink">{card.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/75">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] bg-[linear-gradient(135deg,#1b2421_0%,#29302d_100%)] p-6 text-white">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Connection Roadmap</p>
              <a href="/connections" className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/80">
                Open
              </a>
            </div>
            <div className="mt-5 space-y-3">
              {[
                'Strava connected now for activity + altitude context.',
                'TrainingPeaks descriptions are the clearest path to workout-intent parsing.',
                'Garmin, COROS, and Zwift should coexist so UltraOS is not tied to a single source.',
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[30px] bg-[linear-gradient(135deg,#1b2421_0%,#29302d_100%)] p-6 text-white">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Recent Activity Feed</p>
            <p className="mt-2 text-sm text-white/70">Most recent first.</p>
            <div className="mt-5 space-y-3">
              {classifiedActivities.map((activity) => (
                <div key={activity.id} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{activity.name}</p>
                      <p className="mt-1 text-sm text-white/70">{formatActivityDate(activity.start_date)}</p>
                    </div>
                    <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-panel">
                      {activity.classification.label}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/80">
                    <span>{formatMiles(metersToMiles(activity.distance))}</span>
                    <span>{formatHours(secondsToHours(activity.moving_time))}</span>
                    <span>{formatFeet(metersToFeet(activity.total_elevation_gain))}</span>
                  </div>
                  <p className="mt-3 text-sm text-white/70">{activity.classification.reason}</p>
                </div>
              ))}
              {classifiedActivities.length === 0 ? (
                <p className="text-sm text-white/70">No recent Strava activities were found.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Inference Inputs</p>
              <a href="/settings" className="rounded-full border border-ink/10 px-3 py-1 text-xs text-ink/80">
                Edit
              </a>
            </div>
            {settings ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] bg-paper p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Resting HR</p>
                  <p className="mt-2 text-xl font-semibold">{settings.resting_hr ?? '-'}</p>
                </div>
                <div className="rounded-[24px] bg-paper p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Zone 3 Min</p>
                  <p className="mt-2 text-xl font-semibold">{settings.hr_zone_3_min ?? '-'}</p>
                </div>
                <div className="rounded-[24px] bg-paper p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Zone 4 Min</p>
                  <p className="mt-2 text-xl font-semibold">{settings.hr_zone_4_min ?? '-'}</p>
                </div>
                <div className="rounded-[24px] bg-paper p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Sleep Altitude</p>
                  <p className="mt-2 text-xl font-semibold">{settings.baseline_sleep_altitude_ft ?? '-'} ft</p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-ink/10 bg-paper p-4">
                <p className="text-sm text-ink/75">
                  Save HR zones and baseline settings so workout-intent classification and future insights have real anchors.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
