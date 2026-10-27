import { athleteOpenAccess, athleteAccessMessage } from '../lib/athleteAccessPolicy';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import PublicHeader from '../components/PublicHeader';
import CoachingExample from '../components/CoachingExample';

const pilotFeatures = [
  { title: 'Coach calendar and roster', body: 'Plan workouts, review logged results and find the athlete you need to speak with.' },
  { title: 'Daily athlete check-ins', body: 'Record how the session felt and ask your coach for a response. Your feedback stays with the assigned session.' },
  { title: 'Messages and session discussions', body: 'Keep coach feedback with the training. Open inbox conversations refresh automatically.' },
  { title: 'Calculated training comparisons', body: 'Review totals, training-load estimates and check-in comparisons where your plan and available data support them. They use rules and formulas, with assumptions and data limits.' },
  { title: 'Manual race and intervention records', body: 'Keep race dates, course details, goals and intervention history editable. You and your coach choose the plan.' },
  { title: 'Supported activity imports', body: 'Strava, COROS and Suunto are in progress; Garmin is next. Record workouts manually while those connections are developed.' },
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
  const coachHref = athleteId ? '/coach-command-center' : '/signup?role=coach';

  return (
    <main className="public-site min-h-screen bg-paper text-ink">
      <Head>
        <title>Threshold | Training plans, check-ins and coach feedback</title>
        <meta name="description" content="Copy and customize a training week, review planned versus actual results, and reply or adjust the next session. Coach access requires approval." />
        <meta property="og:title" content="Threshold | Plan, log, review and reply" />
        <meta property="og:description" content="Weekly planning, completed-session review and coach replies together. Coach access requires approval." />
      </Head>
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-4 pb-10">
        <section className="mt-8 grid items-start gap-8 py-4 md:py-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
          <div>
            <h1 className="font-display text-4xl font-semibold leading-tight md:text-6xl">Plan the week. Review the result. Keep coaching.</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-ink/75">
              Copy a training week, tailor each athlete’s sessions, then review the prescription, results and feedback together. Reply or adjust the next workout while the session is still in view.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={coachHref} className="ui-button-primary">Create a pilot account</a>
              <a href="/guide" className="ui-button-secondary">See how it works</a>
            </div>
            <p className="mt-4 text-sm leading-6 text-ink/80">Closed coach pilot. Approval required, with up to five athletes per approved coach.</p>
            <p className="mt-5 text-base leading-7 text-ink/80">Here for your own training? <a href={athleteId ? '/dashboard' : '/signup'} className="inline-flex min-h-11 items-center font-semibold text-ink underline">Start as an athlete</a>.</p>
            {athleteOpenAccess() && <p className="mt-3 max-w-[65ch] text-sm leading-6 text-ink/80"><strong>Free athlete access.</strong> {athleteAccessMessage()} <a href="/pricing" className="font-semibold text-ink underline">See access details</a>.</p>}
          </div>
          <CoachingExample compact />
        </section>
        <section className="mt-10 border-t border-ink/15 py-9">
          <h2 className="text-3xl font-semibold">What you can use in the pilot</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pilotFeatures.map(feature => <article key={feature.title}>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-7 text-ink/75">{feature.body}</p>
            </article>)}
          </div>
        </section>
        <section className="mt-10 rounded-2xl bg-panel p-6 text-paper md:p-8">
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

      </div>
    </main>
  );
}
