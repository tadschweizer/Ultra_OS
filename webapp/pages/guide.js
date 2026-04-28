import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import { usePlan } from '../lib/planUtils';

const sections = [
  {
    title: 'Intervention Log',
    body:
      'Use the intervention log to record the protocol you chose, the session or race it was tied to, and any notes that matter later. The goal is simple: capture what you tried so Threshold can compare it against how you responded.',
    value:
      'This is the core dataset behind intervention insights. The more consistently you log protocols, the faster the platform can separate useful patterns from one-off experiments.',
    cta: { label: 'Log your first intervention', href: '/log-intervention' },
  },
  {
    title: 'Baseline Tracker',
    body:
      'Your baseline settings hold the stable information that makes later comparisons more meaningful: altitude, heart-rate zones, fueling anchors, hydration targets, and supplements you use regularly.',
    value:
      'These inputs help Threshold interpret logs in context instead of treating every intervention as if it happened in a vacuum.',
    cta: { label: 'Set up your baseline', href: '/settings' },
  },
  {
    title: 'Race Profile',
    body:
      'Save the race you are training for once, then link interventions to that event as you log them. Keep the race date and course basics current so your history stays tied to the right build.',
    value:
      'Race context makes it easier to review a full preparation cycle rather than isolated sessions.',
    cta: { label: 'Add a target race', href: '/log-intervention' },
  },
  {
    title: 'Insight Engine',
    body:
      'When enough useful data exists, Threshold turns your intervention history, baseline trends, and race context into short insight cards. If there is not enough evidence yet, the product should tell you what to log next instead of pretending certainty.',
    value:
      'The point of the insight engine is to help you make a decision, not to flood you with commentary.',
    cta: { label: 'View your insights', href: '/insights' },
  },
  {
    title: 'Self-Selection Explorer',
    body:
      'The explorer lets you choose one input variable and one outcome variable, then see the relationship in a simple chart with a plain-English interpretation. It works best when you already have a decent amount of history for the variables you pick.',
    value:
      'This is useful when you want to test your own theory against your own data instead of waiting for the platform to surface a pattern automatically.',
    cta: { label: 'Open the Explorer', href: '/explorer' },
  },
  {
    title: 'Research Library',
    body:
      'The research library is where you can browse studies relevant to running from the mile through marathon+, plus gravel and triathlon training, without digging through academic formatting. Use search and filters to narrow the library to the topics you actually care about.',
    value:
      'It gives context for why a protocol is worth testing, while your own logs show whether it worked for you.',
    cta: { label: 'Browse the research library', href: '/content' },
  },
  {
    title: 'Coach Dashboard',
    body:
      'If you are on a coach plan, the coach dashboard is built around triage, full-roster monitoring, and protocol assignment. It is designed to show which athletes need attention now, not to duplicate the athlete dashboard.',
    value:
      'Coaches get a faster path to the handful of decisions that matter most in a given week.',
    cta: { label: 'Go to Coach Command Center', href: '/coach-command-center' },
    coachOnly: true,
  },
];

export default function GuidePage() {
  const { coachFeatures } = usePlan();
  const navLinks = [
    { href: '/', label: 'Landing Page' },
    { href: '/dashboard', label: 'Threshold Home' },
    { href: '/guide', label: 'Guide' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/connections', label: 'Connections' },
    { href: '/content', label: 'Research Library' },
  ];

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold Guide</p>
          </div>
          <NavMenu label="Guide navigation" links={navLinks} primaryLink={{ href: '/pricing', label: 'Pricing', variant: 'secondary' }} />
        </div>

        <DashboardTabs
          activeHref="/guide"
          tabs={[
            { href: '/guide', label: 'Guide' },
            { href: '/pricing', label: 'Pricing' },
            { href: '/connections', label: 'Connections' },
            { href: '/content', label: 'Research' },
          ]}
        />

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(145deg,#f7f2ea_0%,#eadcc7_48%,#d5bf9f_100%)] p-6 md:p-10">
          <p className="text-sm uppercase tracking-[0.35em] text-accent">How To Use Threshold</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Guide</h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-ink/80 md:text-lg">
            Threshold works best when you understand what each piece is for. This guide covers every feature. Come back whenever you need a refresher.
          </p>
        </section>

        <section className="mt-12 grid gap-4">
          {sections
            .filter((section) => !section.coachOnly || coachFeatures)
            .map((section) => (
              <article key={section.title} className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-sm uppercase tracking-[0.22em] text-accent">{section.title}</p>
                <p className="mt-4 text-sm leading-7 text-ink/78">{section.body}</p>
                <p className="mt-4 rounded-[22px] bg-paper px-4 py-4 text-sm leading-7 text-ink/76">{section.value}</p>
                {section.cta ? (
                  <a
                    href={section.cta.href}
                    className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white"
                  >
                    {section.cta.label}
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                ) : null}
              </article>
            ))}
        </section>
      </div>
    </main>
  );
}
