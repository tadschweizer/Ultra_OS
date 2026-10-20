import Head from 'next/head';
import PublicHeader from './PublicHeader';
import CoachingExample from './CoachingExample';

const steps = [
  { title: 'Plan a week your athlete can follow',
    body: 'Choose an athlete, add a workout or copy a week, then adjust the dates and instructions. Check each athlete’s sessions before publishing.',
    example: 'Monday: 40 minutes easy. Keep the effort comfortable enough to talk.',
    href: '/coach/training-calendar', action: 'Open coach calendar' },
  { title: 'Record what happened',
    body: 'The athlete opens their calendar, follows the instructions and records completion. Actual time and distance stay separate from the plan. Manual recording is available while provider connections are developed.',
    example: 'Completed: 38 minutes. A shorter session still has a result worth reviewing.',
    href: '/calendar', action: 'Open athlete calendar' },
  { title: 'Share the context',
    body: 'Add a short comment and a rating of perceived exertion: how hard the session felt. If you need an answer, use “Ask coach to respond.”',
    example: '“Legs felt heavy, so I took it easier. Effort: 4 out of 10.”',
    href: '/messages', action: 'Open messages' },
  { title: 'Reply and decide what comes next',
    body: 'The coach reviews the session and feedback together. Reply, mark the session reviewed with no change, or adjust an upcoming workout. A review and a requested reply are separate actions.',
    example: '“Thanks for letting me know. Keep tomorrow easy and tell me how it feels.”',
    href: '/coach-command-center', action: 'Open coach workspace' },
];
const reference = [
  { title: 'Training comparisons', body: 'Review totals, training-load estimates and patterns in your records. Check the time window and missing inputs. Calculated comparisons are observations, not proof of cause and effect.', href: '/insights', action: 'Open insights' },
  { title: 'Race goals', body: 'Keep event dates, course details and your goals with your training history. A race goal is optional.', href: '/races', action: 'Open races' },
  { title: 'Intervention records', body: 'Record a protocol you chose and any notes from the session or race. These records are optional and do not replace your training calendar.', href: '/log-intervention', action: 'Open intervention log' },
  { title: 'Baseline settings', body: 'Keep heart-rate zones, altitude and other training settings current so later comparisons have the right context.', href: '/settings', action: 'Open settings' },
  { title: 'Explorer', body: 'Choose recorded variables to inspect their relationship. Results depend on the amount and quality of the data you have recorded.', href: '/explorer', action: 'Open explorer' },
  { title: 'Research library', body: 'Browse training research when you and your coach want more context for a decision. Reading or logging research is not required to get started.', href: '/content', action: 'Browse research' },
];

export default function PublicGuide() {
  return <main className="public-site min-h-screen bg-paper text-ink">
    <Head><title>How coaching works in Threshold</title><meta name="description" content="Follow one coaching week: plan sessions, record results, share feedback and decide what happens next." /></Head>
    <PublicHeader />
    <div className="mx-auto max-w-6xl px-4 pb-12">
      <section className="max-w-3xl py-10 md:py-14">
        <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">One week, from plan to feedback.</h1>
        <p className="mt-5 max-w-[65ch] text-lg leading-8 text-ink/80">Coach and athlete work from the same training context. Here is how an easy run becomes a useful conversation about what to do next.</p>
        <p className="mt-4 text-sm leading-6 text-ink/80">The examples below use fictional data. Workspace links require an account; coach tools also require approved access.</p>
        <a href="#getting-started" className="ui-button-primary mt-6">Find your first step</a>
      </section>
      <section className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]" aria-label="A coaching week">
        <ol className="divide-y divide-ink/15 border-t border-ink/15">
          {steps.map((step, index) => <li key={step.title} className="py-7 first:pt-6">
            <h2 className="text-xl font-semibold"><span className="mr-2 text-ink/70">{index + 1}.</span>{step.title}</h2>
            <p className="mt-3 max-w-[65ch] text-base leading-7 text-ink/80">{step.body}</p>
            <p className="mt-3 text-sm leading-6 text-ink/80"><strong>Example:</strong> {step.example}</p>
            <a href={step.href} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4">{step.action}</a>
          </li>)}
        </ol>
        <CoachingExample />
      </section>
      <section id="getting-started" className="mt-12 border-t border-ink/15 pt-9">
        <h2 className="text-2xl font-semibold">Your first step</h2>
        <div className="mt-5 grid gap-8 md:grid-cols-2">
          <div><h3 className="text-lg font-semibold">For coaches</h3><p className="mt-3 leading-7 text-ink/80">Create a coach account, then contact the pilot organizer for approval. The pilot supports up to five athletes per approved coach. Creating an account alone does not grant coach access.</p>
            <div className="mt-4 flex flex-wrap gap-3"><a href="/signup?role=coach" className="ui-button-primary">Create a coach pilot account</a><a href="/support" className="ui-button-secondary">Contact support</a></div></div>
          <div><h3 className="text-lg font-semibold">For athletes</h3><p className="mt-3 leading-7 text-ink/80">If your coach sent an invitation, start with that link. Otherwise create an athlete account and plan your own training. You can connect with a coach later.</p>
            <div className="mt-4 flex flex-wrap gap-3"><a href="/signup" className="ui-button-primary">Create an athlete account</a><a href="/pricing" className="ui-button-secondary">See access details</a></div></div>
        </div>
      </section>
      <section className="mt-12 border-t border-ink/15 pt-9" aria-labelledby="reference-title">
        <h2 id="reference-title" className="text-2xl font-semibold">Optional tools and reference</h2>
        <p className="mt-3 max-w-[65ch] leading-7 text-ink/80">Start with the calendar and feedback. Open these tools when they help with a specific training question.</p>
        <div className="mt-5 divide-y divide-ink/15">
          {reference.map(item => <details key={item.title} className="py-1">
            <summary className="cursor-pointer py-4 text-base font-semibold">{item.title}</summary>
            <div className="pb-4"><h3 className="sr-only">{item.title}</h3><p className="max-w-[65ch] leading-7 text-ink/80">{item.body}</p><a href={item.href} className="inline-flex min-h-11 items-center font-semibold text-ink underline">{item.action}</a></div>
          </details>)}
        </div>
      </section>
    </div>
  </main>;
}
