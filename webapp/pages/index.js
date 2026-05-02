import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';

const publicLinks = [
  { href: '/guide', label: 'How it works' },
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
    body: 'Log how your legs feel, energy level, and RPE after every session. Threshold compares each check-in against every intervention from the prior 48 hours — foam rolling, sleep, heat, ice baths — and surfaces the patterns automatically.',
    stat: '+1.8 pts',
    statLabel: 'avg legs feel after sauna days vs without',
    highlight: true,
  },
  {
    emoji: '🗺️',
    label: 'Race Architecture Builder',
    headline: 'Your race blueprint, auto-built from your data',
    body: 'Enter your target race and finish time. Threshold generates a real-time fueling and hydration blueprint, pre-race intervention timeline, and heat/bicarb/caffeine dosing — all calculated from your own logged baseline.',
    stat: '14 days',
    statLabel: 'of pre-race prep, automatically sequenced',
    highlight: false,
  },
  {
    emoji: '🔬',
    label: 'Research Library',
    headline: 'A practical research library for race-week decisions',
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
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch('/api/me', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (!response.ok) {
          if (!cancelled) setAthleteId(null);
          return;
        }

        const data = await response.json();
        if (!cancelled) setAthleteId(data.athlete?.id || null);
      } catch {
        if (!cancelled) setAthleteId(null);
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const loginHref = athleteId ? '/dashboard' : '/login';
  const loginLabel = athleteId ? 'Open Threshold' : 'Log In';
  const startHref = athleteId ? '/dashboard' : '/signup';

  return (
    <main className="min-h-screen bg-paper text-ink">

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 px-4 pt-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between rounded-full border border-ink/10 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <a href="/" className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">Threshold</a>
            <div className="hidden items-center gap-7 lg:flex">
              {publicLinks.map((link) => (
                <a key={link.href} href={link.href} className="text-sm font-semibold text-ink/65 transition hover:text-ink">
                  {link.label}
                </a>
              ))}
              <a href={loginHref} className="ui-button-primary py-2.5">
                {loginLabel}
              </a>
            </div>
            <NavMenu
              label="Homepage navigation"
              links={athleteId ? athleteLinks : publicLinks}
              primaryLink={{ href: loginHref, label: athleteId ? 'Open App' : 'Login' }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-24">

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section
          className="relative mt-6 overflow-hidden rounded-[28px] border border-ink/10 bg-white p-6 shadow-warm md:p-10 lg:p-14"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(16,185,129,0.16),transparent_30%),linear-gradient(135deg,rgba(196,136,42,0.08),rgba(16,185,129,0.05))]" />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <p className="ui-eyebrow" style={{ fontSize: 11 }}>Performance Intelligence · Endurance Athletes</p>
              <h1
                className="font-display mt-5 max-w-[760px] font-semibold text-ink"
                style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 1.03 }}
              >
                The protocols behind your race-day outcomes.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-[1.8] text-ink/70 md:text-lg">
                Threshold tracks heat blocks, gut training, sleep, bicarb, cold immersion, and other interventions so you can see what actually moved training quality and race performance.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={startHref}
                  className="rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-paper shadow-[0_4px_20px_rgba(19,24,22,0.18)] transition hover:opacity-85"
                >
                  Start free — log your first intervention →
                </a>
                <a
                  href="/guide"
                  className="rounded-full border border-ink/15 bg-white px-7 py-3.5 text-sm font-semibold text-ink transition hover:bg-surface-light"
                >
                  How it works
                </a>
              </div>
              <p className="mt-5 text-xs text-ink/45">Free to start · No credit card required · Email, Google, or Strava</p>
            </div>

            <div className="min-w-0">
            <div className="rounded-[22px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(28,26,23,0.20)]">
              <p className="ui-eyebrow" style={{ color: 'var(--color-accent-amber-light)' }}>Correlation · N=1</p>
              <p className="mt-2 text-[15px] font-semibold leading-snug">What moved your training quality</p>
              {[
                { em: '🔥', label: 'Sauna recovery', delta: '+2.1 pts', pct: 88 },
                { em: '🌀', label: 'Foam rolling', delta: '+1.4 pts', pct: 71 },
                { em: '🧊', label: 'Cold immersion', delta: '+1.1 pts', pct: 62 },
              ].map((item) => (
                <div key={item.label} style={{ marginTop: 14 }}>
                  <div className="flex items-center justify-between text-[13px] text-white/75">
                    <span>{item.em} {item.label}</span>
                    <span className="ui-stat-chip">{item.delta}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 9999, background: 'rgba(255,255,255,0.10)', marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${item.pct}%`, background: 'var(--color-positive)' }} />
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        </section>

        {/* ── Protocol strip ─────────────────────────────────────────── */}
        <section className="mt-12">
          <p className="ui-eyebrow text-center">Everything that determines race-day</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            {protocols.map((p) => (
              <span key={p.label} className="ui-protocol-chip">
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
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">With Threshold</p>
            <h3 className="mt-4 text-2xl font-semibold leading-snug text-ink">Your N=1 correlation engine. Personal data that coaches you.</h3>
            <p className="mt-4 text-sm leading-7 text-ink/60">
              Log your interventions and check-in after every training session. Threshold compares the two — automatically finding patterns like "your legs score 2.1 points higher on training days that follow a sauna session."
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
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/40">What Threshold does</p>
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


        <section className="mt-16 rounded-[32px] border border-ink/10 bg-white p-8 md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">For coaches</p>
          <h2 className="mt-3 text-3xl font-semibold text-ink">Built to support your coaching workflow, not replace your planning stack overnight.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/65">Threshold is an intervention intelligence layer alongside your existing workflow. Use it to track protocol compliance, race-readiness risk, and how athletes respond after each intervention block.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              'Assign protocol templates to athletes or groups in minutes.',
              'Triage athletes who need attention first using readiness status and confidence.',
              'See intervention-response patterns without digging through message threads.',
              'Use flat coach pricing instead of per-athlete billing surprises.'
            ].map((item) => <div key={item} className="rounded-2xl border border-ink/10 bg-paper p-4 text-sm text-ink/75">{item}</div>)}
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────── */}
        <section className="mt-16">
          <p className="ui-eyebrow">The system</p>
          <h2 className="font-display mt-3 text-3xl font-semibold text-ink md:text-4xl" style={{ letterSpacing: '-0.01em' }}>
            Three steps to your first insight.
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Log interventions',
                body: 'Every sauna session, bicarb dose, gut training run. 30 seconds each.',
              },
              {
                step: '02',
                title: 'Check in after training',
                body: 'Two sliders — legs feel, energy. That\'s the signal.',
              },
              {
                step: '03',
                title: 'Watch correlations emerge',
                body: 'After ~14 entries, patterns surface. "+2.1 pts legs feel" isn\'t guesswork.',
              },
            ].map((item) => (
              <div key={item.step} className="ui-card">
                <p className="font-mono text-[32px] font-semibold" style={{ color: 'var(--color-accent-amber)', lineHeight: 1 }}>{item.step}</p>
                <p className="mt-4 text-lg font-semibold text-ink">{item.title}</p>
                <p className="mt-2 text-sm leading-[1.65] text-ink/60">{item.body}</p>
              </div>
            ))}
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
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/40">Threshold vs. TrainingPeaks</p>
            <h2 className="font-display mt-4 text-2xl font-semibold text-ink md:text-3xl">
              Built for athletes who want to know <em>why</em> — not just <em>how far</em>.
            </h2>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-ink/8">
                    <th className="py-3 pr-6 text-left text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">Feature</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-accent">Threshold</th>
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
          <div
            className="overflow-hidden rounded-[40px] px-8 py-16 text-center md:px-16 md:py-20"
            style={{ background: 'linear-gradient(135deg, #1c1a17 0%, #302b25 42%, #7d684d 100%)', color: 'var(--color-text-on-dark)' }}
          >
            <p className="ui-eyebrow" style={{ color: 'var(--color-accent-amber-light)' }}>TrainingPeaks logs your workouts.</p>
            <h2
              className="font-display mx-auto mt-4 max-w-2xl font-semibold leading-snug"
              style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--color-text-on-dark)' }}
            >
              Threshold tells you what&apos;s actually working.
            </h2>
            <a
              href={loginHref}
              className="mt-8 inline-flex rounded-full px-8 py-4 text-base font-semibold text-white transition hover:opacity-90"
              style={{ background: 'var(--color-accent-amber)', boxShadow: '0 6px 20px rgba(196,136,42,0.30)' }}
            >
              Your next PR is already in your data →
            </a>
            <p className="mt-5 text-xs" style={{ color: 'var(--color-text-muted-on-dark)' }}>Free to start · No credit card</p>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-ink/8 pt-8 text-xs text-ink/35">
          <p className="font-semibold uppercase tracking-[0.3em] text-accent">Threshold</p>
          <div className="flex gap-6">
            <a href="/guide" className="hover:text-ink/60">How It Works</a>
            <a href="/pricing" className="hover:text-ink/60">Pricing</a>
            <a href="/content" className="hover:text-ink/60">Research</a>
            <a href="/login" className="hover:text-ink/60">Login</a>
          </div>
          <p>© {new Date().getFullYear()} Threshold</p>
        </footer>

      </div>
    </main>
  );
}
