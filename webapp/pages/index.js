import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';

export default function Home() {
  const [athleteId, setAthleteId] = useState(null);
  const navLinks = athleteId
    ? [
        { href: '/dashboard', label: 'UltraOS Home', description: 'Insights, trends, and recent training.' },
        { href: '/connections', label: 'Connections', description: 'Link Strava and future sources.' },
        { href: '/log-intervention', label: 'Log Intervention', description: 'Add a new protocol entry.' },
        { href: '/history', label: 'Intervention History', description: 'Review your logged interventions.' },
        { href: '/settings', label: 'Settings', description: 'Update athlete baselines and zones.' },
      ]
    : [{ href: '/api/strava/login', label: 'Login', description: 'Enter UltraOS with the current connected login flow.' }];

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
            <p className="text-xs uppercase tracking-[0.35em] text-accent">UltraOS</p>
          </div>
          <NavMenu
            label="Homepage navigation"
            links={navLinks}
            primaryLink={{ href: athleteId ? '/dashboard' : '/api/strava/login', label: athleteId ? 'UltraOS Home' : 'Login' }}
          />
        </div>

        <div className="mb-12 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Performance Intelligence For Athletes Who Go Long</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                Track the interventions behind race-day outcomes.
              </h1>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href={athleteId ? '/dashboard' : '/api/strava/login'} className="rounded-full bg-ink px-6 py-3 font-semibold text-paper">
                  {athleteId ? 'Open UltraOS Home' : 'Login to UltraOS'}
                </a>
                {athleteId ? (
                  <a href="/connections" className="rounded-full border border-ink/20 bg-white/50 px-6 py-3 font-semibold text-ink">
                    Add Connection / Source
                  </a>
                ) : null}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">Interventions</p>
                </div>
                <div className="rounded-[24px] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">Connections</p>
                </div>
                <div className="rounded-[24px] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">Insights</p>
                </div>
              </div>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.25em] text-accent">Why This Exists</p>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Phase 1 MVP</span>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Training logs miss the protocol layer.</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">UltraOS is building the intervention dataset.</p>
                </div>
                <div className="rounded-[24px] border border-accent/30 bg-accent/10 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Current Path</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Heat, gut, sleep, altitude',
              body: 'The product is designed around performance interventions serious endurance athletes actually test during race builds.',
            },
            {
              title: 'Multi-source by design',
              body: 'The login button is for UltraOS. Source linking belongs one step deeper, where Strava is joined by future integrations.',
            },
            {
              title: 'Insights belong in dashboard',
              body: 'Weekly totals, workout intent, intervention patterns, and AI inference should appear after login, not on the homepage.',
            },
          ].map((item) => (
            <article key={item.title} className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
              <p className="text-sm uppercase tracking-[0.22em] text-accent">{item.title}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
