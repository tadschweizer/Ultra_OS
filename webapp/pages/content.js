import { useEffect, useMemo, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';

const topicOptions = [
  'Heat Acclimation',
  'Gut Training',
  'Sodium Bicarbonate',
  'Sleep',
  'Respiratory Training',
  'Altitude',
  'Supplementation',
  'Fueling & Nutrition',
  'HRV',
  'Recovery',
];

const sportOptions = [
  { key: 'ultra_score', label: 'Ultra' },
  { key: 'gravel_score', label: 'Gravel' },
  { key: 'triathlon_score', label: 'Triathlon' },
];

function clampClass(open) {
  if (open) return '';
  return '[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden';
}

function formatDate(year, publicationDate) {
  if (publicationDate) {
    return new Date(`${publicationDate}T12:00:00`).getFullYear();
  }
  return year || '';
}

function ScorePips({ label, score }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-[0.18em] text-ink/55">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            key={`${label}-${index}`}
            className={`h-2.5 w-2.5 rounded-full ${index < score ? 'bg-ink' : 'bg-ink/12'}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function Content() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [selectedSports, setSelectedSports] = useState([]);
  const [expandedSummaries, setExpandedSummaries] = useState({});
  const [visibleCount, setVisibleCount] = useState(50);

  const navLinks = [
    { href: '/dashboard', label: 'UltraOS Home' },
    { href: '/connections', label: 'Connections' },
    { href: '/log-intervention', label: 'Log Intervention' },
    { href: '/history', label: 'Intervention History' },
    { href: '/settings', label: 'Settings' },
    { href: '/content', label: 'Content' },
    { href: '/content/admin', label: 'Content Admin' },
    { href: '/', label: 'Landing Page' },
  ];

  useEffect(() => {
    async function loadEntries() {
      try {
        const res = await fetch('/api/research-library');
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadEntries();
  }, []);

  // Client-side search is intentional while the library stays small.
  // Switch this to Supabase full-text search once the published set moves beyond ~200 entries.
  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesQuery =
        !normalizedQuery ||
        [entry.title, entry.plain_english_summary, entry.practical_takeaway]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(normalizedQuery));

      const entryTags = entry.topic_tags || [];
      const matchesTags =
        selectedTopics.length === 0 ||
        selectedTopics.every((selectedTopic) => entryTags.includes(selectedTopic));

      const matchesSports =
        selectedSports.length === 0 ||
        selectedSports.some((sportKey) => Number(entry[sportKey] || 0) >= 4);

      return matchesQuery && matchesTags && matchesSports;
    });
  }, [entries, query, selectedTopics, selectedSports]);

  const visibleEntries = filteredEntries.slice(0, visibleCount);
  const isZeroState = !loading && entries.length === 0;
  const isEmptyState = !loading && entries.length > 0 && filteredEntries.length === 0;

  function toggleTopic(topic) {
    setVisibleCount(50);
    setSelectedTopics((current) =>
      current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic]
    );
  }

  function toggleSport(sportKey) {
    setVisibleCount(50);
    setSelectedSports((current) =>
      current.includes(sportKey) ? current.filter((item) => item !== sportKey) : [...current, sportKey]
    );
  }

  function clearFilters() {
    setQuery('');
    setSelectedTopics([]);
    setSelectedSports([]);
    setVisibleCount(50);
  }

  function toggleSummary(id) {
    setExpandedSummaries((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Research Library</p>
          </div>
          <NavMenu
            label="Content navigation"
            links={navLinks}
            primaryLink={{ href: '/dashboard', label: 'UltraOS Home' }}
          />
        </div>

        <DashboardTabs activeHref="/content" />

        <div className="mb-8 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <h1 className="font-display text-5xl leading-tight md:text-7xl">Research Library</h1>
          <p className="mt-6 max-w-4xl text-base leading-8 text-ink/82 md:text-lg">
            Every study in this library has been read, summarized, and rated for relevance to long-endurance athletes. No paywalls. No academic jargon. Each entry links to the original paper on PubMed so you can go deeper if you want to. We add new studies as they&apos;re published - the ones that actually matter for how you prepare.
          </p>
        </div>

        <section className="mb-8 rounded-[30px] border border-ink/10 bg-white p-5 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(50);
              }}
              placeholder="Search studies"
              className="w-full rounded-full border border-ink/10 bg-paper px-5 py-4 text-base text-ink outline-none transition focus:border-ink/30"
            />

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-semibold text-ink/65 underline underline-offset-4"
              >
                Clear all filters
              </button>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-accent">Topics</p>
            <div className="flex flex-wrap gap-2">
              {topicOptions.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                    selectedTopics.includes(topic)
                      ? 'bg-ink text-paper'
                      : 'border border-ink/10 bg-paper text-ink'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-accent">Sport</p>
            <div className="flex flex-wrap gap-2">
              {sportOptions.map((sport) => (
                <button
                  key={sport.key}
                  type="button"
                  onClick={() => toggleSport(sport.key)}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                    selectedSports.includes(sport.key)
                      ? 'bg-ink text-paper'
                      : 'border border-ink/10 bg-paper text-ink'
                  }`}
                >
                  {sport.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 text-sm text-ink/65">
            Loading library...
          </div>
        ) : null}

        {isZeroState ? (
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 text-sm text-ink/72 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            The library is being built. First studies drop with the next research digest.
          </div>
        ) : null}

        {isEmptyState ? (
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 text-sm text-ink/72 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            No studies match those filters yet. We add new research monthly - check back after the next digest drops.
          </div>
        ) : null}

        {!loading && !isZeroState && !isEmptyState ? (
          <section className="grid gap-4">
            {visibleEntries.map((entry) => {
              const isExpanded = Boolean(expandedSummaries[entry.id]);
              return (
                <article
                  key={entry.id}
                  className="rounded-[30px] border border-ink/10 bg-white p-5 shadow-[0_18px_40px_rgba(19,24,22,0.06)]"
                >
                  <a
                    href={entry.pubmed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xl font-semibold leading-tight text-ink transition hover:text-ink/70 md:text-3xl"
                  >
                    {entry.title}
                  </a>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(entry.topic_tags || []).map((tag) => (
                      <span key={tag} className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-ink">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4">
                    <ScorePips label="Ultra" score={entry.ultra_score || 0} />
                    <ScorePips label="Gravel" score={entry.gravel_score || 0} />
                    <ScorePips label="Triathlon" score={entry.triathlon_score || 0} />
                  </div>

                  <div className="mt-4">
                    <p className={`text-sm leading-7 text-ink/78 ${clampClass(isExpanded)}`}>
                      {entry.plain_english_summary || 'Summary coming soon.'}
                    </p>
                    {entry.plain_english_summary ? (
                      <button
                        type="button"
                        onClick={() => toggleSummary(entry.id)}
                        className="mt-2 text-sm font-semibold text-ink/70 underline underline-offset-4"
                      >
                        {isExpanded ? 'Show less' : 'Expand'}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-[22px] border-l-4 border-accent bg-paper px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-accent">Practical Takeaway</p>
                    <p className="mt-2 text-sm leading-7 text-ink/82">
                      {entry.practical_takeaway || 'Practical takeaway coming soon.'}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <a
                      href={entry.pubmed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-ink underline underline-offset-4"
                    >
                      Read the study →
                    </a>
                    <p className="text-xs text-ink/52">
                      {entry.authors || 'Authors pending'} {entry.authors ? '•' : ''} {formatDate(entry.publication_year, entry.publication_date)}
                    </p>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {!loading && filteredEntries.length > visibleCount ? (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((current) => current + 50)}
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper"
            >
              Load more
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
