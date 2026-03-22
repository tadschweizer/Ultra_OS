import { useMemo, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';

const topicChips = [
  'All',
  'Heat Training',
  'Bicarbonate',
  'Gut Training',
  'Altitude',
  'Threshold',
  'Sleep',
];

const contentLibrary = [
  {
    id: 'heat-01',
    title: 'Heat Acclimation Before Mountain 100s',
    type: 'Research Digest',
    topic: 'Heat Training',
    source: 'UltraOS',
    date: '2026-03-10',
    tags: ['Heat Training', 'Leadville', 'Western States'],
    summary:
      'Short daily heat blocks still move the needle for late-race durability when the sessions are layered onto the existing training load instead of replacing key workouts.',
    commentary:
      'Best use case: 10-14 days before a hot race block, especially when the athlete already has stable long-run volume.',
  },
  {
    id: 'heat-02',
    title: 'Post-Exercise Sauna and Plasma Volume',
    type: 'Study',
    topic: 'Heat Training',
    source: 'Journal Review',
    date: '2025-11-18',
    tags: ['Heat Training', 'Sauna', 'Recovery'],
    summary:
      'The useful signal is consistency, not extreme heat. Moderate repeated exposure after easier sessions appears more practical than sporadic maximal exposures.',
    commentary:
      'This fits athletes who can tolerate routine post-run sauna without derailing the next quality session.',
  },
  {
    id: 'bicarb-01',
    title: 'Bicarbonate Use in Long Endurance Events',
    type: 'Research Article',
    topic: 'Bicarbonate',
    source: 'Applied Physiology Review',
    date: '2025-08-22',
    tags: ['Bicarbonate', 'Fueling', 'GI'],
    summary:
      'Bicarbonate remains situational. The performance upside is real for high-intensity segments, but the protocol only works when the gut can tolerate it.',
    commentary:
      'Good fit for race-specific workouts with sustained pressure, not for every long aerobic day.',
  },
  {
    id: 'gut-01',
    title: 'Gut Training for 90 to 120 g/hr',
    type: 'Study',
    topic: 'Gut Training',
    source: 'Nutrition Review',
    date: '2026-01-09',
    tags: ['Gut Training', 'Fueling', 'Carbohydrate'],
    summary:
      'Absorption tolerance improves when athletes train the target intake repeatedly during real movement, not just in static lab-style protocols.',
    commentary:
      'The main practical question is whether the athlete can scale carbohydrate without creating a GI tradeoff that ruins the workout.',
  },
  {
    id: 'alt-01',
    title: 'Altitude Tent Use Without Overreaching',
    type: 'Post',
    topic: 'Altitude',
    source: 'UltraOS',
    date: '2026-02-27',
    tags: ['Altitude', 'Sleep Altitude', 'Recovery'],
    summary:
      'Altitude tent use works better when the sleep target is stable and paired with a known baseline sleep altitude. Random jumps in exposure create noise instead of adaptation.',
    commentary:
      'This is where athlete settings matter. Without baseline sleep altitude, the intervention is harder to interpret.',
  },
  {
    id: 'thr-01',
    title: 'Threshold Density Across 12-Week Blocks',
    type: 'Commentary',
    topic: 'Threshold',
    source: 'UltraOS',
    date: '2026-03-03',
    tags: ['Threshold', 'Training Theory', 'Long Run'],
    summary:
      'Threshold-heavy blocks often improve the first hour of long runs, but only when easy volume is still large enough to protect freshness and durability.',
    commentary:
      'This is the type of pattern the intervention engine should eventually surface automatically from the athlete’s own data.',
  },
  {
    id: 'sleep-01',
    title: 'Sleep Compression During Peak Build',
    type: 'Research Digest',
    topic: 'Sleep',
    source: 'UltraOS',
    date: '2026-02-14',
    tags: ['Sleep', 'Recovery', 'Peak'],
    summary:
      'Small sleep losses compound quickly in high-volume blocks. The effect usually shows up first in perceived exertion before it shows up in pace.',
    commentary:
      'This becomes more valuable once Garmin or another wearable source can keep the baseline current.',
  },
  {
    id: 'heat-03',
    title: 'Heat Training Timing Before Race Week',
    type: 'Commentary',
    topic: 'Heat Training',
    source: 'UltraOS',
    date: '2026-03-15',
    tags: ['Heat Training', 'Race Week', 'Taper'],
    summary:
      'The timing decision matters more than the total number of sessions. Pushing heat too deep into taper week can leave the athlete flat on race day.',
    commentary:
      'The right answer depends on the athlete’s total load and the climate of the target event.',
  },
];

function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString();
}

export default function Content() {
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('All');
  const navLinks = [
    { href: '/dashboard', label: 'UltraOS Home' },
    { href: '/connections', label: 'Connections' },
    { href: '/log-intervention', label: 'Log Intervention' },
    { href: '/history', label: 'Intervention History' },
    { href: '/settings', label: 'Settings' },
    { href: '/content', label: 'Content' },
    { href: '/', label: 'Landing Page' },
  ];

  const filteredItems = useMemo(() => {
    return contentLibrary.filter((item) => {
      const matchesTopic = activeTopic === 'All' || item.topic === activeTopic;
      const haystack = `${item.title} ${item.type} ${item.source} ${item.summary} ${item.commentary} ${item.tags.join(' ')}`.toLowerCase();
      const matchesQuery = query.trim() ? haystack.includes(query.trim().toLowerCase()) : true;
      return matchesTopic && matchesQuery;
    });
  }, [activeTopic, query]);

  const featuredItems = filteredItems.slice(0, 3);

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
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Research Library</p>
              <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Search the current intervention stack.</h1>
            </div>
            <div className="rounded-[32px] bg-panel p-5 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Results</p>
                  <p className="mt-2 text-2xl font-semibold">{filteredItems.length}</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Topics</p>
                  <p className="mt-2 text-2xl font-semibold">{topicChips.length - 1}</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Mode</p>
                  <p className="mt-2 text-2xl font-semibold">AI Feed</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search heat training, bicarbonate, gut training..."
              className="w-full rounded-full border border-ink/10 bg-white/85 px-5 py-4 text-base text-ink outline-none transition focus:border-ink/30"
            />
            <div className="flex flex-wrap gap-2">
              {topicChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setActiveTopic(chip)}
                  className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                    activeTopic === chip
                      ? 'bg-ink text-paper'
                      : 'border border-ink/10 bg-white/75 text-ink'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="rounded-[30px] bg-[linear-gradient(135deg,#1b2421_0%,#29302d_100%)] p-6 text-white">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Featured Now</p>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Recent + Relevant</span>
            </div>
            <div className="mt-5 space-y-4">
              {featuredItems.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-panel">{item.topic}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">{item.type}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">{formatDate(item.date)}</span>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-white">{item.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/80">{item.summary}</p>
                  <div className="mt-4 rounded-[20px] border border-white/10 bg-black/10 p-4 text-sm text-white/78">
                    {item.commentary}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Active Tracks</p>
              <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">Dashboard + Email</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {['Heat Training', 'Bicarbonate', 'Gut Training', 'Altitude', 'Threshold', 'Sleep'].map((track) => (
                <button
                  key={track}
                  type="button"
                  onClick={() => setActiveTopic(track)}
                  className="rounded-[22px] bg-paper px-4 py-5 text-left text-sm font-semibold text-ink transition hover:bg-[#e8ddd0]"
                >
                  {track}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Library</p>
            <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">{filteredItems.length} items</span>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {filteredItems.map((item) => (
              <article key={item.id} className="rounded-[24px] bg-paper p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink">{item.type}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-ink/70">{item.source}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-ink/70">{formatDate(item.date)}</span>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-ink">{item.title}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-ink/10 px-3 py-1 text-xs text-ink/70">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-ink/78">{item.summary}</p>
                <div className="mt-4 rounded-[20px] border border-ink/10 bg-white px-4 py-4 text-sm text-ink/70">
                  {item.commentary}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
