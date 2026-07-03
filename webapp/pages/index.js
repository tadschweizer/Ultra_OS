import { useEffect, useState } from 'react';
import Head from 'next/head';
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

/* ── Minimal stroke icons (no emoji) ─────────────────────────────── */
const ICON_PATHS = {
  roster: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  clipboard: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
  pulse: 'M22 12h-4l-3 9L9 3l-3 9H2',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  trend: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  battery: 'M17 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zM23 13v-2M6 10v4M10 10v4',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
};

function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/* ── Sparkline (marketing illustration, 2px line + end dot) ──────── */
function Sparkline({ points, stroke, width = 92, height = 26 }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const step = width / (points.length - 1);
  const y = (v) => height - 3 - (((v - min) / (max - min)) * (height - 6));
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(p).toFixed(1)}`)
    .join(' ');
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" className="shrink-0">
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={y(last)} r="2.5" fill={stroke} />
    </svg>
  );
}

/* ── Content ─────────────────────────────────────────────────────── */

const painPoints = [
  {
    title: 'Review happens athlete by athlete',
    body: 'Open a file, scan the charts, reconstruct the story, move to the next one. With ten athletes that ritual eats a morning. With thirty, something gets skimmed — and the athlete who needed attention is usually the one you skimmed.',
  },
  {
    title: 'The charts don’t say what changed',
    body: 'Pace, power, HR, load — the numbers are all there, but the interpretation is all on you. Spotting that an athlete’s response quietly shifted two weeks ago means holding thirty baselines in your head.',
  },
  {
    title: 'Subjective and objective live in different places',
    body: 'The training log says the workout was completed. The athlete’s text says their legs are dead. Connecting how athletes feel to what the data shows still happens manually — in your memory, across two apps.',
  },
  {
    title: 'Early signals get found late',
    body: 'A fading athlete looks fine right up until the workout quality drops. By the time a problem is obvious on a chart, it’s already expensive. The signal was there earlier — someone just had to be looking.',
  },
];

const comparisons = [
  { log: 'What was planned and what was completed', threshold: 'What actually changed, and for whom' },
  { log: 'Athlete-by-athlete file review', threshold: 'Roster-level priorities every morning' },
  { log: 'Raw charts you interpret yourself', threshold: 'Highlighted changes with the context attached' },
  { log: 'Workout data on one side, athlete texts on the other', threshold: 'Check-ins and training data read together' },
  { log: 'Data display', threshold: 'Decision support' },
  { log: 'A review routine you build and maintain', threshold: 'A prioritized coach workflow, built in' },
];

const dashboardModules = [
  {
    icon: 'eye',
    title: 'Roster health at a glance',
    body: 'Who’s progressing, who’s off-protocol, who’s missing data, who races soon — before you open a single athlete file.',
  },
  {
    icon: 'alert',
    title: 'A needs-review queue with reasons',
    body: 'Athletes surface with the why attached: a check-in trend change, missed protocol days, a gap in the data. Not just a name — a starting point.',
  },
  {
    icon: 'pulse',
    title: 'Check-ins read against the training',
    body: 'Athletes report legs feel, energy, and RPE in about 30 seconds. Threshold compares every check-in against the interventions of the prior 48 hours and surfaces what’s actually moving training quality — per athlete.',
  },
  {
    icon: 'clipboard',
    title: 'Compliance without chasing',
    body: 'Assign structured protocols — heat, gut, sleep, fueling — to an athlete or a whole group, then watch execution patterns instead of sending “did you do it?” texts.',
  },
  {
    icon: 'flag',
    title: 'Race prep risk across the roster',
    body: 'Race blueprints sequence fueling, hydration, and pre-race protocols from each athlete’s own logged baseline — and show you where prep is on track or slipping.',
  },
  {
    icon: 'message',
    title: 'Notes and messaging next to the data',
    body: 'Coach notes, shared resources, and athlete messages live beside the numbers they’re about, so the conversation and the evidence stay in one place.',
  },
];

const pillars = [
  {
    icon: 'trend',
    title: 'Load and response',
    body: 'Not just how much work was done — how each athlete is absorbing it, and when the relationship between the two shifts.',
  },
  {
    icon: 'battery',
    title: 'Fatigue and readiness signals',
    body: 'Check-in trends read against training load, flagged as trend changes and review suggestions — early enough to matter, never dressed up as certainty.',
  },
  {
    icon: 'calendar',
    title: 'Consistency and compliance',
    body: 'Missed-session patterns and protocol execution across the roster, so inconsistency shows up as a pattern instead of an anecdote.',
  },
  {
    icon: 'pulse',
    title: 'Subjective feedback trends',
    body: 'Legs feel, energy, and RPE tracked over time and correlated with what the athlete actually did — the half of the picture most platforms leave in your text messages.',
  },
  {
    icon: 'flag',
    title: 'Race readiness',
    body: 'Prep protocols, fueling rehearsals, and taper context tied to a date on the calendar — with roster-level visibility into who’s on track.',
  },
  {
    icon: 'alert',
    title: 'Risk signals',
    body: 'Rising-fatigue patterns, under-recovery reports, and plateau risk surfaced as signals for your judgment — “review suggested,” not a verdict.',
  },
  {
    icon: 'layers',
    title: 'Performance progression',
    body: 'Whether each athlete is improving, flat, or declining against their own history — not against a population average that doesn’t coach them.',
  },
  {
    icon: 'message',
    title: 'Coach-athlete communication',
    body: 'Turn what the data shows into language athletes understand, so the why behind an adjustment lands as clearly as the adjustment itself.',
  },
];

const fasterAnswers = [
  'Which athletes need a check-in today',
  'Who is absorbing training well',
  'Who is trending toward overload',
  'Who is missing key sessions — and whether it’s a pattern',
  'Who is improving despite lower volume',
  'Who is hitting workouts but reporting poor recovery',
  'Who needs a plan adjustment before race week',
  'Where performance is improving, flat, or declining',
];

const workflow = [
  {
    step: '01',
    title: 'Open Threshold',
    body: 'One morning view of the whole roster — not thirty tabs.',
  },
  {
    step: '02',
    title: 'See the priorities',
    body: 'The review queue is already ordered: who needs attention, who races soon, who went quiet.',
  },
  {
    step: '03',
    title: 'Review with the reason attached',
    body: 'Every flag carries its why — the trend change, the missed protocol days, the check-in pattern — so review starts at the signal, not at a blank chart.',
  },
  {
    step: '04',
    title: 'Adjust and communicate',
    body: 'Change the plan, assign a protocol, or send feedback the athlete’s own data backs up.',
  },
  {
    step: '05',
    title: 'Watch the response',
    body: 'The next check-ins show whether the adjustment landed — closing the loop most coaching stacks leave open.',
  },
];

/* ── Hero dashboard panel (stylized product illustration) ────────── */
function CommandCenterPanel() {
  const tiles = [
    { label: 'Athletes', value: '12' },
    { label: 'Need review', value: '3', accent: true },
    { label: 'Race ≤ 21d', value: '2' },
    { label: 'Check-ins wk', value: '87%' },
  ];
  const queue = [
    {
      initials: 'SH',
      name: 'S. Hartley',
      chip: 'Review suggested',
      chipTone: 'warn',
      detail: 'Legs feel down 4 check-ins in a row while load held steady',
      spark: [72, 70, 66, 58, 52, 44],
      sparkStroke: '#f87171',
    },
    {
      initials: 'MO',
      name: 'M. Okafor',
      chip: 'Races in 12 days',
      chipTone: 'amber',
      detail: 'Race prep on track · fueling rehearsal logged Tuesday',
      spark: [40, 46, 44, 55, 62, 68],
      sparkStroke: '#e0a13a',
    },
    {
      initials: 'JR',
      name: 'J. Ruiz',
      chip: 'Adapting well',
      chipTone: 'positive',
      detail: 'Energy trending up at reduced volume · 5 check-ins this week',
      spark: [38, 45, 52, 50, 61, 74],
      sparkStroke: '#34d399',
    },
  ];
  const chipStyles = {
    amber: 'bg-amber/20 text-amber-light',
    warn: 'bg-red-400/15 text-red-300',
    positive: 'bg-emerald-400/15 text-emerald-300',
  };
  return (
    <div className="rounded-[22px] bg-panel p-6 text-white shadow-panel" aria-label="Illustration of the Threshold coach dashboard: roster tiles, review queue with trend lines, and race countdown">
      <div className="flex items-center justify-between">
        <p className="ui-eyebrow" style={{ color: 'var(--color-accent-amber-light)' }}>Coach Command Center</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">Tue · 6:42 AM</span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2.5 text-center">
            <p className={`font-mono text-lg font-semibold leading-none ${t.accent ? 'text-amber-light' : 'text-white/90'}`}>{t.value}</p>
            <p className="mt-1.5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-white/40">{t.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[13px] font-semibold text-white/85">Review queue — highest signal first</p>
      <div className="mt-3 space-y-4">
        {queue.map((row) => (
          <div key={row.name}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] font-semibold text-white/80">{row.initials}</span>
                <span className="truncate text-[13px] font-semibold text-white/90">{row.name}</span>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold ${chipStyles[row.chipTone]}`}>{row.chip}</span>
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-3 pl-[38px]">
              <p className="min-w-0 text-xs leading-5 text-white/50">{row.detail}</p>
              <Sparkline points={row.spark} stroke={row.sparkStroke} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/45">
        <span>Next race: M. Okafor · 12 days</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em]">9 athletes steady</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [athleteId, setAthleteId] = useState(null);

  useEffect(() => {
    // Supabase implicit-flow fallback: when the Site URL is the root, Supabase
    // appends OAuth tokens as a hash fragment here instead of /auth/callback.
    // Detect and forward so the callback page can complete the sign-in.
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
      window.location.replace('/auth/callback' + window.location.hash);
      return;
    }

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
  const coachHref = athleteId ? '/coach-command-center' : '/signup?role=coach';

  return (
    <main className="min-h-screen bg-paper text-ink">
      <Head>
        <title>Threshold — Coaching intelligence for endurance coaches</title>
        <meta
          key="description"
          name="description"
          content="Threshold is the coaching analytics platform above your training log: roster-level athlete monitoring, check-in and training-load trends, protocol compliance, and race-prep oversight — so endurance coaches see what changed, who needs attention, and why."
        />
        <meta key="og-title" property="og:title" content="Threshold — Coaching intelligence for endurance coaches" />
        <meta
          key="og-description"
          property="og:description"
          content="Turn athlete data into coaching decisions. Roster-level analytics, signal detection, and a prioritized coach workflow for endurance coaches."
        />
      </Head>

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
        <section className="relative mt-6 overflow-hidden rounded-[28px] border border-ink/10 bg-white p-6 shadow-warm md:p-10 lg:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(16,185,129,0.14),transparent_30%),linear-gradient(135deg,rgba(201,131,29,0.08),rgba(23,50,71,0.04))]" />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0">
              <p className="ui-eyebrow" style={{ fontSize: 11 }}>Coaching intelligence for endurance coaches</p>
              <h1
                className="font-display mt-5 max-w-[780px] font-semibold text-ink"
                style={{ fontSize: 'clamp(38px, 5.6vw, 68px)', lineHeight: 1.05 }}
              >
                Turn athlete data into coaching decisions.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-[1.8] text-ink/70 md:text-lg">
                Your athletes generate more data than you have time to review. Threshold reads across
                your whole roster and surfaces what changed, who needs attention, and why it matters —
                so your hours go to coaching, not to clicking through charts athlete by athlete.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={coachHref}
                  className="rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-paper shadow-[0_4px_20px_rgba(19,24,22,0.18)] transition hover:opacity-85"
                >
                  Get early access — free
                </a>
                <a
                  href="/guide"
                  className="rounded-full border border-ink/15 bg-white px-7 py-3.5 text-sm font-semibold text-ink transition hover:bg-surface-light"
                >
                  See the platform
                </a>
              </div>
              <p className="mt-5 text-xs text-ink/45">Free to start · No credit card · Flat pricing at any roster size</p>
            </div>

            <div className="min-w-0">
              <CommandCenterPanel />
            </div>
          </div>
        </section>

        {/* ── Problem ───────────────────────────────────────────────── */}
        <section className="mt-20">
          <p className="ui-eyebrow">The problem</p>
          <h2 className="font-display mt-3 max-w-3xl text-3xl font-semibold text-ink md:text-4xl" style={{ letterSpacing: '-0.01em' }}>
            Training data is everywhere. Coaching insight is not.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/60 md:text-base">
            Serious coaches don’t lack data — between the training log, the wearables, the spreadsheets,
            and the athlete texts, there’s too much of it. What’s missing is prioritization: knowing what
            changed, and which of it deserves your attention first.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {painPoints.map((p) => (
              <div key={p.title} className="rounded-[24px] border border-ink/10 bg-white p-7 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
                <h3 className="text-lg font-semibold leading-snug text-ink">{p.title}</h3>
                <p className="mt-3 text-sm leading-7 text-ink/60">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Beyond training platforms ─────────────────────────────── */}
        <section className="mt-20">
          <div className="rounded-[32px] border border-accent/20 bg-[linear-gradient(135deg,#fffbf0_0%,#fdf3d7_100%)] p-8 shadow-[0_8px_32px_rgba(201,131,29,0.10)] md:p-12">
            <p className="ui-eyebrow">Beyond the training log</p>
            <h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold text-ink md:text-4xl" style={{ letterSpacing: '-0.01em' }}>
              Your training log is doing its job. Threshold is the layer above it.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/65 md:text-base">
              Platforms like TrainingPeaks are strong at planning and logging training — keep using them.
              Threshold sits on top of that work and does the part they leave to you: interpreting the
              data, prioritizing the roster, and turning what changed into what to do next.
            </p>
            <div className="mt-8 overflow-hidden rounded-[20px] border border-accent/15 bg-white/60">
              <div className="hidden grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] gap-4 border-b border-accent/15 bg-white/50 px-6 py-3 md:grid">
                <p className="text-right font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">The training log answers</p>
                <span aria-hidden="true" />
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Threshold answers</p>
              </div>
              <div className="divide-y divide-accent/10 px-6">
                {comparisons.map((c) => (
                  <div key={c.threshold} className="grid gap-1.5 py-4 md:grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] md:items-center md:gap-4">
                    <p className="text-sm text-ink/45 md:text-right">{c.log}</p>
                    <span className="hidden text-center font-mono text-accent md:block" aria-hidden="true">→</span>
                    <p className="text-sm font-semibold text-ink">{c.threshold}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href={coachHref} className="ui-button-primary">Get early access</a>
              <p className="text-xs text-ink/50">Works alongside your planning stack — nothing to migrate.</p>
            </div>
          </div>
        </section>

        {/* ── Coach dashboard ───────────────────────────────────────── */}
        <section className="mt-20">
          <div className="rounded-[32px] bg-panel p-8 text-white md:p-12">
            <p className="ui-eyebrow" style={{ color: 'var(--color-accent-amber-light)' }}>The coach dashboard</p>
            <h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold leading-snug md:text-4xl" style={{ letterSpacing: '-0.01em' }}>
              One morning view of the whole roster.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
              The Coach Command Center opens on the questions that actually drive a coaching day —
              who needs attention, who races soon, who is off-protocol, who went quiet — with the
              reason for every flag attached. Triage first, then coach.
            </p>
            <div className="mt-10 grid gap-x-8 gap-y-7 md:grid-cols-2 lg:grid-cols-3">
              {dashboardModules.map((m) => (
                <div key={m.title}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-amber-light">
                      <Icon name={m.icon} className="h-[18px] w-[18px]" />
                    </span>
                    <h3 className="text-[15px] font-semibold leading-snug text-white/90">{m.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/55">{m.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-10 border-t border-white/10 pt-6 text-xs leading-6 text-white/40">
              Signals are decision support, not verdicts. Threshold flags trend changes and suggests
              review — the read on the athlete, and the call, stay yours.
            </p>
          </div>
        </section>

        {/* ── Analytics pillars ─────────────────────────────────────── */}
        <section className="mt-20">
          <p className="ui-eyebrow">The analytics</p>
          <h2 className="font-display mt-3 max-w-3xl text-3xl font-semibold text-ink md:text-4xl" style={{ letterSpacing: '-0.01em' }}>
            Eight ways of seeing an athlete, one platform.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/60 md:text-base">
            Threshold’s analytics are being built pillar by pillar with working coaches. Check-in trends,
            intervention correlations, protocol compliance, and race-prep oversight are live today; deeper
            load-response and durability analytics are the roadmap — built in the open, not promised as magic.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p) => (
              <div key={p.title} className="rounded-[20px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon name={p.icon} className="h-[18px] w-[18px]" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold leading-snug text-ink">{p.title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-ink/60">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── What coaches can see faster ───────────────────────────── */}
        <section className="mt-20">
          <div className="rounded-[32px] border border-ink/10 bg-white p-8 shadow-[0_8px_24px_rgba(19,24,22,0.05)] md:p-12">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
              <div>
                <p className="ui-eyebrow">The payoff</p>
                <h2 className="font-display mt-3 text-3xl font-semibold text-ink md:text-4xl" style={{ letterSpacing: '-0.01em' }}>
                  Answers in minutes that used to take a morning.
                </h2>
                <p className="mt-4 text-sm leading-7 text-ink/60">
                  Roster review stops being an excavation. These are the questions Threshold is built
                  to answer before your coffee is done:
                </p>
                <a href={coachHref} className="ui-button-primary mt-7">Review your roster faster</a>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {fasterAnswers.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-ink/8 bg-surface-light px-4 py-3.5 text-sm leading-6 text-ink/75">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Workflow ──────────────────────────────────────────────── */}
        <section className="mt-20">
          <p className="ui-eyebrow">A coach’s day with Threshold</p>
          <h2 className="font-display mt-3 max-w-3xl text-3xl font-semibold text-ink md:text-4xl" style={{ letterSpacing: '-0.01em' }}>
            From open tab to informed decision in five steps.
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3 lg:grid-cols-5">
            {workflow.map((item) => (
              <div key={item.step} className="ui-card">
                <p className="font-mono text-[28px] font-semibold" style={{ color: 'var(--color-accent-amber)', lineHeight: 1 }}>{item.step}</p>
                <p className="mt-4 text-base font-semibold leading-snug text-ink">{item.title}</p>
                <p className="mt-2 text-[13px] leading-6 text-ink/60">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Trust / credibility ───────────────────────────────────── */}
        <section className="mt-20">
          <div className="rounded-[32px] bg-panel p-8 text-white md:p-12">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
              <div>
                <p className="ui-eyebrow" style={{ color: 'var(--color-accent-amber-light)' }}>Grounded, not hyped</p>
                <h2 className="font-display mt-3 text-3xl font-semibold leading-snug" style={{ letterSpacing: '-0.01em' }}>
                  Built for endurance coaches. Honest about what’s built.
                </h2>
                <p className="mt-4 text-sm leading-7 text-white/60">
                  Threshold is designed around real coaching workflows — roster triage, athlete
                  check-ins, structured protocols, race prep — and it’s early. We’d rather say so
                  than manufacture social proof. Coach case studies will appear here as the first
                  cohort earns them. What you can verify today: the research library, the pricing,
                  and the product itself — free to try before you commit anything.
                </p>
                <p className="mt-4 text-sm leading-7 text-white/60">
                  And one principle that won’t change: Threshold informs your judgment. It doesn’t
                  replace it.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { stat: '72', label: 'peer-reviewed papers in the research library' },
                  { stat: '19', label: 'protocol topics, from heat to gut training' },
                  { stat: '~30s', label: 'per athlete check-in — signal without homework' },
                  { stat: '1 rate', label: 'flat coach pricing, 5 athletes or 50' },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="font-mono text-3xl font-semibold" style={{ color: 'var(--color-accent-amber-light)' }}>{s.stat}</p>
                    <p className="mt-2 text-xs leading-5 text-white/55">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Athlete strip (secondary audience) ────────────────────── */}
        <section className="mt-12">
          <div className="flex flex-col items-start justify-between gap-5 rounded-[28px] border border-ink/10 bg-white p-8 shadow-[0_8px_24px_rgba(19,24,22,0.05)] md:flex-row md:items-center">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ink/35">Self-coached?</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">The same analytics, pointed at your own training.</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-ink/60">
                Log interventions, check in after sessions, and see what actually moves your training
                quality — the engine coaches use, on a roster of one.
              </p>
            </div>
            <a
              href={startHref}
              className="shrink-0 rounded-full border border-ink/15 bg-paper px-6 py-3 text-sm font-semibold text-ink transition hover:bg-ink hover:text-paper"
            >
              Start as an athlete →
            </a>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────── */}
        <section className="mt-12">
          <div
            className="overflow-hidden rounded-[40px] px-8 py-16 text-center md:px-16 md:py-20"
            style={{ background: 'linear-gradient(135deg, #1c1a17 0%, #302b25 42%, #7d684d 100%)', color: 'var(--color-text-on-dark)' }}
          >
            <p className="ui-eyebrow" style={{ color: 'var(--color-accent-amber-light)' }}>Early access · Free to start · Flat coach pricing</p>
            <h2
              className="font-display mx-auto mt-4 max-w-2xl font-semibold leading-snug"
              style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--color-text-on-dark)' }}
            >
              See the signal before it becomes a problem.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7" style={{ color: 'var(--color-text-muted-on-dark)' }}>
              Set up your roster in an afternoon. Athletes join free, check-ins start flowing, and
              your morning review gets shorter — and sharper — from the first week.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href={coachHref}
                className="inline-flex rounded-full px-8 py-4 text-base font-semibold text-white transition hover:opacity-90"
                style={{ background: 'var(--color-accent-amber)', boxShadow: '0 6px 20px rgba(196,136,42,0.30)' }}
              >
                Get early access →
              </a>
              <a
                href="/pricing"
                className="inline-flex rounded-full border border-white/25 px-8 py-4 text-base font-semibold text-white transition hover:bg-white/10"
              >
                See coach pricing
              </a>
            </div>
            <p className="mt-5 text-xs" style={{ color: 'var(--color-text-muted-on-dark)' }}>No credit card required · Athletes join your roster free</p>
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
