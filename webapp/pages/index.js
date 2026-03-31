import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';

const publicLinks = [
  { href: '/guide', label: 'How It Works' },
  { href: '/content', label: 'Research' },
  { href: '/pricing', label: 'Pricing' },
];

const athleteLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/log-intervention', label: 'Log' },
  { href: '/history', label: 'History' },
  { href: '/content', label: 'Research' },
];

const features = [
  {
    emoji: '📋',
    label: 'Workout Check-ins',
    headline: 'See what actually moves training quality',
    body: 'Log how your legs feel, energy level, and RPE after every session. UltraOS compares each check-in against every intervention from the prior 48 hours — foam rolling, sleep, heat, ice baths — and surfaces the patterns automatically.',
    stat: '+1.8 pts',
    statLabel: 'avg legs feel after sauna days vs without',
    highlight: true,
  },
  {
    emoji: '🗺️',
    label: 'Race Architecture Builder',
    headline: 'Your race blueprint, auto-built from your data',
    body: 'Enter your target race and finish time. UltraOS generates a real-time fueling and hydration blueprint, pre-race intervention timeline, and heat/bicarb/caffeine dosing — all calculated from your own logged baseline.',
    stat: '14 days',
    statLabel: 'of pre-race prep, automatically sequenced',
    highlight: false,
  },
  {
    emoji: '🔬',
    label: 'Research Library',
    headline: '72 peer-reviewed studies, curated for endurance athletes',
    body: 'Every topic filter returns depth — heat acclimation, lactate threshold, gut training, HRV, taper, injury prevention, and more. Save studies, bookmark for race week, and connect the evidence directly to your logged protocols.',
    stat: '19',
    statLabel: 'topic categories, all populated',
    highlight: false,
  },
];

const protocols = [
  { emoji: '🔥', label: 'Heat Acclimation' },
  { emoji: '🧪', label: 'Gut Training' },
  { emoji: '💊', label: 'Sodium Bicarbonate' },
  { emoji: '🧊', label: 'Cold Immersion' },
  { emoji: '🌀', label: 'Foam Rolling / Soft Tissue' },
  { emoji: '🏔️', label: 'Altitude Exposure' },
  { emoji: '😴', label: 'Sleep Extension' },
  { emoji: '🌬️', label: 'Respiratory Training' },
  { emoji: '🍝', label: 'Carbohydrate Loading' },
  { emoji: '⚡', label: 'Caffeine Protocol' },
  { emoji: '🏋️', label: 'Strength & BFR' },
  { emoji: '❤️', label: 'HRV Monitoring' },
];

const comparisons = [
  { feature: 'Workout log + Strava sync', ultraos: true, tp: true },
  { feature: 'Protocol intervention logging', ultraos: true, tp: false },
  { feature: 'Training response correlations', ultraos: true, tp: false },
  { feature: 'N=1 pattern detection (foam roll → legs feel)', ultraos: true, tp: false },
  { feature: 'Race blueprint auto-builder', ultraos: true, tp: false },
  { feature: 'Gut / heat / bicarb dose tracking', ultraos: true, tp: false },
  { feature: 'Peer-reviewed research library', ultraos: true, tp: false },
  { feature: 'Post-race outcome debrief', ultraos: true, tp: true },
  { feature: 'Coach protocol assignments', ultraos: true, tp: true },
];

function CheckIcon({ filled }) {
  if (!filled) {
    return <span className="text-ink/20">—</span>;
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>
  );
}

export default function Home() {
  const [athleteId, setAthleteId] = useState(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/athlete_id=([^;]+)/);
      if (match) setAthleteId(match[1]);
    }
  }, []);

  const loginHref = athleteId ? '/dashboard' : '/signup';
  const loginLabel = athleteId ? 'Open UltraOS' : 'Get Started Free';

  return (
    <main className="min-h-screen bg-paper text-ink">

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 px-4 pt-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between rounded-full border border-ink/10 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <a href="/" className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">UltraOS</a>
            <NavMenu
              label="Homepage navigation"
              links={athleteId ? athleteLinks : publicLinks}
              primaryLink={{ href: athleteId ? '/dashboard' : '/login', label: athleteId ? 'Open App' : 'Log In' }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-24">

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="mt-6 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] px-6 py-14 md:px-14 md:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">
                Performance Intelligence · Endurance Athletes
              </p>
              <h1 className="font-display mt-5 text-5xl font-semibold leading-[1.08] tracking-[-0.01em] text-ink md:text-6xl xl:text-7xl">
                The protocols behind your race-day outcomes.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-[1.8] text-ink/70 md:text-lg">
                UltraOS tracks the interventions — heat blocks, gut training, sleep, bicarb, cold immersion — and shows you which ones actually moved your training quality and race performance.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href={loginHref}
                  className="rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-paper shadow-[0_4px_20px_rgba(19,24,22,0.25)] transition hover:opacity-85"
                >
                  {loginLabel} →
                </a>
                <a
                  href="/guide"
                  className="rounded-full border border-ink/20 bg-white/60 px-7 py-3.5 text-sm font-semibold text-ink transition hover:bg-white/80"
                >
                  How It Works
                </a>
              </div>
              <p className="mt-6 text-xs text-ink/40">Free to start · No credit card required · Email, Google, or Strava</p>
            </div>

            {/* Hero widget — simulated training response card */}
            <div className="space-y-3">
              <div className="rounded-[28px] bg-panel p-6 text-white shadow-[0_24px_60px_rgba(19,24,22,0.32)]">
                <p className="text-[10px] uppercase tracking-[0.28em] text-accent">Training Response · Last 30 days</p>
                <p className="mt-2 text-lg font-semibold">What moves your training quality?</p>
                <div className="mt-4 space-y-3">
                  {[
                    { label: 'Sauna Recovery', delta: '+2.1 pts', metric: 'legs feel', positive: true, pct: 88 },
                    { label: 'Foam Rolling', delta: '+1.4 pts', metric: 'energy level', positive: true, pct: 71 },
                    { label: 'Cold Immersion', delta: '+1.1 pts', metric: 'legs feel', positive: true, pct: 62 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/70">{item.label}</span>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                          {item.delta} {item.metric}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full bg-emerald-400"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[22px] border border-ink/10 bg-white/70 p-4 shadow-sm backdrop-blur">
                  <p className="font-mono text-2xl font-semibold text-accent">8.4</p>
                  <p className="mt-1 text-xs text-ink/55">Avg legs feel after sauna days</p>
                </div>
                <div className="rounded-[22px] border border-ink/10 bg-white/70 p-4 shadow-sm backdrop-blur">
                  <p className="font-mono text-2xl font-semibold text-ink">6.3</p>
                  <p className="mt-1 text-xs text-ink/55">Avg legs feel without</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Protocol strip ─────────────────────────────────────────── */}
        <section className="mt-10">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-ink/40">
            Track every intervention that shapes your performance
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            {protocols.map((p) => (
              <span
                key={p.label}
                className="flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm"
              >
                <span>{p.emoji}</span>
                {p.label}
              </span>
            ))}
          </div>
        </section>

        {/* ── Core problem ───────────────────────────────────────────── */}
        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[32px] border border-ink/10 bg-white p-8 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/35">The Old Way</p>
            <h3 className="mt-4 text-2xl font-semibold leading-snug text-ink">You track workouts. But workouts are the output, not the input.</h3>
            <p className="mt-4 text-sm leading-7 text-ink/60">
              Strava knows your pace. TrainingPeaks knows your TSS. But neither knows you ran 3 gut training sessions, did a 10-day heat block, or cut sleep by 90 minutes in the week before your last DNF.
            </p>
            <div className="mt-6 space-y-2">
              {['Why did my legs feel dead on mile 18?', 'Which recovery tool actually works for me?', 'Was the heat block worth it?'].map((q) => (
                <div key={q} className="flex items-start gap-3 text-sm text-ink/50">
                  <span className="mt-0.5 text-base">❓</span>
                  <span>{q}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[32px] border border-accent/20 bg-[linear-gradient(135deg,#fffbf0_0%,#fdf3d7_100%)] p-8 shadow-[0_8px_24px_rgba(19,24,22,0.06)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">With UltraOS</p>
            <h3 className="mt-4 text-2xl font-semibold leading-snug text-ink">Your N=1 correlation engine. Personal data that coaches you.</h3>
            <p className="mt-4 text-sm leading-7 text-ink/60">
              Log your interventions and check-in after every training session. UltraOS compares the two — automatically finding patterns like "your legs score 2.1 points higher on training days that follow a sauna session."
            </p>
            <div className="mt-6 space-y-2">
              {['Sauna → +2.1 pts legs feel', 'Foam rolling → +1.4 pts energy', 'Cold immersion → +1.1 pts legs feel'].map((q) => (
                <div key={q} className="flex items-start gap-3 text-sm font-semibold text-ink/75">
                  <span className="mt-0.5 text-base text-emerald-500">✓</span>
                  <span>{q}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Feature sections ──────────────────────────────────────── */}
        <section className="mt-16 space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/40">What UltraOS does</p>
          {features.map((f) => (
            <div
              key={f.label}
              className={`overflow-hidden rounded-[32px] border p-8 md:p-10 ${
                f.highlight
                  ? 'border-accent/20 bg-[linear-gradient(135deg,#fffbf0_0%,#fdf3d7_100%)] shadow-[0_8px_32px_rgba(245,158,11,0.12)]'
                  : 'border-ink/10 bg-white shadow-[0_8px_24px_rgba(19,24,22,0.05)]'
              }`}
            >
              <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{f.emoji}</span>
                    <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${f.highlight ? 'text-accent' : 'text-ink/40'}`}>
                      {f.label}
                    </p>
                    {f.highlight ? (
                      <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                        New
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold leading-snug text-ink md:text-3xl">{f.headline}</h3>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/60">{f.body}</p>
                </div>
                <div className="shrink-0 rounded-[22px] border border-ink/8 bg-paper px-6 py-5 text-center md:min-w-[160px]">
                  <p className="font-mono text-4xl font-semibold text-accent">{f.stat}</p>
                  <p className="mt-2 text-xs leading-5 text-ink/50">{f.statLabel}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ── How it works ──────────────────────────────────────────── */}
        <section className="mt-16">
          <div className="rounded-[32px] bg-panel px-8 py-12 text-white md:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">How It Works</p>
            <h2 className="font-display mt-4 text-3xl font-semibold md:text-4xl">Three steps to finding your patterns</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  step: '01',
                  title: 'Log your protocols',
                  body: 'After a heat session, a foam rolling block, an ice bath, or a bad sleep night — log it. Takes 60 seconds with structured fields designed around the protocol.',
                },
                {
                  step: '02',
                  title: 'Check in after training',
                  body: 'After each workout, log a Workout Check-in: how your legs felt, energy level, and RPE. This is your training quality signal.',
                },
                {
                  step: '03',
                  title: 'Patterns surface automatically',
                  body: 'UltraOS compares every check-in against the interventions logged in the prior 48 hours. No manual analysis. The correlation engine does the work.',
                },
              ].map((item) => (
                <div key={item.step} className="rounded-[24px] border border-white/10 bg-white/5 p-6">
                  <p className="font-mono text-3xl font-semibold text-accent">{item.step}</p>
                  <p className="mt-4 text-base font-semibold">{item.title}</p>
                  <p className="mt-3 text-sm leading-7 text-white/55">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Research library ─────────────────────────────────────── */}
        <section className="mt-10">
          <div className="rounded-[32px] border border-ink/10 bg-white p-8 shadow-[0_8px_24px_rgba(19,24,22,0.05)] md:p-10">
            <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/40">Research Library</p>
                <h2 className="font-display mt-4 text-3xl font-semibold leading-snug text-ink">
                  The science behind your protocols — actually readable.
                </h2>
                <p className="mt-4 text-sm leading-7 text-ink/60">
                  72 peer-reviewed papers across 19 topics, written in plain English with practical takeaways for endurance athletes. Every topic filter returns real depth — heat acclimation, lactate threshold, tapering, injury prevention, HRV, and more.
                </p>
                <a
                  href="/content"
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper px-5 py-3 text-sm font-semibold text-ink transition hover:bg-ink hover:text-paper"
                >
                  Browse the research →
                </a>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['Heat Acclimation', 'Gut Training', 'HRV', 'Lactate Threshold', 'Running Economy', 'Taper', 'VO2max', 'Hydration', 'Injury Prevention', 'Sleep', 'Sodium Bicarbonate', 'Strength Training'].map((topic) => (
                  <a
                    key={topic}
                    href="/content"
                    className="rounded-[14px] border border-ink/8 bg-paper px-3 py-2.5 text-center text-xs font-medium text-ink/70 transition hover:border-ink/20 hover:bg-white"
                  >
                    {topic}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Comparison ───────────────────────────────────────────── */}
        <section className="mt-10">
          <div className="rounded-[32px] border border-ink/10 bg-white p-8 shadow-[0_8px_24px_rgba(19,24,22,0.05)] md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/40">UltraOS vs. TrainingPeaks</p>
            <h2 className="font-display mt-4 text-2xl font-semibold text-ink md:text-3xl">
              Built for athletes who want to know <em>why</em> — not just <em>how far</em>.
            </h2>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-ink/8">
                    <th className="py-3 pr-6 text-left text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">Feature</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-accent">UltraOS</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">TrainingPeaks</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 0 ? 'bg-paper/50' : ''}>
                      <td className="py-3 pr-6 text-sm text-ink/70">{row.feature}</td>
                      <td className="px-4 py-3 text-center"><CheckIcon filled={row.ultraos} /></td>
                      <td className="px-4 py-3 text-center"><CheckIcon filled={row.tp} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────── */}
        <section className="mt-10">
          <div className="overflow-hidden rounded-[40px] bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] px-8 py-16 text-center md:px-16 md:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">Start for free</p>
            <h2 className="font-display mx-auto mt-5 max-w-2xl text-4xl font-semibold leading-snug text-ink md:text-5xl">
              Your next PR is already in your data.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-ink/65">
              Connect Strava, log your first heat session or foam rolling block, check in after your next workout, and let UltraOS find the pattern. Free to start.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <a
                href={loginHref}
                className="rounded-full bg-ink px-8 py-4 text-base font-semibold text-paper shadow-[0_4px_20px_rgba(19,24,22,0.25)] transition hover:opacity-85"
              >
                {loginLabel} →
              </a>
              <a
                href="/guide"
                className="rounded-full border border-ink/20 bg-white/60 px-8 py-4 text-base font-semibold text-ink transition hover:bg-white/80"
              >
                See how it works
              </a>
            </div>
            <p className="mt-6 text-xs text-ink/40">No credit card required · Email, Google, or Strava · 60 seconds to set up</p>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-ink/8 pt-8 text-xs text-ink/35">
          <p className="font-semibold uppercase tracking-[0.3em] text-accent">UltraOS</p>
          <div className="flex gap-6">
            <a href="/guide" className="hover:text-ink/60">How It Works</a>
            <a href="/pricing" className="hover:text-ink/60">Pricing</a>
            <a href="/content" className="hover:text-ink/60">Research</a>
            <a href="/login" className="hover:text-ink/60">Login</a>
          </div>
          <p>© {new Date().getFullYear()} UltraOS</p>
        </footer>

      </div>
    </main>
  );
}
