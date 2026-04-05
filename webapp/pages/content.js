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
  'Carbohydrate Loading',
  'HRV',
  'Recovery',
  'Running Economy',
  'Lactate Threshold',
  'VO2max',
  'Strength Training',
  'Pacing',
  'Hydration',
  'Taper',
  'Injury Prevention',
];

const sportOptions = [
  { key: 'ultra_score', label: 'Running' },
  { key: 'gravel_score', label: 'Gravel' },
  { key: 'triathlon_score', label: 'Triathlon' },
];

const suggestedSearches = [
  'running economy heat acclimation',
  'marathon carbohydrate intake performance',
  'middle distance sodium bicarbonate',
  'sleep restriction endurance performance',
  '10k strength training performance',
  'half marathon hydration strategy',
];

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

function SummaryBlock({ entry, isExpanded, onToggle }) {
  const summary = entry.plain_english_summary || 'Summary unavailable.';
  const firstSentenceMatch = summary.match(/.+?[.!?](\s|$)/);
  const collapsedSummary = firstSentenceMatch ? firstSentenceMatch[0].trim() : summary;
  const canToggle = summary.length > collapsedSummary.length + 20;

  return (
    <div className="mt-4">
      <p className="text-sm leading-7 text-ink/78">{isExpanded ? summary : collapsedSummary}</p>
      {canToggle ? (
        <button
          type="button"
          onClick={() => onToggle(entry.id)}
          className="mt-3 text-sm font-semibold text-ink/70 underline underline-offset-4"
        >
          {isExpanded ? 'Show less' : 'Expand'}
        </button>
      ) : null}
    </div>
  );
}

const SAVED_KEY = 'ultraos-saved-research';

export default function Content() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [selectedSports, setSelectedSports] = useState([]);
  const [expandedSummaries, setExpandedSummaries] = useState({});
  const [visibleCount, setVisibleCount] = useState(50);
  const [pubmedQuery, setPubmedQuery] = useState('');
  const [pubmedResults, setPubmedResults] = useState([]);
  const [pubmedLoading, setPubmedLoading] = useState(false);
  const [pubmedMessage, setPubmedMessage] = useState('');
  const [savedIds, setSavedIds] = useState([]);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'saved'

  const navLinks = [
    { href: '/dashboard', label: 'Threshold Home' },
    { href: '/guide', label: 'Guide' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/connections', label: 'Connections' },
    { href: '/log-intervention', label: 'Log Intervention' },
    { href: '/history', label: 'Intervention History' },
    { href: '/settings', label: 'Athlete Settings' },
    { href: '/account', label: 'Account Settings' },
    { href: '/content', label: 'Content' },
    { href: '/content/admin', label: 'Content Admin' },
    { href: '/', label: 'Landing Page' },
  ];

  // Load saved IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_KEY);
      if (stored) setSavedIds(JSON.parse(stored));
    } catch (_) {}
  }, []);

  function toggleSave(id) {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  }

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

  const displayEntries = viewMode === 'saved'
    ? filteredEntries.filter((e) => savedIds.includes(e.id))
    : filteredEntries;

  const visibleEntries = displayEntries.slice(0, visibleCount);
  const isZeroState = !loading && entries.length === 0;
  const isEmptyState = !loading && entries.length > 0 && displayEntries.length === 0;

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

  async function searchPubMed(queryToRun) {
    const trimmedQuery = queryToRun.trim();
    if (!trimmedQuery) return;

    setPubmedLoading(true);
    setPubmedMessage('');

    try {
      const res = await fetch(`/api/research-library/pubmed-search?q=${encodeURIComponent(trimmedQuery)}&retmax=18`);
      const data = await res.json();
      if (!res.ok) {
        setPubmedMessage(data.error || 'PubMed search failed.');
        return;
      }
      setPubmedResults(data.studies || []);
      if (!data.studies?.length) {
        setPubmedMessage('No PubMed studies matched that search.');
      }
    } catch (error) {
      console.error(error);
      setPubmedMessage('PubMed search failed.');
    } finally {
      setPubmedLoading(false);
    }
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
            primaryLink={{ href: '/dashboard', label: 'Threshold Home' }}
          />
        </div>

        <DashboardTabs activeHref="/content" />

        <div className="mb-8 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <h1 className="font-display text-5xl leading-tight md:text-7xl">Research Library</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-ink/78 md:text-lg">
            Browse curated studies for running from the mile through marathon+, plus gravel and triathlon. If the library does not have enough yet, search PubMed live below.
          </p>
          {/* View mode tabs */}
          <div className="mt-6 inline-flex rounded-full border border-ink/10 bg-white/60 p-1 backdrop-blur">
            <button
              type="button"
              onClick={() => { setViewMode('all'); setVisibleCount(50); }}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${viewMode === 'all' ? 'bg-ink text-paper shadow-sm' : 'text-ink/60'}`}
            >
              All {!loading && entries.length > 0 ? `(${filteredEntries.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('saved'); setVisibleCount(50); }}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${viewMode === 'saved' ? 'bg-ink text-paper shadow-sm' : 'text-ink/60'}`}
            >
              Saved {savedIds.length > 0 ? `(${savedIds.length})` : ''}
            </button>
          </div>
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

        <section className="mb-8 rounded-[30px] border border-ink/10 bg-white p-5 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Live PubMed Search</p>
            <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">Searches are not saved</span>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              searchPubMed(pubmedQuery);
            }}
            className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]"
          >
            <input
              type="text"
              value={pubmedQuery}
              onChange={(event) => setPubmedQuery(event.target.value)}
              placeholder="Search PubMed for a topic, sport, or intervention"
              className="w-full rounded-full border border-ink/10 bg-paper px-5 py-4 text-base text-ink outline-none transition focus:border-ink/30"
            />
            <button type="submit" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper">
              {pubmedLoading ? 'Searching...' : 'Search PubMed'}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {suggestedSearches.map((queryItem) => (
              <button
                key={queryItem}
                type="button"
                onClick={() => {
                  setPubmedQuery(queryItem);
                  searchPubMed(queryItem);
                }}
                className="rounded-full border border-ink/10 bg-paper px-4 py-2 text-sm font-semibold text-ink"
              >
                {queryItem}
              </button>
            ))}
          </div>

          {pubmedMessage ? (
            <div className="mt-5 rounded-[22px] bg-paper px-4 py-4 text-sm text-ink/76">{pubmedMessage}</div>
          ) : null}

          {pubmedResults.length ? (
            <div className="mt-5 grid gap-3">
              {pubmedResults.map((result) => (
                <article key={result.pubmed_id} className="rounded-[24px] border border-ink/10 bg-paper p-4">
                  <a
                    href={result.pubmed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-semibold leading-tight text-ink transition hover:text-ink/70"
                  >
                    {result.title}
                  </a>
                  <p className="mt-2 text-sm text-ink/60">
                    {result.authors || 'Authors unavailable'} {result.publication_year ? `• ${result.publication_year}` : ''}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        {loading ? (
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 text-sm text-ink/65">
            Loading library...
          </div>
        ) : null}

        {isZeroState ? (
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 text-sm text-ink/72 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            No studies are available yet.
          </div>
        ) : null}

        {isEmptyState && viewMode === 'saved' ? (
          <div className="rounded-[30px] border border-ink/10 bg-white p-8 text-center shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-2xl">🔖</p>
            <p className="mt-3 font-semibold text-ink">No saved studies yet.</p>
            <p className="mt-2 text-sm leading-6 text-ink/55">Browse the library and tap Save on any study to bookmark it here.</p>
            <button type="button" onClick={() => setViewMode('all')} className="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">
              Browse all studies
            </button>
          </div>
        ) : isEmptyState ? (
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 text-sm text-ink/72 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            No studies match those filters yet. We add new research monthly — check back after the next digest drops.
          </div>
        ) : null}

        {!loading && !isZeroState && !isEmptyState ? (
          <section className="grid gap-4">
            {visibleEntries.map((entry) => {
              const isExpanded = Boolean(expandedSummaries[entry.id]);
              const isNew = entry.created_at
                ? (Date.now() - new Date(entry.created_at).getTime()) < 30 * 24 * 60 * 60 * 1000
                : false;

              return (
                <article
                  key={entry.id}
                  className="rounded-[30px] border border-ink/10 bg-white p-5 shadow-[0_18px_40px_rgba(19,24,22,0.06)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <a
                      href={entry.pubmed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-2xl font-semibold leading-tight text-ink transition hover:text-ink/70 md:text-3xl"
                    >
                      {entry.title}
                    </a>
                    {isNew ? (
                      <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-panel">New</span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(entry.topic_tags || []).map((tag) => (
                      <span key={tag} className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-ink">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <ScorePips label="Running" score={entry.ultra_score || 0} />
                    <ScorePips label="Gravel" score={entry.gravel_score || 0} />
                    <ScorePips label="Triathlon" score={entry.triathlon_score || 0} />
                    <span
                      className="text-xs text-ink/35"
                      title="Relevance score 1–5: how strongly this study applies to each sport"
                    >
                      ⓘ relevance
                    </span>
                  </div>

                  <SummaryBlock entry={entry} isExpanded={isExpanded} onToggle={toggleSummary} />

                  <div className="mt-4 rounded-[22px] border-l-4 border-accent bg-paper px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-accent">Practical Takeaway</p>
                    <p className="mt-2 text-sm leading-7 text-ink/82">
                      {entry.practical_takeaway || 'Practical takeaway unavailable.'}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <a
                        href={entry.pubmed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-ink underline underline-offset-4"
                      >
                        Read the study →
                      </a>
                      <button
                        type="button"
                        onClick={() => toggleSave(entry.id)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition
                          ${savedIds.includes(entry.id)
                            ? 'bg-accent/15 text-amber-800'
                            : 'border border-ink/10 bg-paper text-ink/50 hover:text-ink'
                          }`}
                        title={savedIds.includes(entry.id) ? 'Remove from saved' : 'Save for later'}
                      >
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill={savedIds.includes(entry.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                        {savedIds.includes(entry.id) ? 'Saved' : 'Save'}
                      </button>
                    </div>
                    <p className="text-xs text-ink/52">
                      {entry.authors || 'Author information unavailable'} {entry.authors ? '•' : ''} {formatDate(entry.publication_year, entry.publication_date)}
                    </p>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {!loading && displayEntries.length > visibleCount ? (
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
