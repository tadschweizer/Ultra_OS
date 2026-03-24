import DashboardTabs from '../components/DashboardTabs';
import NavMenu from '../components/NavMenu';
import {
  activationRequirements,
  athleteInsightExamples,
  coachFlagExample,
  dataCategories,
  newAthleteValue,
  newCoachValue,
  proactiveInsightCategories,
  tierDefinitions,
} from '../lib/insightSystemContent';

function InsightCard({ card, accent = 'border-accent/30 bg-accent/10' }) {
  return (
    <article className="rounded-[28px] border border-ink/10 bg-white p-5 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.24em] text-accent">{card.type}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold text-ink ${accent}`}>{card.confidence}</span>
      </div>
      <h3 className="mt-4 text-2xl font-semibold leading-tight text-ink">{card.headline}</h3>
      <p className="mt-4 text-sm leading-7 text-ink/78">{card.body}</p>
      <div className="mt-4 rounded-[22px] border border-ink/10 bg-paper px-4 py-4">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">Suggested Action</p>
        <p className="mt-2 text-sm leading-7 text-ink/82">{card.action}</p>
      </div>
    </article>
  );
}

export default function InsightsPage() {
  const navLinks = [
    { href: '/', label: 'Landing Page' },
    { href: '/dashboard', label: 'UltraOS Home' },
    { href: '/onboarding', label: 'Onboarding' },
    { href: '/coaches', label: 'Coaches' },
    { href: '/connections', label: 'Connections' },
    { href: '/log-intervention', label: 'Log Intervention' },
    { href: '/history', label: 'Intervention History' },
    { href: '/content', label: 'Research Library' },
  ];

  const tabs = [
    { href: '/onboarding', label: 'Onboarding' },
    { href: '/insights', label: 'Insights System' },
    { href: '/coaches', label: 'Coaches' },
    { href: '/connections', label: 'Connections' },
    { href: '/log-intervention', label: 'Intervention' },
    { href: '/history', label: 'History' },
    { href: '/content', label: 'Research' },
  ];

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">UltraOS Insight System</p>
          </div>
          <NavMenu
            label="Insight system navigation"
            links={navLinks}
            primaryLink={{ href: '/coaches', label: 'Coach View', variant: 'secondary' }}
          />
        </div>

        <DashboardTabs activeHref="/insights" tabs={tabs} />

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(145deg,#f8f2e8_0%,#eadcc7_48%,#d5bf9f_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">From raw logging to decisions athletes can act on</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                Build the insight layer around interventions first, then let sleep and fueling widen the value.
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-ink/80 md:text-lg">
                UltraOS has one dataset but two audiences. Athletes need direct, specific insight cards they can act on today. Coaches need a triage layer that tells them which athlete needs attention now and why. This page turns that product logic into visible system rules.
              </p>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">System Guardrails</p>
              <div className="mt-5 space-y-3">
                {[
                  'Never generate an insight from fewer than 3 correlated data points.',
                  'Never make training load the primary subject of an insight.',
                  'Never surface more than 3 athlete insights at once.',
                  'Always show confidence honestly and link back to the underlying log.',
                ].map((item) => (
                  <div key={item} className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/82">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Data Model</p>
              <h2 className="font-display mt-2 text-4xl leading-tight md:text-5xl">Three categories. Three different rules.</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {dataCategories.map((item) => (
              <article key={item.title} className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-xs uppercase tracking-[0.22em] text-accent">{item.subtitle}</p>
                <h3 className="mt-4 text-2xl font-semibold text-ink">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-ink/78">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">Hierarchy</p>
          <h2 className="font-display mt-2 text-4xl leading-tight md:text-5xl">What gets surfaced, and when.</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {tierDefinitions.map((item) => (
              <article key={item.tier} className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-xs uppercase tracking-[0.22em] text-accent">{item.tier}</p>
                <h3 className="mt-4 text-2xl font-semibold text-ink">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-ink/78">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-[34px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)] md:p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">Tier 1 Trigger Conditions</p>
          <h2 className="font-display mt-2 text-4xl leading-tight md:text-5xl">Specific proactive insight rules.</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-ink">
              <thead>
                <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.18em] text-ink/55">
                  <th className="pb-3 pr-5">Category</th>
                  <th className="pb-3 pr-5">Trigger condition</th>
                  <th className="pb-3 pr-5">What the card must help decide</th>
                  <th className="pb-3">Minimum data</th>
                </tr>
              </thead>
              <tbody>
                {proactiveInsightCategories.map((item) => (
                  <tr key={item.category} className="border-b border-ink/8 align-top">
                    <td className="py-4 pr-5 font-semibold">{item.category}</td>
                    <td className="py-4 pr-5 leading-7 text-ink/78">{item.trigger}</td>
                    <td className="py-4 pr-5 leading-7 text-ink/78">{item.action}</td>
                    <td className="py-4 leading-7 text-ink/78">{item.minimumData}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">Examples</p>
          <h2 className="font-display mt-2 text-4xl leading-tight md:text-5xl">Six insight cards in the exact product format.</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {athleteInsightExamples.map((card) => (
              <InsightCard key={card.headline} card={card} />
            ))}
            <InsightCard card={coachFlagExample} accent="border-ink/10 bg-paper" />
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[30px] bg-[linear-gradient(135deg,#1b2421_0%,#29302d_100%)] p-6 text-white">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Activation Minimums</p>
            <div className="mt-5 space-y-3">
              {activationRequirements.map((item) => (
                <div key={item.category} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">{item.category}</p>
                  <p className="mt-2 text-sm leading-6 text-white/76">{item.requirement}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">First 30 Days</p>
            <div className="mt-5 space-y-5">
              <div>
                <h3 className="text-2xl font-semibold text-ink">New athlete value</h3>
                <div className="mt-4 space-y-3">
                  {newAthleteValue.map((item) => (
                    <div key={item.title} className="rounded-[22px] bg-paper p-4">
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-ink/76">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-semibold text-ink">New coach value</h3>
                <div className="mt-4 space-y-3">
                  {newCoachValue.map((item) => (
                    <div key={item.title} className="rounded-[22px] bg-paper p-4">
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-ink/76">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
