import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';

const sources = [
  {
    name: 'Strava',
    status: 'Available now',
    description: 'Recent activities, altitude context, and the first connected training source.',
    href: '/api/strava/login',
    action: 'Connect',
    enabled: true,
  },
  {
    name: 'Garmin',
    status: 'Planned',
    description: 'Device and physiology data, including a future path for resting HR automation.',
    href: '#',
    action: 'Coming soon',
    enabled: false,
  },
  {
    name: 'COROS',
    status: 'Planned',
    description: 'Additional training-source coverage so UltraOS is not tied to a single ecosystem.',
    href: '#',
    action: 'Coming soon',
    enabled: false,
  },
  {
    name: 'Zwift',
    status: 'Planned',
    description: 'Indoor sessions and workout intent from structured bike/run sessions.',
    href: '#',
    action: 'Coming soon',
    enabled: false,
  },
  {
    name: 'TrainingPeaks',
    status: 'Strategic next step',
    description: 'Planned workout descriptions are the strongest path to intent parsing like threshold runs and hill strides.',
    href: '#',
    action: 'Coming soon',
    enabled: false,
  },
];

export default function Connections() {
  const [athleteId, setAthleteId] = useState(null);
  const navLinks = athleteId
    ? [
        { href: '/dashboard', label: 'UltraOS Home', description: 'Insights, trends, and recent training.' },
        { href: '/connections', label: 'Connections', description: 'Manage linked training sources.' },
        { href: '/log-intervention', label: 'Log Intervention', description: 'Add a new intervention entry.' },
        { href: '/history', label: 'Intervention History', description: 'Review what you have logged.' },
        { href: '/settings', label: 'Settings', description: 'Adjust athlete baselines and zones.' },
        { href: '/', label: 'Landing Page', description: 'Return to the marketing/login surface.' },
      ]
    : [{ href: '/', label: 'Landing Page', description: 'Return to the UltraOS entry page.' }];

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/athlete_id=([^;]+)/);
      if (match) {
        setAthleteId(match[1]);
      }
    }
  }, []);

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">UltraOS Connections</p>
          </div>
          <NavMenu
            label="Connections navigation"
            links={navLinks}
            primaryLink={athleteId ? { href: '/dashboard', label: 'UltraOS Home' } : { href: '/', label: 'Landing Page', variant: 'secondary' }}
          />
        </div>

        <div className="mb-10 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Source Linking</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                Connect the sources behind your training.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/80">
                UltraOS should support multiple sources at the same time. This is where those connections belong.
                Strava is active now. The rest of the integration surface is being seeded here deliberately.
              </p>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Current Model</p>
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">One UltraOS login, multiple data sources.</p>
                  <p className="mt-2 text-sm text-white/75">
                    The app should not read like a Strava-only product. It should read like an intelligence layer that can sit above several ecosystems.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Workout-intent parsing needs planned workout text.</p>
                  <p className="mt-2 text-sm text-white/75">
                    TrainingPeaks descriptions are the best future path for understanding sessions like threshold work and hill strides.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => (
            <article key={source.name} className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm uppercase tracking-[0.22em] text-accent">{source.name}</p>
                <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">{source.status}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink/80">{source.description}</p>
              {source.enabled ? (
                <a href={source.href} className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper">
                  {athleteId ? 'Reconnect' : source.action}
                </a>
              ) : (
                <span className="mt-6 inline-flex rounded-full border border-ink/10 px-5 py-3 text-sm font-semibold text-ink/45">
                  {source.action}
                </span>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
