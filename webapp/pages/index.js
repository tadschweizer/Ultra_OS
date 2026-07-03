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

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CrossMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1 h-3.5 w-3.5 shrink-0 text-ink/30" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/* ── Content ─────────────────────────────────────────────────────── */

const painPoints = [
  {
    title: 'Referrals are a pipeline you can’t see',
    body: 'Word-of-mouth built your roster, but it arrives on its own schedule. Some seasons you turn athletes away; others you quietly wonder where the next inquiry is coming from.',
  },
  {
    title: 'Athletes judge the operation before the coaching',
    body: 'A serious athlete decides whether you look professional long before they experience how good you actually are. Scattered systems undersell the coaching behind them.',
  },
  {
    title: 'The admin lives in six places',
    body: 'Plans in one app, check-ins over text, protocols in a spreadsheet, race notes in your head. Every athlete you add multiplies the tabs — and the chances something slips.',
  },
  {
    title: 'Your hours go to chasing, not coaching',
    body: '“How did the heat block go?” “Did you do the gut session?” The follow-up messages that hold your coaching together are exactly the hours nobody pays you for.',
  },
];

const shifts = [
  { from: 'Spreadsheets, DMs, and memory', to: 'One roster with a real system of record' },
  { from: '“Trust me, it works”', to: 'Feedback backed by each athlete’s own data' },
  { from: 'Onboarding over group text', to: 'A professional invite and first-week flow' },
  { from: 'Guessing who needs attention', to: 'A daily triage that surfaces it for you' },
  { from: 'Pricing anxiety as the roster grows', to: 'One flat rate at any roster size' },
];

const pillars = [
  {
    icon: 'roster',
    label: 'Coach Command Center',
    headline: 'Run the whole roster from one morning view',
    body: 'Threshold opens on the questions that actually drive a coaching day: who needs attention, who races soon, who is off-protocol, who is missing data. Triage first, then coach — instead of scrolling message threads to reconstruct the picture.',
  },
  {
    icon: 'clipboard',
    label: 'Protocol Assignments',
    headline: 'Assign real protocols, not vague advice',
    body: 'Heat blocks, gut training, sodium bicarbonate, sleep extension — assign structured protocols to a single athlete or a whole training group, then watch compliance without asking. Your expertise, delivered like a professional service.',
  },
  {
    icon: 'pulse',
    label: 'Athlete Check-ins & Correlations',
    headline: 'Give feedback their own data backs up',
    body: 'Athletes report each session in about 30 seconds — legs feel, energy, RPE. Threshold compares every check-in against the interventions from the prior 48 hours and surfaces what’s actually moving training quality, per athlete.',
  },
  {
    icon: 'flag',
    label: 'Race Prep Oversight',
    headline: 'Walk every athlete to the start line prepared',
    body: 'Race blueprints sequence fueling, hydration, and pre-race protocols from the athlete’s own logged baseline. You see race-prep risk across the roster, and the post-race debrief closes the loop for next season.',
  },
];

const supportingPillars = [
  {
    icon: 'calendar',
    label: 'Training Calendar',
    body: 'A weekly calendar for planned work and group workout assignments — alongside the protocol layer, not a replacement for your planning stack.',
  },
  {
    icon: 'book',
    label: 'Research Library',
    body: '72 peer-reviewed papers across 19 topics, written in plain English. Point an athlete at the evidence behind your call instead of “because I said so.”',
  },
  {
    icon: 'message',
    label: 'Notes & Messaging',
    body: 'Coach notes, shared resources, and athlete messaging live next to the data they’re about — not in a separate app with no context.',
  },
];

const forWho = [
  'Coaches whose service should look as professional as their coaching already is',
  'Coaches good at the craft who need better systems around it',
  'Coaches who want to attract committed athletes, not tire-kickers',
  'Coaches moving from side-project coaching to a real business',
  'Coaches tired of patching together spreadsheets, DMs, and five apps',
];

const notForWho = [
  'Coaches looking for a shortcut instead of a system',
  'Coaches who won’t put structure behind their protocols',
  'Coaches who want automation to replace the actual coaching',
];

const differentiators = [
  {
    title: 'Built around your credibility, not just software',
    body: 'Everything an athlete touches — the invite, the assigned protocol, the data-backed feedback — makes your coaching look like the professional service it is. The product is your operation, seen from the athlete’s side.',
  },
  {
    title: 'It works alongside your planning stack',
    body: 'Threshold doesn’t ask you to abandon TrainingPeaks or Strava. Plans and workouts stay where they are; Threshold owns the layer they miss — protocols, responses, readiness, and race prep.',
  },
  {
    title: 'Flat pricing that respects growth',
    body: 'One rate whether you coach 5 athletes or 50. Your software bill shouldn’t punish you for doing the thing you set out to do. Athletes join your roster free.',
  },
  {
    title: 'Evidence over hype',
    body: 'No “10x your roster overnight.” A peer-reviewed research library, per-athlete correlations, and honest numbers. If a claim isn’t in the data, it isn’t on the page.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Set up your roster',
    body: 'Create your coach account and invite athletes. They join free, connect Strava or log manually, and land in a clean first-week flow — no onboarding-by-group-text.',
  },
  {
    step: '02',
    title: 'Assign the work',
    body: 'Put structured protocols on each athlete or training group — heat, gut, sleep, fueling. Athletes see exactly what to do today; you see who’s doing it.',
  },
  {
    step: '03',
    title: 'Coach with the data',
    body: 'Check-ins flow in after every session. Correlations surface per athlete. Your feedback stops being opinion and starts being their own numbers, read by an expert.',
  },
];

/* ── Hero roster panel (stylized product illustration) ───────────── */
function RosterPanel() {
  const rows = [
    {
      initials: 'MO',
      name: 'M. Okafor',
      chip: 'Races in 12 days',
      chipTone: 'amber',
      detail: 'Race prep on track',
      pct: 92,
    },
    {
      initials: 'SH',
      name: 'S. Hartley',
      chip: 'Needs attention',
      chipTone: 'warn',
      detail: 'Heat block · day 4 missed',
      pct: 41,
    },
    {
      initials: 'JR',
      name: 'J. Ruiz',
      chip: '+1.4 legs feel',
      chipTone: 'positive',
      detail: 'Foam rolling correlation · 3 check-ins this week',
      pct: 78,
    },
  ];
  const chipStyles = {
    amber: 'bg-amber/20 text-amber-light',
    warn: 'bg-red-400/15 text-red-300',
    positive: 'bg-emerald-400/15 text-emerald-300',
  };
  return (
    <div className="rounded-[22px] bg-panel p-6 text-white shadow-panel" aria-label="Illustration of the Coach Command Center roster triage">
      <div className="flex items-center justify-between">
        <p className="ui-eyebrow" style={{ color: 'var(--color-accent-amber-light)' }}>Coach Command Center</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">This morning</span>
      </div>
      <p className="mt-2 text-[15px] font-semibold leading-snug">Roster triage — who needs you today</p>
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <div key={row.name}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] font-semibold text-white/80">{row.initials}</span>
                <span className="truncate text-[13px] font-semibold text-white/90">{row.name}</span>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold ${chipStyles[row.chipTone]}`}>{row.chip}</span>
            </div>
            <p className="mt-1.5 pl-[38px] text-xs text-white/50">{row.detail}</p>
            <div className="ml-[38px] mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: 'var(--color-positive)' }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/45">
        <span>12 athletes · 2 need attention</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em]">Flat rate</span>
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
        <title>Threshold — The operating layer for serious coaching businesses</title>
        <meta
          key="description"
          name="description"
          content="Threshold helps endurance coaches run a professional coaching business — roster triage, protocol assignments, athlete check-ins, and race prep in one place. Flat pricing, any roster size."
        />
        <meta key="og-title" property="og:title" content="Threshold — The operating layer for serious coaching businesses" />
        <meta
          key="og-description"
          property="og:description"
          content="One professional home for your coaching: roster oversight, structured protocols, data-backed athlete feedback, and race prep. Athletes join free."
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
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0">
              <p className="ui-eyebrow" style={{ fontSize: 11 }}>For endurance coaches · The operating layer for your coaching business</p>
              <h1
                className="font-display mt-5 max-w-[780px] font-semibold text-ink"
                style={{ fontSize: 'clamp(38px, 5.6vw, 68px)', lineHeight: 1.05 }}
              >
                Build a coaching business that looks as good as your coaching.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-[1.8] text-ink/70 md:text-lg">
                You’re already great at making athletes faster. Threshold handles what surrounds that — one
                professional home for your roster, protocols, athlete check-ins, and race prep — so every
                athlete experiences a serious operation instead of scattered spreadsheets and DMs.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={coachHref}
                  className="rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-paper shadow-[0_4px_20px_rgba(19,24,22,0.18)] transition hover:opacity-85"
                >
                  Set up your roster — free
                </a>
                <a
                  href="/guide"
                  className="rounded-full border border-ink/15 bg-white px-7 py-3.5 text-sm font-semibold text-ink transition hover:bg-surface-light"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-5 text-xs text-ink/45">Free to start · No credit card · Flat coach pricing at any roster size</p>
            </div>

            <div className="min-w-0">
              <RosterPanel />
            </div>
          </div>
        </section>

        {/* ── Problem ───────────────────────────────────────────────── */}
        <section className="mt-20">
          <p className="ui-eyebrow">The problem</p>
          <h2 className="font-display mt-3 max-w-3xl text-3xl font-semibold text-ink md:text-4xl" style={{ letterSpacing: '-0.01em' }}>
            Good coaching alone doesn’t grow a coaching business.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/60 md:text-base">
            Most coaches don’t have a coaching problem. They have an operation problem — and athletes can tell.
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

        {/* ── Transformation ────────────────────────────────────────── */}
        <section className="mt-20">
          <div className="rounded-[32px] border border-accent/20 bg-[linear-gradient(135deg,#fffbf0_0%,#fdf3d7_100%)] p-8 shadow-[0_8px_32px_rgba(201,131,29,0.10)] md:p-12">
            <p className="ui-eyebrow">The shift</p>
            <h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold text-ink md:text-4xl" style={{ letterSpacing: '-0.01em' }}>
              The threshold worth crossing.
            </h2>
            <div className="mt-8 space-y-0 divide-y divide-accent/15">
              {shifts.map((s) => (
                <div key={s.to} className="grid gap-1.5 py-4 md:grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] md:items-center md:gap-4">
                  <p className="text-sm text-ink/45 md:text-right">{s.from}</p>
                  <span className="hidden text-center font-mono text-accent md:block" aria-hidden="true">→</span>
                  <p className="text-sm font-semibold text-ink">{s.to}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── What Threshold does ───────────────────────────────────── */}
        <section className="mt-20">
          <p className="ui-eyebrow">What Threshold does</p>
          <h2 className="font-display mt-3 max-w-3xl text-3xl font-semibold text-ink md:text-4xl" style={{ letterSpacing: '-0.01em' }}>
            The professional layer between your expertise and your athletes.
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {pillars.map((f) => (
              <div key={f.label} className="flex flex-col rounded-[28px] border border-ink/10 bg-white p-8 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Icon name={f.icon} />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/40">{f.label}</p>
                </div>
                <h3 className="mt-5 text-xl font-semibold leading-snug text-ink md:text-2xl">{f.headline}</h3>
                <p className="mt-3 text-sm leading-7 text-ink/60">{f.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {supportingPillars.map((f) => (
              <div key={f.label} className="rounded-[24px] border border-ink/10 bg-surface-light p-6">
                <div className="flex items-center gap-2.5 text-ink/50">
                  <Icon name={f.icon} className="h-[18px] w-[18px]" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">{f.label}</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink/65">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Who it's for ──────────────────────────────────────────── */}
        <section className="mt-20 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-ink/10 bg-white p-8 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Threshold is for</p>
            <div className="mt-6 space-y-4">
              {forWho.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm leading-6 text-ink/75">
                  <CheckMark />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-ink/10 bg-surface-light p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ink/35">It’s not for</p>
            <div className="mt-6 space-y-4">
              {notForWho.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm leading-6 text-ink/55">
                  <CrossMark />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-8 border-t border-ink/10 pt-6 text-sm leading-7 text-ink/60">
              Threshold makes a serious coaching practice easier to run and easier to trust. It doesn’t
              replace the judgment, relationships, or work that make coaching worth paying for.
            </p>
          </div>
        </section>

        {/* ── Differentiation ───────────────────────────────────────── */}
        <section className="mt-20">
          <p className="ui-eyebrow">Why Threshold</p>
          <h2 className="font-display mt-3 max-w-3xl text-3xl font-semibold text-ink md:text-4xl" style={{ letterSpacing: '-0.01em' }}>
            Coaching software is everywhere. A credibility layer isn’t.
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {differentiators.map((d, i) => (
              <div key={d.title} className="rounded-[24px] border border-ink/10 bg-white p-7 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
                <p className="font-mono text-sm font-semibold text-accent">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mt-3 text-lg font-semibold leading-snug text-ink">{d.title}</h3>
                <p className="mt-3 text-sm leading-7 text-ink/60">{d.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Trust / numbers ───────────────────────────────────────── */}
        <section className="mt-20">
          <div className="rounded-[32px] bg-panel p-8 text-white md:p-12">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
              <div>
                <p className="ui-eyebrow" style={{ color: 'var(--color-accent-amber-light)' }}>Grounded, not hyped</p>
                <h2 className="font-display mt-3 text-3xl font-semibold leading-snug" style={{ letterSpacing: '-0.01em' }}>
                  We publish what’s real. Nothing else.
                </h2>
                <p className="mt-4 text-sm leading-7 text-white/60">
                  Threshold is early, and we’d rather say so than manufacture social proof. Coach case
                  studies and athlete outcomes will appear here as the first cohort earns them. What you
                  can verify today: the research library, the pricing, and the product itself — free to try
                  before you commit anything.
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

        {/* ── How it works ──────────────────────────────────────────── */}
        <section className="mt-20">
          <p className="ui-eyebrow">How it works</p>
          <h2 className="font-display mt-3 text-3xl font-semibold text-ink md:text-4xl" style={{ letterSpacing: '-0.01em' }}>
            From scattered to professional in three steps.
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((item) => (
              <div key={item.step} className="ui-card">
                <p className="font-mono text-[32px] font-semibold" style={{ color: 'var(--color-accent-amber)', lineHeight: 1 }}>{item.step}</p>
                <p className="mt-4 text-lg font-semibold text-ink">{item.title}</p>
                <p className="mt-2 text-sm leading-[1.65] text-ink/60">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Athlete strip (secondary audience) ────────────────────── */}
        <section className="mt-12">
          <div className="flex flex-col items-start justify-between gap-5 rounded-[28px] border border-ink/10 bg-white p-8 shadow-[0_8px_24px_rgba(19,24,22,0.05)] md:flex-row md:items-center">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ink/35">Self-coached?</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Threshold works without a coach, too.</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-ink/60">
                Log interventions, check in after sessions, and let the correlations coach you — the same
                engine, pointed at your own training.
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
            <p className="ui-eyebrow" style={{ color: 'var(--color-accent-amber-light)' }}>Free to start · Flat coach pricing</p>
            <h2
              className="font-display mx-auto mt-4 max-w-2xl font-semibold leading-snug"
              style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--color-text-on-dark)' }}
            >
              Your coaching already earns their trust. Give it an operation that keeps it.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7" style={{ color: 'var(--color-text-muted-on-dark)' }}>
              Set up your roster in an afternoon. Your athletes join free — and from their first invite,
              your coaching looks like the business it deserves to be.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href={coachHref}
                className="inline-flex rounded-full px-8 py-4 text-base font-semibold text-white transition hover:opacity-90"
                style={{ background: 'var(--color-accent-amber)', boxShadow: '0 6px 20px rgba(196,136,42,0.30)' }}
              >
                Set up your roster →
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
