import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';

const contentTasks = [
  {
    title: 'Publication Setup',
    status: 'Needs real values',
    body: 'The content file still has placeholders for the Substack name, URL, and subscriber counts. Those are the first blocking fields because they shape every downstream CTA and credibility signal.',
  },
  {
    title: 'Voice Library',
    status: 'Missing samples',
    body: 'There are no pasted examples of real writing yet. The file already defines the voice constraints clearly enough to start, but the AI tone-matching layer needs 1-2 finished paragraphs from actual published work.',
  },
  {
    title: 'Community Footprint',
    status: 'Needs accounts mapped',
    body: 'Reddit, Slowtwitch, Facebook groups, and Strava are listed, but the account names and posting history are still empty. That means distribution planning is not yet executable.',
  },
  {
    title: 'Lead Magnet',
    status: 'Undefined',
    body: 'The strongest immediate candidate is a practical protocol asset such as a heat acclimation PDF, race-nutrition calculator, or gut-training checklist. The content file needs one concrete lead magnet instead of a placeholder.',
  },
  {
    title: 'Seasonal Editorial Calendar',
    status: 'Partially seeded',
    body: 'The race calendar is present. The next content step is binding each race to an 8-12 week pre-race research topic so the publishing cadence follows actual athlete demand.',
  },
];

const keywordTracks = [
  'heat acclimation protocol for ultramarathon',
  'sodium bicarbonate protocol for 100 mile race',
  'how to train your gut for ultramarathon',
  'TrainingPeaks alternative ultrarunning',
  'what do elite ultrarunners do differently in training',
];

const upcomingAngles = [
  'Western States / Leadville: heat, sodium, gut, and late-race durability content.',
  'UTMB: climbing economy, hiking efficiency, and altitude strategy.',
  'Unbound / gravel crossover: fueling, gut training, and bike-to-run learning crossover.',
];

export default function Content() {
  const navLinks = [
    { href: '/dashboard', label: 'UltraOS Home', description: 'Insights, trends, and recent training.' },
    { href: '/connections', label: 'Connections', description: 'Manage linked sources.' },
    { href: '/log-intervention', label: 'Log Intervention', description: 'Create a new intervention entry.' },
    { href: '/history', label: 'Intervention History', description: 'Review intervention records.' },
    { href: '/settings', label: 'Settings', description: 'Edit athlete baselines and zones.' },
    { href: '/content', label: 'Content', description: 'Track the content and community workstream.' },
    { href: '/', label: 'Landing Page', description: 'Return to the public entry page.' },
  ];

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">UltraOS Content</p>
          </div>
          <NavMenu
            label="Content navigation"
            links={navLinks}
            primaryLink={{ href: '/dashboard', label: 'UltraOS Home' }}
          />
        </div>

        <DashboardTabs activeHref="/content" />

        <div className="mb-10 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Content Workstream</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                Turn the raw content brief into an operating surface.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/80">
                I read the content file and converted the immediate gaps into execution lanes: publication setup, voice capture, community distribution, lead magnet definition, and a race-timed editorial calendar.
              </p>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">What Is Blocking Execution</p>
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">No real publication metadata yet.</p>
                  <p className="mt-2 text-sm text-white/75">Substack identity, audience size, and lead magnet are still placeholders.</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">No real writing samples yet.</p>
                  <p className="mt-2 text-sm text-white/75">The voice rules are good, but tone matching gets stronger once published paragraphs are pasted into the source file.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {contentTasks.map((task) => (
            <article
              key={task.title}
              className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm uppercase tracking-[0.22em] text-accent">{task.title}</p>
                <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">{task.status}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink/80">{task.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Priority Keyword Tracks</p>
            <div className="mt-5 space-y-3">
              {keywordTracks.map((track) => (
                <div key={track} className="rounded-[22px] bg-paper p-4 text-sm text-ink/80">
                  {track}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] bg-[linear-gradient(135deg,#1b2421_0%,#29302d_100%)] p-6 text-white">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Editorial Timing Angles</p>
            <div className="mt-5 space-y-3">
              {upcomingAngles.map((angle) => (
                <div key={angle} className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                  {angle}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
