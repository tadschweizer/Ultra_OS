import { useEffect, useMemo, useState } from 'react';
import NavMenu from '../../components/NavMenu';
import DashboardTabs from '../../components/DashboardTabs';

const controlledTopicOptions = [
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

const emptyForm = {
  id: '',
  pubmed_id: '',
  title: '',
  authors: '',
  journal: '',
  publication_year: '',
  publication_date: '',
  pubmed_url: '',
  topic_tags: [],
  plain_english_summary: '',
  practical_takeaway: '',
  commentary: '',
  ultra_score: 0,
  gravel_score: 0,
  triathlon_score: 0,
  published: false,
};

function fieldClassName() {
  return 'w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink';
}

function normalizeEntryToForm(entry) {
  return {
    id: entry.id || '',
    pubmed_id: entry.pubmed_id || '',
    title: entry.title || '',
    authors: entry.authors || '',
    journal: entry.journal || '',
    publication_year: entry.publication_year || '',
    publication_date: entry.publication_date || '',
    pubmed_url: entry.pubmed_url || '',
    topic_tags: entry.topic_tags || [],
    plain_english_summary: entry.plain_english_summary || '',
    practical_takeaway: entry.practical_takeaway || '',
    commentary: entry.commentary || '',
    ultra_score: entry.ultra_score ?? 0,
    gravel_score: entry.gravel_score ?? 0,
    triathlon_score: entry.triathlon_score ?? 0,
    published: Boolean(entry.published),
  };
}

export default function ContentAdmin() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const navLinks = [
    { href: '/dashboard', label: 'UltraOS Home' },
    { href: '/connections', label: 'Connections' },
    { href: '/log-intervention', label: 'Log Intervention' },
    { href: '/history', label: 'Intervention History' },
    { href: '/settings', label: 'Athlete Settings' },
    { href: '/account', label: 'Account Settings' },
    { href: '/content', label: 'Content' },
    { href: '/content/admin', label: 'Content Admin' },
    { href: '/', label: 'Landing Page' },
  ];

  useEffect(() => {
    async function loadEntries() {
      try {
        const res = await fetch('/api/research-library/admin');
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

  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => {
        const dateA = new Date(a.publication_date || a.inserted_at || 0).getTime();
        const dateB = new Date(b.publication_date || b.inserted_at || 0).getTime();
        return dateB - dateA;
      }),
    [entries]
  );

  function setFormValue(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleTopic(topic) {
    setForm((current) => ({
      ...current,
      topic_tags: current.topic_tags.includes(topic)
        ? current.topic_tags.filter((item) => item !== topic)
        : [...current.topic_tags, topic],
    }));
  }

  function selectSearchResult(result) {
    setForm((current) => ({
      ...current,
      pubmed_id: result.pubmed_id || '',
      title: result.title || '',
      authors: result.authors || '',
      journal: result.journal || '',
      publication_year: result.publication_year || '',
      publication_date: result.publication_date || '',
      pubmed_url: result.pubmed_url || '',
      published: false,
    }));
    setMessage('PubMed metadata loaded. Published remains off by default.');
  }

  async function handleSearch(event) {
    event.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setMessage('');

    try {
      const res = await fetch(`/api/research-library/pubmed-search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Error: ${data.error}`);
        return;
      }
      setSearchResults(data.studies || []);
    } catch (error) {
      console.error(error);
      setMessage('Error: PubMed search failed.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    const method = form.id ? 'PUT' : 'POST';

    try {
      const res = await fetch('/api/research-library/admin', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(`Error: ${data.error}`);
        return;
      }

      const nextEntry = data.entry;
      setEntries((current) => {
        const withoutCurrent = current.filter((item) => item.id !== nextEntry.id);
        return [nextEntry, ...withoutCurrent];
      });
      setForm(normalizeEntryToForm(nextEntry));
      setMessage(nextEntry.published ? 'Entry saved and published.' : 'Entry saved as unpublished draft.');
    } catch (error) {
      console.error(error);
      setMessage('Error: Failed to save entry.');
    }
  }

  async function handleDraftGeneration() {
    setDrafting(true);
    setMessage('');

    try {
      const res = await fetch('/api/research-library/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(`Error: ${data.error}`);
        return;
      }

      setForm((current) => ({
        ...current,
        plain_english_summary: data.draft.plain_english_summary,
        practical_takeaway: data.draft.practical_takeaway,
        commentary: data.draft.commentary,
      }));
      setMessage('Draft copy generated. Review before publishing.');
    } catch (error) {
      console.error(error);
      setMessage('Error: Failed to generate draft copy.');
    } finally {
      setDrafting(false);
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm('Delete this library entry?');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/research-library/admin?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Error: ${data.error}`);
        return;
      }
      setEntries((current) => current.filter((item) => item.id !== id));
      if (form.id === id) {
        setForm(emptyForm);
      }
      setMessage('Entry deleted.');
    } catch (error) {
      console.error(error);
      setMessage('Error: Failed to delete entry.');
    }
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Content Admin</p>
          </div>
          <NavMenu
            label="Content admin navigation"
            links={navLinks}
            primaryLink={{ href: '/content', label: 'Research Library', variant: 'secondary' }}
          />
        </div>

        <DashboardTabs activeHref="/content" />

        <div className="mb-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Import From PubMed</p>
            <form onSubmit={handleSearch} className="mt-4 space-y-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search PubMed"
                className={fieldClassName()}
              />
              <button type="submit" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper">
                {searching ? 'Searching...' : 'Search PubMed'}
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {searchResults.map((result) => (
                <button
                  key={result.pubmed_id}
                  type="button"
                  onClick={() => selectSearchResult(result)}
                  className="w-full rounded-[22px] bg-paper p-4 text-left"
                >
                  <p className="font-semibold text-ink">{result.title}</p>
                  <p className="mt-2 text-xs text-ink/55">
                    {result.authors || 'Authors unavailable'} • {result.publication_year || 'Year unavailable'}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <form onSubmit={handleSubmit} className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            {message ? <p className="mb-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-ink">{message}</p> : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-ink">Title</label>
                <input type="text" value={form.title} onChange={(event) => setFormValue('title', event.target.value)} className={fieldClassName()} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">PubMed ID</label>
                <input type="text" value={form.pubmed_id} onChange={(event) => setFormValue('pubmed_id', event.target.value)} className={fieldClassName()} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">PubMed URL</label>
                <input type="text" value={form.pubmed_url} onChange={(event) => setFormValue('pubmed_url', event.target.value)} className={fieldClassName()} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-ink">Authors</label>
                <input type="text" value={form.authors} onChange={(event) => setFormValue('authors', event.target.value)} className={fieldClassName()} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">Journal</label>
                <input type="text" value={form.journal} onChange={(event) => setFormValue('journal', event.target.value)} className={fieldClassName()} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Year</label>
                  <input type="number" value={form.publication_year} onChange={(event) => setFormValue('publication_year', event.target.value)} className={fieldClassName()} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Date</label>
                  <input type="date" value={form.publication_date} onChange={(event) => setFormValue('publication_date', event.target.value)} className={fieldClassName()} />
                </div>
              </div>
              <div className="md:col-span-2">
                <p className="mb-2 text-sm font-semibold text-ink">Topic Tags</p>
                <div className="flex flex-wrap gap-2">
                  {controlledTopicOptions.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        form.topic_tags.includes(topic)
                          ? 'bg-ink text-paper'
                          : 'border border-ink/10 bg-paper text-ink'
                      }`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-ink">Plain-English Summary</label>
                <textarea value={form.plain_english_summary} onChange={(event) => setFormValue('plain_english_summary', event.target.value)} rows={4} className={fieldClassName()} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-ink">Practical Takeaway</label>
                <textarea value={form.practical_takeaway} onChange={(event) => setFormValue('practical_takeaway', event.target.value)} rows={3} className={fieldClassName()} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-ink">Commentary</label>
                <textarea value={form.commentary} onChange={(event) => setFormValue('commentary', event.target.value)} rows={3} className={fieldClassName()} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3 md:col-span-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Running Score</label>
                  <input type="number" min="0" max="5" value={form.ultra_score} onChange={(event) => setFormValue('ultra_score', event.target.value)} className={fieldClassName()} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Gravel Score</label>
                  <input type="number" min="0" max="5" value={form.gravel_score} onChange={(event) => setFormValue('gravel_score', event.target.value)} className={fieldClassName()} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Triathlon Score</label>
                  <input type="number" min="0" max="5" value={form.triathlon_score} onChange={(event) => setFormValue('triathlon_score', event.target.value)} className={fieldClassName()} />
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm font-semibold text-ink md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(event) => setFormValue('published', event.target.checked)}
                  className="h-4 w-4 rounded border-ink/20"
                />
                Published
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper">
                {form.id ? 'Update Entry' : 'Create Entry'}
              </button>
              <button type="button" onClick={handleDraftGeneration} className="rounded-full border border-ink/10 px-5 py-3 text-sm font-semibold text-ink">
                {drafting ? 'Generating Draft...' : 'Generate Draft'}
              </button>
              <button type="button" onClick={() => setForm(emptyForm)} className="rounded-full border border-ink/10 px-5 py-3 text-sm font-semibold text-ink">
                New Draft
              </button>
            </div>
          </form>
        </div>

        <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">Library Entries</p>
          {loading ? (
            <p className="mt-4 text-sm text-ink/65">Loading...</p>
          ) : (
            <div className="mt-5 grid gap-3">
              {sortedEntries.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-3 rounded-[22px] bg-paper p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-ink">{entry.title}</p>
                    <p className="mt-1 text-xs text-ink/55">
                      {entry.authors || 'Authors pending'} • {entry.publication_year || 'Year pending'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.published ? 'bg-ink text-paper' : 'bg-white text-ink/65'}`}>
                      {entry.published ? 'Published' : 'Draft'}
                    </span>
                    <button type="button" onClick={() => setForm(normalizeEntryToForm(entry))} className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink">
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(entry.id)} className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
