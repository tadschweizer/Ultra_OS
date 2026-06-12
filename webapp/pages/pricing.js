import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/guide', label: 'How It Works' },
  { href: '/content', label: 'Research' },
  { href: '/login', label: 'Login' },
];

const plans = [
  {
    id: 'coach',
    name: 'Coach',
    flagship: true,
    badge: 'For coaching businesses',
    description: 'The full coach operating system — roster triage, protocol assignment, athlete analytics, and race prep oversight. Flat rate, any roster size.',
    includes: [
      'Coach Command Center with daily roster triage',
      'Protocol assignments for athletes and groups',
      'Per-athlete readiness, compliance + missing-data view',
      'Coach notes, shared resources + athlete messaging',
      'Race plan + post-race debrief oversight',
      'Everything in Individual for your own training',
    ],
    billing: {
      monthly: { price: '$69', checkoutPlan: 'coach_monthly', note: 'Billed monthly — cancel anytime', cta: 'Start Coach' },
      annual: { price: '$48', checkoutPlan: 'coach_annual', note: '$580 billed annually — save $248/yr', cta: 'Start Coach Annual' },
    },
  },
  {
    id: 'individual',
    name: 'Individual Athlete',
    flagship: false,
    badge: 'Self-coached',
    description: 'Full Threshold for self-coached athletes — log interventions, correlate training response, and build your race plan.',
    includes: [
      'Free research library included',
      'Intervention logging (heat, gut, sleep, bicarb…)',
      'Workout check-ins + training response correlations',
      'Race blueprint auto-builder',
      'Insights dashboard + post-race debrief',
      'Strava activity sync',
    ],
    billing: {
      monthly: { price: '$15', checkoutPlan: 'individual_monthly', note: 'Billed monthly — cancel anytime', cta: 'Start Individual' },
      annual: { price: '$12', checkoutPlan: 'individual_annual', note: '$144 billed annually — save $36/yr', cta: 'Start Individual Annual' },
    },
  },
];

const faq = [
  {
    q: 'How does coach pricing work as my roster grows?',
    a: 'The Coach plan is flat-rate. Whether you coach 5 athletes or 50, your price stays the same — no per-athlete fees, no billing surprises as you scale.',
  },
  {
    q: 'Do my athletes need their own paid plan?',
    a: 'Athletes join your roster with a free account and can log interventions and check-ins your coaching depends on. Athletes who also want the full self-serve toolkit (insights dashboard, race blueprint) can add an Individual plan.',
  },
  {
    q: 'Is Threshold free right now?',
    a: 'Threshold has a real free tier. You can create an account, use the research library, and explore the app before upgrading to unlock unlimited logging, full insights, and coach features.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Monthly plans can be canceled at any time with no penalty. Annual plans run for the full term and renew unless canceled before the renewal date.',
  },
  {
    q: 'Is research included for free?',
    a: 'Yes. The research library is part of the free tier. Paid plans are for deeper logging, insights, race blueprint tools, and coach workflows.',
  },
  {
    q: 'Is this a replacement for TrainingPeaks?',
    a: 'No — Threshold is an intervention intelligence layer, not a full training-planning platform. Many athletes use both. Threshold tracks the protocols (heat blocks, gut training, bicarb, sleep) that training platforms don\'t capture.',
  },
  {
    q: 'Do you integrate with Garmin and Strava?',
    a: 'Strava is live today. Threshold supports both Strava-synced sessions and manual logging.',
  },
  {
    q: 'What is a Workout Check-in?',
    a: 'After each training session you log how your legs felt, energy level, and RPE. Threshold then automatically compares each check-in against every intervention logged in the prior 48 hours and surfaces correlations — like "your legs score 2.1 points higher the day after a sauna session."',
  },
];

function CheckIcon() {
  return (
    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
      ✓
    </span>
  );
}

export default function PricingPage() {
  const [athleteId, setAthleteId] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState('annual');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/athlete_id=([^;]+)/);
      if (match) setAthleteId(match[1]);
    }
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
            Built for coaches.<br />Priced for rosters.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-ink/65">
            The Coach plan is the core of Threshold — one flat rate for your whole roster. Self-coached athletes get the full toolkit on the Individual plan.
          </p>
          {/* Beta banner */}
          <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-accent/30 bg-accent/10 px-6 py-3">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <p className="text-sm font-semibold text-ink">
              Free tier available now — upgrade only when you need more depth
            </p>
          </div>

          {/* Billing period toggle */}
          <div className="mt-8 inline-flex items-center rounded-full border border-ink/10 bg-white p-1 shadow-sm">
            {[
              { id: 'monthly', label: 'Monthly' },
              { id: 'annual', label: 'Annual — save up to 30%' },
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

        {/* ── Plan cards ───────────────────────────────────────────── */}
        <section className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
          {plans.map((plan) => {
            const billing = plan.billing[billingPeriod];
            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-[28px] border p-7 ${
                  plan.flagship
                    ? 'border-accent/30 bg-[linear-gradient(135deg,#fffbf0_0%,#fdf3d7_100%)] shadow-[0_12px_40px_rgba(245,158,11,0.15)]'
                    : 'border-ink/10 bg-white shadow-[0_8px_24px_rgba(19,24,22,0.05)]'
                }`}
              >
                <span
                  className={`absolute -top-3 left-6 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${
                    plan.flagship ? 'bg-accent text-white' : 'bg-ink/80 text-paper'
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

                <a
                  href={`/api/billing/checkout?plan=${encodeURIComponent(billing.checkoutPlan)}`}
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
          })}
        </section>

        {/* ── Research Feed add-on ─────────────────────────────────── */}
        <section className="mx-auto mt-4 max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-ink/10 bg-white px-7 py-5 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ink/40">Research Feed</p>
              <p className="mt-1 text-sm text-ink/65">
                Just want the curated endurance research digest? Get the standalone feed for{' '}
                <span className="font-mono font-semibold text-ink">$7/mo</span>.
              </p>
            </div>
            <a
              href="/api/billing/checkout?plan=research_monthly"
              className="rounded-full border border-ink/15 bg-paper px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-ink hover:text-paper"
            >
              Start Research Feed →
            </a>
          </div>
        </section>

        {/* ── Feature comparison ───────────────────────────────────── */}
        <section className="mt-10">
          <div className="rounded-[28px] border border-ink/10 bg-white p-8 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/40">What's included</p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[540px] text-sm">
                <thead>
                  <tr className="border-b border-ink/8">
                    <th className="py-3 pr-6 text-left text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">Feature</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-ink/40">Free</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-ink/40">Individual</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-accent">Coach</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Research library', free: true, individual: true, coach: true },
                    { label: 'Intervention logging', free: false, individual: true, coach: true },
                    { label: 'Workout check-ins', free: false, individual: true, coach: true },
                    { label: 'Training response correlations', free: false, individual: true, coach: true },
                    { label: 'Race blueprint auto-builder', free: false, individual: true, coach: true },
                    { label: 'Post-race outcome debrief', free: false, individual: true, coach: true },
                    { label: 'Strava activity sync', free: false, individual: true, coach: true },
                    { label: 'Coach Command Center + roster triage', free: false, individual: false, coach: true },
                    { label: 'Protocol assignments (athletes + groups)', free: false, individual: false, coach: true },
                    { label: 'Per-athlete readiness + compliance view', free: false, individual: false, coach: true },
                    { label: 'Coach notes + athlete messaging', free: false, individual: false, coach: true },
                  ].map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? 'bg-paper/40' : ''}>
                      <td className="py-3 pr-6 text-ink/70">{row.label}</td>
                      <td className="px-3 py-3 text-center">
                        {row.free ? <span className="text-emerald-600">✓</span> : <span className="text-ink/20">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {row.individual ? <span className="font-semibold text-emerald-600">✓</span> : <span className="text-ink/20">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {row.coach ? <span className="text-emerald-600">✓</span> : <span className="text-ink/20">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>


        <section className="mt-16 rounded-[28px] border border-ink/10 bg-white p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Why coaches choose Threshold</p>
          <h2 className="mt-3 text-2xl font-semibold text-ink md:text-3xl">The Coach plan is the product. Your athletes power it.</h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-ink/70">
            <p>Threshold is built around the coach-athlete loop: athletes log interventions and check-ins in seconds, and the Command Center turns that data into your daily triage — who needs attention, who races soon, who is off-protocol, who needs a message.</p>
            <p>Assign protocol templates to athletes or whole groups, track compliance trends, and see who is responding well versus who needs plan adjustments — without digging through message threads.</p>
            <p>Coach billing is flat-rate, so your monthly cost is predictable and does not scale with roster size. Threshold sits alongside TrainingPeaks rather than replacing your planning stack.</p>
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
              Free during beta. No card needed.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-white/55">
              Create a free account, set up your roster or connect your training sources, and upgrade when you are ready for the full coach or athlete toolkit.
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
