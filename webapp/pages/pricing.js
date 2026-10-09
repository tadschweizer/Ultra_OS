import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';
import { fetchMe } from '../lib/meClient';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/guide', label: 'How It Works' },
  { href: '/content', label: 'Research' },
  { href: '/login', label: 'Login' },
];

// Prices shown here must match the Stripe prices configured for each plan in
// lib/billingPlans.js. Coach plans are listed but not sold while the coach
// product is a closed, administrator-approved pilot.
const athletePlans = [
  {
    id: 'free',
    name: 'Free',
    badge: 'Connect + track',
    description: 'Connect to your coach and keep a clean training log. No card needed.',
    includes: [
      'Strava activity sync',
      'Join a coach and see assigned workouts',
      'Activity history with per-session stats',
      'Workout comments + coach messaging',
      'This week’s distance, time, and elevation',
      '3 check-ins a week (daily with an eligible paid or pilot coach)',
      '15 intervention logs',
      'Research library',
    ],
    billing: {
      monthly: { price: '$0', note: 'Free forever', cta: 'Create free account', href: '/signup' },
      annual: { price: '$0', note: 'Free forever', cta: 'Create free account', href: '/signup' },
    },
  },
  {
    id: 'core',
    name: 'Athlete Core',
    badge: 'Training trends',
    description: 'Strava-style trend analytics without the jargon. Included free when your coach is on a paid Coach plan.',
    includes: [
      'Everything in Free',
      '12-week distance, time, and elevation trends',
      '4-week averages vs. the block before',
      'Longest-session tracking',
      'Unlimited check-ins',
      'Unlimited intervention logging',
    ],
    billing: {
      monthly: { price: '$7', checkoutPlan: 'core_monthly', note: 'Billed monthly — cancel anytime', cta: 'Start Core' },
      annual: { price: '$5', checkoutPlan: 'core_annual', note: '$60 billed annually — save $24/yr', cta: 'Start Core Annual' },
    },
  },
  {
    id: 'pro',
    name: 'Athlete Pro',
    flagship: true,
    badge: 'Advanced analytics',
    description: 'The full deterministic analytics stack — every number is computed from your data, not guessed.',
    includes: [
      'Everything in Core',
      'Fitness, fatigue + form (CTL / ATL / TSB), 84 days',
      'Weekly training load, ramp rate + monotony',
      'HR drift + aerobic decoupling on every steady session',
      'Calculated training-response correlations',
      'Training-load spike alerts',
      'Explorer: chart any input against any outcome',
    ],
    billing: {
      monthly: { price: '$18', checkoutPlan: 'pro_monthly', note: 'Billed monthly — cancel anytime', cta: 'Start Pro' },
      annual: { price: '$13.25', checkoutPlan: 'pro_annual', note: '$159 billed annually — save $57/yr', cta: 'Start Pro Annual' },
    },
  },
];

const coachPlans = [
  {
    id: 'coach_essentials',
    name: 'Coach Essentials',
    badge: 'Up to 10 athletes',
    description: 'Plan, assign, and review — with the volume plots most coaches actually use.',
    includes: [
      'Coach Command Center with daily roster triage',
      'Training calendar + workout assignments',
      'Protocol assignments for athletes and groups',
      'Compliance, readiness + missing-sync views',
      'Coach notes + athlete messaging',
      'Zone, pace, and race-prediction tools',
      'Every athlete on your roster gets Athlete Core free',
    ],
    billing: {
      monthly: { price: '$29', note: 'Per month', cta: 'Join the coach pilot' },
      annual: { price: '$24', note: '$290 billed annually', cta: 'Join the coach pilot' },
    },
  },
  {
    id: 'coach_pro',
    name: 'Coach Pro',
    flagship: true,
    badge: 'Up to 25 athletes',
    description: 'Advanced load metrics for coaches who want them — and Athlete Pro for your own training.',
    includes: [
      'Everything in Coach Essentials',
      'Per-athlete fitness + fatigue trend in the roster',
      'Fitness ramp planner (CTL targets to race day)',
      'Athlete Pro analytics for your own training',
      'Every athlete on your roster gets Athlete Core free',
    ],
    billing: {
      monthly: { price: '$79', note: 'Per month', cta: 'Join the coach pilot' },
      annual: { price: '$66', note: '$790 billed annually', cta: 'Join the coach pilot' },
    },
  },
];

const comparisonColumns = [
  { id: 'free', label: 'Free' },
  { id: 'core', label: 'Core' },
  { id: 'pro', label: 'Pro' },
  { id: 'coach_essentials', label: 'Coach Ess.' },
  { id: 'coach_pro', label: 'Coach Pro' },
];

const comparisonRows = [
  { label: 'Strava sync, activity history, coach connection', tiers: ['free', 'core', 'pro', 'coach_essentials', 'coach_pro'] },
  { label: 'Research library', tiers: ['free', 'core', 'pro', 'coach_essentials', 'coach_pro'] },
  { label: 'This week’s volume totals', tiers: ['free', 'core', 'pro', 'coach_essentials', 'coach_pro'] },
  { label: 'Unlimited check-ins + intervention logging', tiers: ['core', 'pro', 'coach_essentials', 'coach_pro'] },
  { label: '12-week volume trends + block comparison', tiers: ['core', 'pro', 'coach_essentials', 'coach_pro'] },
  { label: 'Fitness / fatigue / form (CTL, ATL, TSB)', tiers: ['pro', 'coach_pro'] },
  { label: 'HR drift + aerobic decoupling', tiers: ['pro', 'coach_pro'] },
  { label: 'Training-response correlations + Explorer', tiers: ['pro', 'coach_pro'] },
  { label: 'Coach Command Center, calendar + assignments', tiers: ['coach_essentials', 'coach_pro'] },
  { label: 'Roster athletes get Athlete Core', tiers: ['coach_essentials', 'coach_pro'] },
  { label: 'Per-athlete load trends + ramp planner', tiers: ['coach_pro'] },
];

const faq = [
  {
    q: 'How are the training metrics calculated?',
    a: 'Fitness, fatigue, form, HR drift, decoupling and correlations use calculations applied to your logged or imported data. Missing inputs and model assumptions affect the result. Automatic reviews and generated plans are not included in the closed pilot.',
  },
  {
    q: 'Do my athletes need their own paid plan?',
    a: 'No. Athletes coached on a paid Coach plan get Athlete Core free for as long as the relationship is active. They can upgrade themselves to Athlete Pro for the advanced analytics. Pilot-linked athletes get daily check-ins.',
  },
  {
    q: 'How do coaches get access today?',
    a: 'Coach plans open for purchase after the closed pilot. Pilot coaches are approved individually by an administrator and receive Coach Pro tools during the pilot. Creating a coach account does not grant access on its own.',
  },
  {
    q: 'I already pay for Individual, Research Feed, or Coach. What happens?',
    a: 'You keep your price and get at least what you had: Individual becomes Athlete Pro, Research Feed becomes Athlete Core, and Coach becomes Coach Pro.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Monthly plans can be canceled at any time with no penalty. Annual plans run for the full term and renew unless canceled before the renewal date.',
  },
  {
    q: 'Do you integrate with Garmin and Strava?',
    a: 'Strava is live today. Threshold supports both Strava-synced sessions and manual logging.',
  },
  {
    q: 'Coaching more athletes than the plan includes?',
    a: 'Contact us during the pilot and we will set up a larger roster. Per-athlete pricing beyond the included roster will be published before coach billing opens.',
  },
  {
    q: 'What is a Workout Check-in?',
    a: 'After each session you log how your legs felt, energy, and RPE. Pro compares each check-in with every intervention logged in the prior 48 hours and surfaces correlations — like "your legs score 2.1 points higher the day after a sauna session."',
  },
];

function CheckIcon() {
  return (
    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
      ✓
    </span>
  );
}

function PlanCard({ plan, billingPeriod, coach = false }) {
  const billing = plan.billing[billingPeriod];
  const href = coach
    ? '/signup?role=coach'
    : billing.checkoutPlan
      ? `/api/billing/checkout?plan=${encodeURIComponent(billing.checkoutPlan)}`
      : billing.href;
  return (
    <article
      className={`relative flex flex-col rounded-[28px] border p-7 ${
        plan.flagship
          ? 'border-accent/30 bg-[linear-gradient(135deg,#fffbf0_0%,#fdf3d7_100%)] shadow-[0_12px_40px_rgba(245,158,11,0.15)]'
          : 'border-ink/10 bg-white shadow-[0_8px_24px_rgba(19,24,22,0.05)]'
      }`}
    >
      <span
        className={`absolute -top-3 left-6 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${
          plan.flagship ? 'bg-accent text-white' : 'bg-ink text-paper'
        }`}
      >
        {plan.badge}
      </span>

      <div>
        <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${plan.flagship ? 'text-accent' : 'text-ink/40'}`}>
          {plan.name}
        </p>
        <div className="mt-4 flex items-end gap-1">
          <span className="font-mono text-4xl font-semibold text-ink">{billing.price}</span>
          <span className="mb-1 text-sm text-ink/50">/month</span>
        </div>
        <p className={`mt-1 text-xs ${billingPeriod === 'annual' ? 'text-emerald-600' : 'text-ink/45'}`}>{billing.note}</p>
        <p className="mt-3 text-sm leading-6 text-ink/60">{plan.description}</p>
      </div>

      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.includes.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-ink/75">
            <CheckIcon />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {plan.comingSoon ? (
        <p className="mt-5 rounded-[16px] border border-accent/25 bg-accent/5 px-4 py-3 text-xs leading-5 text-ink/70">
          <span className="font-semibold text-accent">Coming later · </span>{plan.comingSoon}
        </p>
      ) : null}

      <a
        href={href}
        className={`mt-7 block rounded-full px-5 py-3 text-center text-sm font-semibold transition ${
          plan.flagship
            ? 'bg-ink text-paper shadow-[0_4px_16px_rgba(19,24,22,0.2)] hover:opacity-85'
            : 'border border-ink/15 bg-paper text-ink hover:bg-ink hover:text-paper'
        }`}
      >
        {billing.cta} →
      </a>
    </article>
  );
}

export default function PricingPage() {
  const [athleteId, setAthleteId] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState('annual');

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((data) => {
        if (!cancelled && data?.athlete?.id) setAthleteId(data.athlete.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-paper text-ink">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 px-4 pt-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between rounded-full border border-ink/10 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <a href="/" className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">Threshold</a>
            <div className="hidden items-center gap-7 lg:flex">
              {(athleteId ? [{ href: '/dashboard', label: 'Dashboard' }, ...navLinks.slice(1, 3)] : navLinks.slice(0, 3)).map((link) => (
                <a key={link.href} href={link.href} className="text-sm font-semibold text-ink/65 transition hover:text-ink">
                  {link.label}
                </a>
              ))}
              <a href={athleteId ? '/dashboard' : '/login'} className="ui-button-primary py-2.5">
                {athleteId ? 'Open App' : 'Login'}
              </a>
            </div>
            <NavMenu
              label="Pricing navigation"
              links={athleteId ? [{ href: '/dashboard', label: 'Dashboard' }, ...navLinks.slice(1)] : navLinks}
              primaryLink={{ href: athleteId ? '/dashboard' : '/login', label: athleteId ? 'Open App' : 'Login' }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-24">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="mt-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">Pricing</p>
          <h1 className="font-display mx-auto mt-5 max-w-2xl text-5xl font-semibold leading-tight text-ink md:text-6xl">
            Start free.<br />Pay for the analytics you use.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-ink/65">
            Free connects you to your coach. Core adds training trends. Pro adds the full analytics stack. Coaches pick Essentials for plots and stats, or Pro for advanced load metrics.
          </p>
          {/* Beta banner */}
          <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-accent/30 bg-accent/10 px-6 py-3">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <p className="text-sm font-semibold text-ink">
              Coach plans: closed pilot, approval required
            </p>
          </div>

          {/* Billing period toggle */}
          <div className="mt-8 inline-flex items-center rounded-full border border-ink/10 bg-white p-1 shadow-sm">
            {[
              { id: 'monthly', label: 'Monthly' },
              { id: 'annual', label: 'Annual — save up to 29%' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setBillingPeriod(option.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  billingPeriod === option.id ? 'bg-ink text-paper shadow-sm' : 'text-ink/55 hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Athlete plans ────────────────────────────────────────── */}
        <section className="mt-10">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-ink/40">For athletes</p>
          <div className="mx-auto mt-5 grid max-w-6xl gap-4 md:grid-cols-3">
            {athletePlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} billingPeriod={billingPeriod} />
            ))}
          </div>
        </section>

        {/* ── Coach plans ──────────────────────────────────────────── */}
        <section className="mt-14">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-ink/40">For coaches</p>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-6 text-ink/60">
            Coach billing opens after the closed pilot. Approved pilot coaches use Coach Pro tools at no cost during the pilot.
          </p>
          <div className="mx-auto mt-5 grid max-w-4xl gap-4 md:grid-cols-2">
            {coachPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} billingPeriod={billingPeriod} coach />
            ))}
          </div>
        </section>

        {/* ── Feature comparison ───────────────────────────────────── */}
        <section className="mt-12">
          <div className="rounded-[28px] border border-ink/10 bg-white p-8 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/40">Compare plans</p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-ink/8">
                    <th className="py-3 pr-6 text-left text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">Feature</th>
                    {comparisonColumns.map((column) => (
                      <th key={column.id} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-ink/40">{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? 'bg-paper/40' : ''}>
                      <td className="py-3 pr-6 text-ink/70">{row.label}</td>
                      {comparisonColumns.map((column) => (
                        <td key={column.id} className="px-3 py-3 text-center">
                          {row.tiers.includes(column.id) ? (
                            <span className="font-semibold text-emerald-600">✓</span>
                          ) : row.comingSoon?.includes(column.id) ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">Later</span>
                          ) : (
                            <span className="text-ink/20">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────── */}
        <section className="mt-10">
          <div className="rounded-[28px] border border-ink/10 bg-white p-8 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/40">FAQ</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {faq.map((item) => (
                <div key={item.q} className="rounded-[18px] border border-ink/8 bg-paper p-5">
                  <p className="text-sm font-semibold text-ink">{item.q}</p>
                  <p className="mt-3 text-sm leading-7 text-ink/60">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <section className="mt-10">
          <div className="rounded-[32px] bg-panel px-8 py-12 text-center text-white md:px-16">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Get started free</p>
            <h2 className="font-display mx-auto mt-4 max-w-xl text-3xl font-semibold md:text-4xl">
              Free to start. No card needed.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-white/55">
              Athletes can start on Free and upgrade any time. Coaches create an account, then ask the pilot organizer for approval.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href={athleteId ? '/coach-command-center' : '/signup?role=coach'}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition hover:opacity-90"
              >
                {athleteId ? 'Open Command Center →' : 'Start as a Coach →'}
              </a>
              <a
                href={athleteId ? '/dashboard' : '/signup'}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-8 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {athleteId ? 'Go to Dashboard' : 'Start as an Athlete'}
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-ink/8 pt-8 text-xs text-ink/35">
          <a href="/" className="font-semibold uppercase tracking-[0.3em] text-accent">Threshold</a>
          <div className="flex gap-6">
            <a href="/" className="hover:text-ink/60">Home</a>
            <a href="/guide" className="hover:text-ink/60">How It Works</a>
            <a href="/content" className="hover:text-ink/60">Research</a>
          </div>
          <p>© {new Date().getFullYear()} Threshold</p>
        </footer>

      </div>
    </main>
  );
}
