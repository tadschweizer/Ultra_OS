import { useEffect, useMemo, useState } from 'react';
import NavMenu from '../components/NavMenu';
import { getStoredValue } from '../lib/browserStorage';
import DashboardTabs from '../components/DashboardTabs';

const topicOptions = [
  'Heat Acclimation',
  'Gut Training',
  'Sodium Bicarbonate',
  'Caffeine',
  'Sleep',
  'Altitude',
  'Hydration',
  'Taper',
  'Strength Training',
  'Recovery',
  'HRV',
  'Running Economy',
  'Lactate Threshold',
  'VO2max',
  'Carbohydrate Loading',
  'Creatine',
  'Nitrates',
  'Beta-Alanine',
];

const SAVED_KEY = 'threshold-saved-research';
const LEGACY_SAVED_KEY = 'ultraos-saved-research';

function formatDate(year, publicationDate) {
  if (publicationDate) {
    return new Date(`${publicationDate}T12:00:00`).getFullYear();
  }
  return year || '';
}

function normalizePaperUrl(paper) {
  return paper.url || paper.pubmed_url || paper.primary_url || '#';
}

function ConfidenceBadge({ value }) {
  return (
    <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink/70">
      Confidence: {value || 'Early'}
    </span>
  );
}

function SummaryPanel({ summary, loading }) {
  if (loading && !summary) {
    return (
      <section className="rounded-[24px] border border-ink/10 bg-white p-5 shadow-warm">
        <div className="h-4 w-40 rounded-full ui-skeleton" />
        <div className="mt-5 h-10 w-3/4 rounded ui-skeleton" />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 rounded-[18px] ui-skeleton" />
          ))}
        </div>
      </section>
    );
  }

  if (!summary) return null;

  const blocks = [
    ['What most evidence agrees on', summary.agrees],
    ['What is uncertain or individual', summary.uncertain],
    ['Practical protocol', summary.protocol],
    ['When to avoid it', summary.avoid],
  ];

  return (
    <section className="overflow-hidden rounded-[24px] border border-ink/10 bg-white shadow-warm">
      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-panel p-6 text-text-dark md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/75">
              Research briefing
            </span>
            <ConfidenceBadge value={summary.confidence} />
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.22em] text-accent">Bottom line</p>
          <h2 className="mt-3 text-2xl font-semibold leading-tight md:text-3xl">
            {summary.topicLabel || 'Endurance research'}
          </h2>
          <p className="mt-5 text-base leading-8 text-white/82">{summary.bottomLine}</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/68">
            <span className="rounded-full bg-white/10 px-3 py-1">
              {summary.paperCount || 0} supporting papers
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1">
              {summary.source === 'database' ? 'Saved summary' : 'Pre-summary'}
            </span>
          </div>
        </div>

        <div className="grid gap-3 bg-surface-light p-5 md:grid-cols-2 md:p-6">
          {blocks.map(([label, body]) => (
            <article key={label} className="rounded-[18px] border border-ink/8 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-accent">{label}</p>
              <p className="mt-3 text-sm leading-7 text-ink/76">{body}</p>
            </article>
          ))}
          <article className="rounded-[18px] border border-accent/20 bg-accent/10 p-4 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Best fit</p>
            <p className="mt-3 text-sm leading-7 text-ink/82">{summary.bestFit}</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function PaperCard({ paper, saved, onToggleSave }) {
  const paperUrl = normalizePaperUrl(paper);
  return (
    <article className="rounded-[20px] border border-ink/10 bg-white p-5 shadow-warm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <a
          href={paperUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-3xl text-xl font-semibold leading-tight text-ink hover:text-ink/70"
        >
          {paper.title}
        </a>
        <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/60">
          {paper.source || 'research'}
        </span>
      </div>
      <p className="mt-3 text-sm leading-7 text-ink/68">
        {paper.plain_english_summary || paper.abstract || 'Metadata imported. Summary pending review.'}
      </p>
      {paper.practical_takeaway ? (
        <div className="mt-4 rounded-[16px] border-l-4 border-accent bg-paper px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-accent">Practical takeaway</p>
          <p className="mt-2 text-sm leading-6 text-ink/78">{paper.practical_takeaway}</p>
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink/52">
          {paper.authors || 'Authors unavailable'} {paper.authors ? '-' : ''}{' '}
          {formatDate(paper.publication_year, paper.publication_date)}
          {paper.citation_count ? ` - ${paper.citation_count} citations` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={paperUrl} target="_blank" rel="noopener noreferrer" className="ui-button-secondary py-2 text-xs">
            Open paper
          </a>
          {paper.id ? (
            <button
              type="button"
              onClick={() => onToggleSave(paper.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                saved ? 'bg-accent/15 text-amber-800' : 'border border-ink/10 bg-paper text-ink/60'
              }`}
            >
              {saved ? 'Saved' : 'Save'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function Content() {
  const [query, setQuery] = useState('heat acclimation');
  const [submittedQuery, setSubmittedQuery] = useState('heat acclimation');
  const [summary, setSummary] = useState(null);
  const [papers, setPapers] = useState([]);
  const [libraryEntries, setLibraryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [savedIds, setSavedIds] = useState([]);
  const [viewMode, setViewMode] = useState('briefing');

  const navLinks = [
    { href: '/dashboard', label: 'Threshold Home' },
    { href: '/guide', label: 'Guide' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/connections', label: 'Connections' },
    { href: '/log-intervention', label: 'Log Intervention' },
    { href: '/history', label: 'Intervention History' },
    { href: '/settings', label: 'Athlete Settings' },
    { href: '/account', label: 'Account Settings' },
    { href: '/content/admin', label: 'Content Admin' },
    { href: '/', label: 'Landing Page' },
  ];

  useEffect(() => {
    try {
      const stored = getStoredValue(SAVED_KEY, LEGACY_SAVED_KEY);
      if (stored) setSavedIds(JSON.parse(stored));
    } catch (_) {}
  }, []);

  function toggleSave(id) {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
        localStorage.removeItem(LEGACY_SAVED_KEY);
      } catch (_) {}
      return next;
    });
  }

  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      try {
        const [summaryRes, libraryRes] = await Promise.all([
          fetch('/api/research/topic-summary?q=heat%20acclimation'),
          fetch('/api/research-library'),
        ]);

        if (summaryRes.ok) {
          const data = await summaryRes.json();
          setSummary(data.summary || null);
          setPapers(data.papers || []);
        }

        if (libraryRes.ok) {
          const data = await libraryRes.json();
          setLibraryEntries(data.entries || []);
        }
      } catch (error) {
        console.error(error);
        setMessage('Research briefing failed to load.');
      } finally {
        setLoading(false);
      }
    }

    loadInitial();
  }, []);

  async function runSearch(nextQuery) {
    const trimmed = String(nextQuery || '').trim();
    if (!trimmed) return;

    setSearching(true);
    setMessage('');
    setSubmittedQuery(trimmed);

    try {
      const res = await fetch(`/api/research/search?q=${encodeURIComponent(trimmed)}&limit=18`);
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Research search failed.');
        return;
      }
      setSummary(data.summary || null);
      setPapers(data.papers || []);
      if (data.sourceErrors?.length) {
        setMessage(`Some source APIs were unavailable, but Threshold still found ${data.papers?.length || 0} papers.`);
      }
    } catch (error) {
      console.error(error);
      setMessage('Research search failed.');
    } finally {
      setSearching(false);
    }
  }

  const savedPapers = useMemo(() => {
    const combined = [...papers, ...libraryEntries];
    const seen = new Set();
    return combined.filter((paper) => {
      if (!savedIds.includes(paper.id) || seen.has(paper.id)) return false;
      seen.add(paper.id);
      return true;
    });
  }, [libraryEntries, papers, savedIds]);

  const supportingPapers = viewMode === 'saved' ? savedPapers : papers.length ? papers : libraryEntries.slice(0, 12);

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Research OS</p>
          </div>
          <NavMenu
            label="Content navigation"
            links={navLinks}
            primaryLink={{ href: '/dashboard', label: 'Threshold Home' }}
          />
        </div>

        <DashboardTabs activeHref="/content" />

        <section className="mb-6 rounded-[24px] border border-ink/10 bg-white p-5 shadow-warm md:p-6">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-accent">Consensus-style research</p>
              <h1 className="font-display mt-3 text-4xl leading-tight md:text-6xl">
                Ask for the answer, then inspect the papers.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/70 md:text-base">
                Threshold now treats research like an expert briefing: bottom line first, practical protocol next,
                supporting studies underneath. Citations stay out of the way unless you want to inspect sources.
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                runSearch(query);
              }}
              className="rounded-[20px] border border-ink/10 bg-surface-light p-4"
            >
              <label className="text-xs uppercase tracking-[0.2em] text-accent">Search a topic</label>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Try heat acclimation, gut training, caffeine..."
                  className="ui-input py-3"
                />
                <button type="submit" className="ui-button-primary">
                  {searching ? 'Searching...' : 'Get briefing'}
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {topicOptions.slice(0, 12).map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => {
                      setQuery(topic);
                      runSearch(topic);
                    }}
                    className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-ink/20"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </section>

        {message ? (
          <div className="mb-6 rounded-[18px] border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-ink/75">
            {message}
          </div>
        ) : null}

        <SummaryPanel summary={summary} loading={loading || searching} />

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-accent">Supporting studies</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                {viewMode === 'saved' ? 'Saved papers' : submittedQuery}
              </h2>
            </div>
            <div className="inline-flex rounded-full border border-ink/10 bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode('briefing')}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  viewMode === 'briefing' ? 'bg-ink text-paper' : 'text-ink/60'
                }`}
              >
                Current
              </button>
              <button
                type="button"
                onClick={() => setViewMode('saved')}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  viewMode === 'saved' ? 'bg-ink text-paper' : 'text-ink/60'
                }`}
              >
                Saved {savedIds.length ? `(${savedIds.length})` : ''}
              </button>
            </div>
          </div>

          {supportingPapers.length ? (
            <div className="grid gap-4">
              {supportingPapers.map((paper) => (
                <PaperCard
                  key={`${paper.source || 'paper'}-${paper.id || paper.pubmed_id || paper.title}`}
                  paper={paper}
                  saved={savedIds.includes(paper.id)}
                  onToggleSave={toggleSave}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] border border-ink/10 bg-white p-6 text-sm text-ink/70 shadow-warm">
              No saved papers yet. Search a topic, then save papers you want to revisit.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
