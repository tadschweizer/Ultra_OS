import DashboardTabs from '../components/DashboardTabs';
import NavMenu from '../components/NavMenu';
import {
  onboardingMilestones,
  onboardingPrompts,
  onboardingStages,
  onboardingThresholds,
} from '../lib/insightSystemContent';

const setupQuestions = [
  'Primary sport',
  'Next target race',
  'Current training phase',
  'Coach on platform?',
];

const reengagementExamples = [
  {
    athlete: 'Athlete with only 1 sleep log',
    prompt: 'Your race is 86 days away. Log last night’s sleep to start the five-day streak that unlocks your first sleep insight.',
  },
  {
    athlete: 'Athlete with 3 sleep logs and 1 intervention',
    prompt: 'Your race is 52 days away. Log tonight’s sleep to stay on pace for your first sleep insight before next week starts.',
  },
  {
    athlete: 'Athlete with 3 interventions but no race conditions',
    prompt: 'Your race is 31 days away. Add race conditions next so UltraOS can interpret those intervention sessions in the right context.',
  },
];

export default function OnboardingPage() {
  const navLinks = [
    { href: '/', label: 'Landing Page' },
    { href: '/dashboard', label: 'UltraOS Home' },
    { href: '/insights', label: 'Insights System' },
    { href: '/coaches', label: 'Coaches' },
    { href: '/connections', label: 'Connections' },
    { href: '/log-intervention', label: 'Log Intervention' },
  ];

  const tabs = [
    { href: '/onboarding', label: 'Onboarding' },
    { href: '/insights', label: 'Insights System' },
    { href: '/coaches', label: 'Coaches' },
    { href: '/connections', label: 'Connections' },
    { href: '/log-intervention', label: 'Intervention' },
    { href: '/content', label: 'Research' },
  ];

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">UltraOS Onboarding</p>
          </div>
          <NavMenu
            label="Onboarding page navigation"
            links={navLinks}
            primaryLink={{ href: '/insights', label: 'Insight System', variant: 'secondary' }}
          />
        </div>

        <DashboardTabs activeHref="/onboarding" tabs={tabs} />

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(145deg,#efe8da_0%,#ddd0b7_45%,#b89b77_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">First-run product flow</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                Onboarding should feel like signal is building, not like forms are piling up.
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-ink/80 md:text-lg">
                The job of onboarding is narrow: get a new athlete to enough useful data, fast. Every screen should push toward the next likely insight and remove anything that feels like homework.
              </p>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">First-run rules</p>
              <div className="mt-5 space-y-3">
                {[
                  'Ask only four setup questions before the first dashboard.',
                  'Show no empty charts and no gray placeholders on first visit.',
                  'Use a five-milestone tracker with no locked order.',
                  'Switch to active mode the moment all five milestones are complete.',
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
          <p className="text-sm uppercase tracking-[0.25em] text-accent">Three Stages</p>
          <h2 className="font-display mt-2 text-4xl leading-tight md:text-5xl">What the new athlete sees from day zero to activation.</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {onboardingStages.map((item) => (
              <article key={item.stage} className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-xs uppercase tracking-[0.22em] text-accent">{item.stage}</p>
                <h3 className="mt-4 text-2xl font-semibold text-ink">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-ink/78">{item.body}</p>
                <div className="mt-4 space-y-2">
                  {item.details.map((detail) => (
                    <div key={detail} className="rounded-[18px] bg-paper px-4 py-3 text-sm text-ink/80">
                      {detail}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Stage 1 Inputs</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">Exactly four setup questions.</h2>
            <div className="mt-5 grid gap-3">
              {setupQuestions.map((question, index) => (
                <div key={question} className="flex items-center gap-3 rounded-[22px] bg-paper px-4 py-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper">
                    {index + 1}
                  </span>
                  <p className="text-sm font-semibold text-ink">{question}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] bg-[linear-gradient(135deg,#1b2421_0%,#29302d_100%)] p-6 text-white">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Stage 2 Empty Dashboard</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">One prompt. Five visible milestones.</h2>
            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-accent">First prompt copy</p>
              <p className="mt-3 text-base leading-8 text-white/84">
                Your race is 74 days away. Start by logging last night&apos;s sleep so UltraOS can begin building your first useful signal.
              </p>
            </div>
            <div className="mt-5 grid gap-3">
              {onboardingMilestones.map((milestone, index) => (
                <div key={milestone} className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-sm text-white/82">{milestone}</p>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${index < 2 ? 'bg-accent text-panel' : 'border border-white/20 text-white/55'}`}>
                    {index < 2 ? '✓' : index + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-[34px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)] md:p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">Activation Logic</p>
          <h2 className="font-display mt-2 text-4xl leading-tight md:text-5xl">Minimum data thresholds that unlock each feature.</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-ink">
              <thead>
                <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.18em] text-ink/55">
                  <th className="pb-3 pr-5">Feature</th>
                  <th className="pb-3">Threshold</th>
                </tr>
              </thead>
              <tbody>
                {onboardingThresholds.map((item) => (
                  <tr key={item.category} className="border-b border-ink/8 align-top">
                    <td className="py-4 pr-5 font-semibold">{item.category}</td>
                    <td className="py-4 leading-7 text-ink/78">{item.threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Stage 3 Activated State</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">What changes when onboarding completes.</h2>
            <div className="mt-5 space-y-3">
              {[
                'The five-milestone tracker disappears completely.',
                'The insight panel appears in its place.',
                'Only one insight shows at first, based on whatever data exists.',
                'If the signal is thin, the card should say it is an early signal rather than pretending certainty.',
              ].map((item) => (
                <div key={item} className="rounded-[22px] bg-paper px-4 py-4 text-sm leading-6 text-ink/80">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Re-engagement Logic</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">Quiet athletes get one specific next step.</h2>
            <div className="mt-5 space-y-3">
              {onboardingPrompts.map((item) => (
                <div key={item.title} className="rounded-[24px] border border-ink/10 bg-white/75 p-4">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/76">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">Re-engagement Examples</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {reengagementExamples.map((item) => (
              <div key={item.athlete} className="rounded-[24px] bg-paper p-4">
                <p className="text-sm font-semibold text-ink">{item.athlete}</p>
                <p className="mt-3 text-sm leading-7 text-ink/78">{item.prompt}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
