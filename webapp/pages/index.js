import { useEffect, useState } from 'react';

/**
 * Home page with a hero section and a call to action.
 *
 * If the athlete is already logged in (determined by a client‑side
 * cookie), show a link to the dashboard. Otherwise show a button to
 * initiate Strava login.
 */
export default function Home() {
  const [athleteId, setAthleteId] = useState(null);
  const interventionHighlights = [
    {
      title: 'Heat Acclimation',
      body: 'Track sauna blocks, hot-session exposure, and race-week timing against actual outcomes.',
    },
    {
      title: 'Fueling + Gut Training',
      body: 'Log carbohydrate progression, GI response, and what actually held together past hour four.',
    },
    {
      title: 'Bicarb + Supplement Trials',
      body: 'Preserve protocol details, tolerance, and whether the intervention helped or just added noise.',
    },
  ];

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/athlete_id=([^;]+)/);
      if (match) {
        setAthleteId(match[1]);
      }
    }
  }, []);
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#1d4d8f_0%,#0b2545_40%,#061427_100%)] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 rounded-[36px] border border-white/10 bg-slate-950/35 p-6 backdrop-blur md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">UltraOS</p>
              <h1 className="mt-4 max-w-4xl text-5xl font-bold leading-tight md:text-7xl">
                Performance intelligence for athletes who go long.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-slate-200">
                TrainingPeaks logs your workouts. UltraOS tracks the intervention stack around them:
                heat blocks, gut training, sodium bicarbonate, altitude exposure, sleep manipulation,
                and the race each protocol was supposed to help.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                {athleteId ? (
                  <a href="/dashboard" className="rounded-full bg-accent px-6 py-3 font-semibold text-primary">
                    Go to Dashboard
                  </a>
                ) : (
                  <a href="/api/strava/login" className="rounded-full bg-accent px-6 py-3 font-semibold text-primary">
                    Login with Strava
                  </a>
                )}
                <a href="/log-intervention" className="rounded-full border border-white/20 px-6 py-3 font-semibold text-white">
                  Explore the Log
                </a>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">AI Insight Placeholder</p>
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Race Build Pattern</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Placeholder: upcoming models will compare intervention blocks against race outcomes,
                    GI tolerance, and late-race fade points.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">What the platform will surface</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Which protocol stacks repeated before strong races, which ones carried side effects,
                    and how your response changed across prep cycles.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {interventionHighlights.map((item) => (
            <article key={item.title} className="rounded-[28px] border border-white/10 bg-slate-950/45 p-6">
              <p className="text-sm uppercase tracking-[0.22em] text-accent">{item.title}</p>
              <p className="mt-4 text-sm leading-6 text-slate-200">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] border border-white/10 bg-slate-950/45 p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">What gets captured</p>
            <ul className="mt-5 space-y-3 text-sm text-slate-200">
              <li>Intervention type, protocol details, and dosage or duration.</li>
              <li>Linked Strava workout context, date, duration, and elevation gain.</li>
              <li>Target race context, training phase, and athlete-reported response.</li>
            </ul>
          </div>
          <div className="rounded-[30px] border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Why this exists</p>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-100">
              Serious endurance athletes run experiments constantly, but the protocol layer usually lives in
              scattered notes, screenshots, or memory. UltraOS turns that into a structured dataset that can
              eventually support real personal pattern recognition instead of generic advice.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
