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
      body: 'Track sauna blocks, hot-session exposure, altitude-tent nights, and when those blocks actually translated on race day.',
    },
    {
      title: 'Fueling + Gut Training',
      body: 'Preserve carbohydrate progression, sodium targets, GI response, and what still held up late in the session.',
    },
    {
      title: 'Protocol Stack Review',
      body: 'See the whole build around a race instead of a scattered trail of screenshots, notes, and memory.',
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
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">UltraOS</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/settings" className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink">
              Settings
            </a>
            {athleteId ? (
              <a href="/dashboard" className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper">
                Dashboard
              </a>
            ) : (
              <a href="/api/strava/login" className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper">
                Connect Strava
              </a>
            )}
          </div>
        </div>

        <div className="mb-12 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Performance Intelligence</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                See the prep behind the result.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/80">
                UltraOS is the intervention layer around endurance training. It tracks heat work,
                fueling, sodium bicarbonate, sleep manipulation, altitude, and the target race each
                protocol was supposed to improve.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                {athleteId ? (
                  <a href="/dashboard" className="rounded-full bg-ink px-6 py-3 font-semibold text-paper">
                    Go to Dashboard
                  </a>
                ) : (
                  <a href="/api/strava/login" className="rounded-full bg-ink px-6 py-3 font-semibold text-paper">
                    Login with Strava
                  </a>
                )}
                <a href="/log-intervention" className="rounded-full border border-ink/20 bg-white/50 px-6 py-3 font-semibold text-ink">
                  Log an Intervention
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">Context</p>
                  <p className="mt-2 text-sm text-ink/80">Race target, training phase, and athlete baseline settings live with each entry.</p>
                </div>
                <div className="rounded-[24px] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">Activity Tie-In</p>
                  <p className="mt-2 text-sm text-ink/80">Linked Strava activity date, duration, elevation, and altitude context get pulled automatically.</p>
                </div>
                <div className="rounded-[24px] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">Future Analysis</p>
                  <p className="mt-2 text-sm text-ink/80">AI insight blocks remain placeholders until the intervention dataset is strong enough to trust.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.25em] text-accent">AI Insight Placeholder</p>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Not live yet</span>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Race Build Review</p>
                  <p className="mt-2 text-sm text-white/75">
                    Future versions will compare intervention blocks against race outcomes, GI tolerance, altitude load, and late-race fade points.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">What Will Matter</p>
                  <p className="mt-2 text-sm text-white/75">
                    Which protocol stacks kept recurring before good races, which ones added cost without payoff, and where your prep consistently broke down.
                  </p>
                </div>
                <div className="rounded-[24px] border border-accent/30 bg-accent/10 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Current Focus</p>
                  <p className="mt-2 text-sm text-white/80">
                    Build cleaner intervention data first. The moat is the dataset, not the placeholder analysis card.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {interventionHighlights.map((item) => (
            <article key={item.title} className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
              <p className="text-sm uppercase tracking-[0.22em] text-accent">{item.title}</p>
              <p className="mt-4 text-sm leading-6 text-ink/80">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] border border-ink/10 bg-white p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">What gets captured</p>
            <ul className="mt-5 space-y-3 text-sm text-ink/80">
              <li>Intervention type, protocol details, and dosage or duration.</li>
              <li>Linked Strava workout context, date, duration, elevation, and altitude detail.</li>
              <li>Target race context, training phase, and athlete-reported response.</li>
            </ul>
          </div>
          <div className="rounded-[30px] bg-[linear-gradient(135deg,#1b2421_0%,#29302d_100%)] p-6 text-white">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Why this exists</p>
            <p className="mt-5 max-w-3xl text-base leading-7 text-white/80">
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
