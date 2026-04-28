import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/guide', label: 'How It Works' },
  { href: '/content', label: 'Research' },
  { href: '/api/strava/login', label: 'Login' },
];

const tiers = [
  {
    id: 'research_feed',
    name: 'Research Feed',
    price: '$7',
    period: 'month',
    annualNote: null,
    description: 'The evidence layer — curated sports science without the full tracking system.',
    includes: [
      '72 peer-reviewed studies, plain English',
      '19 topic filters (heat, gut, HRV, taper…)',
      'Bookmark studies for race week',
      'Sport-relevance scores (ultra / gravel / triathlon)',
    ],
    checkoutPlan: 'research_monthly',
    cta: 'Start Research Feed',
    bestValue: false,
    highlight: false,
  },
  {
    id: 'individual_monthly',
    name: 'Individual',
    price: '$29',
    period: 'month',
    annualNote: null,
    description: 'Full Threshold — log, correlate, and plan. Flexible month-to-month.',
    includes: [
      'Everything in Research Feed',
      'Intervention logging (heat, gut, sleep, bicarb…)',
      'Workout check-ins + training response correlations',
      'Race blueprint auto-builder',
      'Insights dashboard',
      'Post-race outcome debrief',
      'Strava activity sync',
    ],
    checkoutPlan: 'individual_monthly',
    cta: 'Start Individual Monthly',
    bestValue: false,
    highlight: false,
  },
  {
    id: 'individual_annual',
    name: 'Individual Annual',
    price: '$20',
    period: 'month',
    annualNote: '$240 billed annually — save $108/yr',
    description: 'Full Threshold at the lowest per-month cost.',
    includes: [
      'Everything in Individual Monthly',
      'Lowest per-month price',
      'Priority feature access',
    ],
    checkoutPlan: 'individual_annual',
    cta: 'Start Individual Annual',
    bestValue: true,
    highlight: true,
  },
  {
    id: 'coach_monthly',
    name: 'Coach',
    price: '$59.99',
    period: 'month',
    annualNote: null,
    description: 'Everything in Individual, plus a clean coaching workspace for up to 25 athletes.',
    includes: [
      'Everything in Individual, plus:',
      'Multi-athlete dashboard',
      'Protocol assignment',
      'Cohort comparison',
      'Compliance tracking',
      'Private coach notes',
      'Up to 25 athletes',
      'No per-athlete fees',
    ],
    checkoutPlan: 'coach_monthly',
    cta: 'Start Coach Monthly',
    bestValue: false,
    highlight: false,
  },
  {
    id: 'coach_annual',
    name: 'Coach Annual',
    price: '$42.50',
    period: 'month',
    annualNote: '$509.99 billed annually — save $209.89/yr',
    description: 'The same flat coach plan, billed annually for the best effective monthly rate.',
    includes: [
      'Everything in Individual, plus:',
      'Multi-athlete dashboard',
      'Protocol assignment',
      'Cohort comparison',
      'Compliance tracking',
      'Private coach notes',
      'Up to 25 athletes',
      'No per-athlete fees',
    ],
    checkoutPlan: 'coach_annual',
    cta: 'Start Coach Annual',
    bestValue: true,
    highlight: false,
  },
];

const faq = [
  {
    q: 'Is Threshold free right now?',
    a: 'Threshold has a real free tier. You can create an account, use the research library, and explore the app before upgrading to unlock unlimited logging, full insights, and coach features.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Monthly plans can be canceled at any time with no penalty. Annual plans run for the full term and renew unless canceled before the renewal date.',
  },
  {
    q: 'What is the Research Feed?',
    a: 'The Research Feed is Threshold\'s curated library of peer-reviewed sports science — 72 studies across 19 topics written in plain English with practical takeaways. It\'s the lightest plan if you just want the evidence layer.',
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
            Simple pricing.<br />No surprises.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-ink/65">
            Start on the free tier, then upgrade when you want deeper logging, premium insights, or coach workflows.
          </p>
          {/* Beta banner */}
          <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-accent/30 bg-accent/10 px-6 py-3">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <p className="text-sm font-semibold text-ink">
              Free tier available now — upgrade only when you need more depth
            </p>
          </div>
        </section>

        {/* ── Tier cards ───────────────────────────────────────────── */}
        <section className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tiers.map((tier) => (
            <article
              key={tier.id}
              className={`relative flex flex-col rounded-[28px] border p-7 ${
                tier.highlight
                  ? 'border-accent/30 bg-[linear-gradient(135deg,#fffbf0_0%,#fdf3d7_100%)] shadow-[0_12px_40px_rgba(245,158,11,0.15)]'
                  : 'border-ink/10 bg-white shadow-[0_8px_24px_rgba(19,24,22,0.05)]'
              }`}
            >
              {tier.bestValue ? (
                <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  Best Value
                </span>
              ) : null}

              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${tier.highlight ? 'text-accent' : 'text-ink/40'}`}>
                  {tier.name}
                </p>
                <div className="mt-4 flex items-end gap-1">
                  <span className="font-mono text-4xl font-semibold text-ink">{tier.price}</span>
                  <span className="mb-1 text-sm text-ink/50">/{tier.period}</span>
                </div>
                {tier.annualNote ? (
                  <p className="mt-1 text-xs text-emerald-600">{tier.annualNote}</p>
                ) : null}
                <p className="mt-3 text-sm leading-6 text-ink/60">{tier.description}</p>
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {tier.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-ink/75">
                    <CheckIcon />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <a
                href={`/api/billing/checkout?plan=${encodeURIComponent(tier.checkoutPlan)}`}
                className={`mt-7 block rounded-full px-5 py-3 text-center text-sm font-semibold transition ${
                  tier.highlight
                    ? 'bg-ink text-paper shadow-[0_4px_16px_rgba(19,24,22,0.2)] hover:opacity-85'
                    : 'border border-ink/15 bg-paper text-ink hover:bg-ink hover:text-paper'
                }`}
              >
                {tier.cta} →
              </a>
            </article>
          ))}
        </section>

        <section className="mt-8">
          <div className="rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,#fff7e7_0%,#f8ead0_100%)] p-8 shadow-[0_8px_24px_rgba(184,117,42,0.10)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">Coach comparison</p>
            <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">One flat price beats per-athlete billing.</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/68">
              TrainingPeaks charges $22-55/month PLUS $9/athlete/month. Threshold keeps coach pricing radically simpler:
              one flat price for up to 25 athletes, with no activation fees and no per-athlete surprises.
            </p>
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
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-ink/40">Research</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-accent">Individual</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-ink/40">Coach</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Research library (72 studies)', research: true, individual: true, coach: true },
                    { label: 'Intervention logging', research: false, individual: true, coach: true },
                    { label: 'Workout check-ins', research: false, individual: true, coach: true },
                    { label: 'Training response correlations', research: false, individual: true, coach: true },
                    { label: 'Race blueprint auto-builder', research: false, individual: true, coach: true },
                    { label: 'Post-race outcome debrief', research: false, individual: true, coach: true },
                    { label: 'Strava activity sync', research: false, individual: true, coach: true },
                    { label: 'Coach roster dashboard', research: false, individual: false, coach: true },
                    { label: 'Protocol assignments', research: false, individual: false, coach: true },
                    { label: 'Cohort comparison', research: false, individual: false, coach: true },
                    { label: 'Compliance tracking', research: false, individual: false, coach: true },
                    { label: 'Private coach notes', research: false, individual: false, coach: true },
                    { label: 'Up to 25 athletes', research: false, individual: false, coach: true },
                    { label: 'No per-athlete fees', research: false, individual: false, coach: true },
                  ].map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? 'bg-paper/40' : ''}>
                      <td className="py-3 pr-6 text-ink/70">{row.label}</td>
                      <td className="px-3 py-3 text-center">
                        {row.research ? <span className="text-emerald-600">✓</span> : <span className="text-ink/20">—</span>}
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
              Create a free account, connect your training sources, and upgrade when you are ready for full insight unlocks and premium workflows.
            </p>
            <a
              href={athleteId ? '/dashboard' : '/signup'}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition hover:opacity-90"
            >
              {athleteId ? 'Go to Dashboard →' : 'Create Free Account →'}
            </a>
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
