import { useEffect, useState } from 'react';
import Head from 'next/head';
import NavMenu from '../components/NavMenu';

const publicLinks = [
  { href: '/guide', label: 'How it works' },
  { href: '/content', label: 'Research' },
  { href: '/pricing', label: 'Pricing' },
];
const pilotSteps = [
  { title: 'Plan the week', body: 'Create and assign workouts on the training calendar. Give each session a date, a goal and clear instructions.' },
  { title: 'Log what happened', body: 'Athletes record completion and actual values, or import supported activities. Keep planned and actual work distinct.' },
  { title: 'Check in', body: 'Record legs feel, energy and RPE, with an optional note. The coach can review these alongside the training history.' },
  { title: 'Review and reply', body: 'Discuss a session or use the shared inbox. The coach decides what to change and communicates it directly.' },
];
const pilotFeatures = [
  { title: 'Coach calendar and roster', body: 'Plan workouts, review logged results and find the athlete you need to speak with.' },
  { title: 'Daily athlete check-ins', body: 'Athletes linked to an eligible paid or pilot coach can record daily feedback. Product limits and access are shown in the account.' },
  { title: 'Messages and session discussions', body: 'Keep coach feedback with the training. Open inbox conversations refresh automatically.' },
  { title: 'Calculated training comparisons', body: 'Review totals, training-load estimates and check-in comparisons where your plan and available data support them. They use rules and formulas, with assumptions and data limits.' },
  { title: 'Manual race and intervention records', body: 'Keep race dates, course details, goals and intervention history editable. You and your coach choose the plan.' },
  { title: 'Supported activity imports', body: 'Strava availability is shown in Connections. Other providers stay unavailable until their access and integration are ready.' },
];

export default function LandingPage() {
  const [athleteId, setAthleteId] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/me', { signal: controller.signal }).then(async response => {
      if (response.ok) {
        const data = await response.json();
        if (!controller.signal.aborted) setAthleteId(data.athlete?.id || null);
      }
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const loginHref = athleteId ? '/dashboard' : '/login';
  const coachHref = athleteId ? '/coach-command-center' : '/signup?role=coach';

  return (
    <main className="min-h-screen bg-paper text-ink">
      <Head>
        <title>Threshold | Training plans, check-ins and coach feedback</title>
        <meta name="description" content="A closed coach pilot for planning workouts, logging results, daily check-ins and coach-athlete feedback. Coach access requires approval." />
        <meta property="og:title" content="Threshold | Plan, log, review and reply" />
        <meta property="og:description" content="Manual workout planning and athlete feedback in one place. Closed pilot, with administrator-approved coach access." />
      </Head>
      <header className="sticky top-0 z-50 px-4 pt-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-ink/10 bg-white/90 px-4 py-3 backdrop-blur">
          <a href="/" className="text-xs font-semibold uppercase tracking-[0.25em] text-ink">Threshold</a>
          <nav aria-label="Public navigation" className="hidden items-center gap-7 lg:flex">
            {publicLinks.map(link => <a key={link.href} href={link.href} className="text-sm font-semibold text-ink">{link.label}</a>)}
            <a href={loginHref} className="ui-button-primary">{athleteId ? 'Open Threshold' : 'Log In'}</a>
          </nav>
          <NavMenu label="Homepage navigation" links={publicLinks} primaryLink={{ href: loginHref, label: athleteId ? 'Open App' : 'Login' }} />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pb-10">
        <section className="mt-6 grid gap-8 rounded-[32px] border border-ink/10 bg-[linear-gradient(145deg,#f7f2ea,#eadcc7)] p-6 md:p-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="ui-eyebrow !text-ink">Closed coach pilot</p>
            <h1 className="font-display mt-4 text-4xl font-semibold leading-tight md:text-6xl">Plan the work. Keep the feedback close.</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-ink/75">
              Plan workouts, record what happened, check in and talk with your coach.
              Threshold brings that daily training loop into one place.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={coachHref} className="ui-button-primary">Create a pilot account</a>
              <a href="/guide" className="ui-button-secondary">See how it works</a>
            </div>
            <p className="mt-4 text-sm text-ink/70">Coach approval required. Up to five athletes per approved pilot coach.</p>
          </div>
          <aside aria-label="Illustrative training week" className="rounded-2xl border border-ink/10 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink">Illustration only</p>
            <h2 className="mt-3 text-xl font-semibold">A simple training week</h2>
            <p className="mt-2 text-sm text-ink/70">Example entries, not live athlete data.</p>
            <ol className="mt-5 space-y-4 text-sm">
              <li className="rounded-xl bg-paper p-4"><strong>Monday: easy run</strong><p className="mt-1">Coach writes the session instructions.</p></li>
              <li className="rounded-xl bg-paper p-4"><strong>After the run</strong><p className="mt-1">Athlete records completion and a check-in.</p></li>
              <li className="rounded-xl bg-paper p-4"><strong>Coach review</strong><p className="mt-1">Review the result and send a reply.</p></li>
            </ol>
          </aside>
        </section>
        <section className="mt-12">
          <h2 className="text-3xl font-semibold">The pilot workflow</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {pilotSteps.map((step, index) => <article key={step.title} className="ui-card">
              <p className="font-mono text-sm text-ink">0{index + 1}</p>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-ink/75">{step.body}</p>
            </article>)}
          </div>
        </section>
        <section className="mt-12 rounded-[28px] border border-ink/10 bg-white p-6 md:p-8">
          <h2 className="text-3xl font-semibold">What you can use in the pilot</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pilotFeatures.map(feature => <article key={feature.title}>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-7 text-ink/75">{feature.body}</p>
            </article>)}
          </div>
        </section>
        <section className="mt-12 rounded-[28px] bg-panel p-6 text-paper md:p-8">
          <h2 className="text-3xl font-semibold">A small pilot, with clear limits</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7">
            We are testing the daily coach-athlete workflow with a small group. Coach access is approved
            separately from signup. Automatic reviews, generated plans and automatic research summaries
            are deferred. The pilot does not claim TrainingPeaks parity or a connection to its planning data.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-7">
            Calculated comparisons can help you review your history. They do not establish cause and effect,
            predict race readiness or replace your coach&apos;s judgment. Pilot task times and reliability are
            still being measured.
          </p>
          <a href={coachHref} className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink">Join the coach pilot</a>
        </section>
        <section className="mt-8 rounded-2xl border border-ink/10 bg-white p-6">
          <h2 className="text-xl font-semibold">Training on your own?</h2>
          <p className="mt-3 text-sm leading-7 text-ink/75">Keep your workout, race and intervention history together. Your account shows which calculated comparisons your plan includes.</p>
          <a href={athleteId ? '/dashboard' : '/signup'} className="ui-button-secondary mt-4">Start as an athlete</a>
        </section>
        <footer className="mt-10 flex flex-wrap gap-5 text-sm">
          <a href="/privacy" className="text-ink">Privacy</a><a href="/terms" className="text-ink">Terms</a><a href="/support" className="text-ink">Support</a>
        </footer>
      </div>
    </main>
  );
}
