import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import NavMenu from '../components/NavMenu';
import RaceSearchInput from '../components/RaceSearchInput';

const RACE_TYPES = ['1 Mile / 1500m', '3K / 5K', '10K', 'Half Marathon', 'Marathon', '50K+', 'Gravel', 'Triathlon', 'Other'];

const PRIORITY_STYLE = {
  A: 'border-red-200 bg-red-50 text-red-700',
  B: 'border-amber-200 bg-amber-50 text-amber-700',
  C: 'border-blue-200 bg-blue-50 text-blue-700',
};

const SPORT_TO_RACE_TYPE = {
  'Ultrarunning': '50K+',
  'Marathon': 'Marathon',
  'Half Marathon': 'Half Marathon',
  '10K': '10K',
  '5K': '3K / 5K',
  'Mile': '1 Mile / 1500m',
  'Gravel Cycling': 'Gravel',
  'Road Cycling': 'Gravel',
  'Long-Course Triathlon': 'Triathlon',
  'Olympic Triathlon': 'Triathlon',
  'Sprint Triathlon': 'Triathlon',
  'XTERRA Triathlon': 'Triathlon',
};

function mapRaceType(sportType) {
  return SPORT_TO_RACE_TYPE[sportType] || 'Other';
}

function formatDate(dateStr) {
  if (!dateStr) return 'Date TBD';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr + 'T00:00:00').setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  const d = Math.round(diff / (1000 * 60 * 60 * 24));
  return d >= 0 ? d : null;
}

function sortByDate(a, b) {
  if (!a.event_date) return 1;
  if (!b.event_date) return -1;
  return a.event_date.localeCompare(b.event_date);
}

const emptyForm = {
  name: '', event_date: '', race_type: 'Other', distance_miles: '',
  location: '', priority: 'B', url: '', source: 'manual', catalog_id: null,
  elevation_gain_ft: '', terrain: '',
};

export default function RacesPage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/race-plan', label: 'Race Blueprint' },
    { href: '/log-intervention', label: 'Log Intervention' },
  ];

  useEffect(() => {
    fetch('/api/race-events')
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((data) => { setEvents(data.events || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function handleRaceSelect(race) {
    setForm({
      name: race.name || '',
      event_date: race.event_date || '',
      race_type: mapRaceType(race.race_type),
      distance_miles: race.distance_miles ? String(race.distance_miles) : '',
      location: race.location || '',
      priority: 'B',
      url: race.url || '',
      source: race.source || 'manual',
      catalog_id: race.catalog_id || null,
      elevation_gain_ft: race.elevation_gain_ft ? String(race.elevation_gain_ft) : '',
      terrain: race.terrain || '',
    });
    setShowForm(true);
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/race-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          distance_miles: form.distance_miles ? parseFloat(form.distance_miles) : null,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setEvents((prev) => [...prev, data.event].sort(sortByDate));
      setShowForm(false);
      setForm(emptyForm);
      setSearchQuery('');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setShowForm(false);
    setForm(emptyForm);
    setSearchQuery('');
  }

  async function handleSetGoal(id) {
    const res = await fetch(`/api/race-events?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_goal_race: true }),
    });
    if (!res.ok) return;
    setEvents((prev) => prev.map((e) => ({ ...e, is_goal_race: e.id === id })));
  }

  async function handlePriority(id, priority) {
    const res = await fetch(`/api/race-events?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority }),
    });
    if (!res.ok) return;
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, priority } : e)));
  }

  async function handleDelete(id) {
    const res = await fetch(`/api/race-events?id=${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function handleBlueprint(event) {
    try {
      localStorage.setItem('ultraos-default-race', JSON.stringify({
        target_race: event.name,
        target_race_date: event.event_date,
        race_type: event.race_type,
        race_profile: event,
      }));
    } catch (_) {}
    router.push('/race-plan');
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Race Calendar</p>
          <NavMenu
            label="Races navigation"
            links={navLinks}
            primaryLink={{ href: '/race-plan', label: 'Blueprint', variant: 'secondary' }}
          />
        </div>

        {/* Hero */}
        <section className="overflow-hidden rounded-[28px] border border-ink/10 bg-white p-6 shadow-warm md:p-10">
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Season Planning</p>
          <h1 className="font-display mt-4 text-4xl leading-tight md:text-6xl">Your race season.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-ink/70">
            Build your season calendar. Set A, B, and C priority races, mark your goal event, and jump straight to the Blueprint from any card.
          </p>
        </section>

        {/* Add Race */}
        <section className="mt-8 rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
          <p className="text-xs uppercase tracking-[0.28em] text-accent">Add a Race</p>

          <div className="mt-4">
            <RaceSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              onSelect={handleRaceSelect}
              placeholder="Search races — e.g. Western States, IRONMAN Florida…"
            />
            <p className="mt-2 text-xs text-ink/40">
              Searches the catalog first. Finds on the web when catalog results are sparse.
            </p>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-[22px] border border-ink/8 bg-paper p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Confirm details</p>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">Race name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                  className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Race date</label>
                  <input
                    type="date"
                    name="event_date"
                    value={form.event_date}
                    onChange={handleFormChange}
                    className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Distance (mi)</label>
                  <input
                    type="number"
                    name="distance_miles"
                    step="0.1"
                    value={form.distance_miles}
                    onChange={handleFormChange}
                    placeholder="e.g. 100"
                    className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Location</label>
                  <input
                    type="text"
                    name="location"
                    value={form.location}
                    onChange={handleFormChange}
                    placeholder="e.g. Squaw Valley, CA"
                    className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Race type</label>
                  <select
                    name="race_type"
                    value={form.race_type}
                    onChange={handleFormChange}
                    className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    {RACE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-ink">Priority</label>
                <div className="flex gap-2">
                  {[
                    { p: 'A', label: 'A Race', sub: 'goal race' },
                    { p: 'B', label: 'B Race', sub: 'strong effort' },
                    { p: 'C', label: 'C Race', sub: 'training race' },
                  ].map(({ p, label, sub }) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, priority: p }))}
                      className={`flex-1 rounded-2xl border py-2 text-center text-xs font-semibold transition ${
                        form.priority === p ? PRIORITY_STYLE[p] : 'border-ink/10 bg-white text-ink/40'
                      }`}
                    >
                      <span className="block">{label}</span>
                      <span className="block font-normal opacity-70">{sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper disabled:opacity-40"
                >
                  {saving ? 'Adding…' : 'Add to calendar'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-full border border-ink/10 px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {!showForm && (
            <button
              type="button"
              onClick={() => { setShowForm(true); setForm(emptyForm); }}
              className="mt-4 text-sm font-semibold text-accent"
            >
              + Add manually
            </button>
          )}
        </section>

        {/* Calendar */}
        <section className="mt-8">
          <p className="mb-4 text-xs uppercase tracking-[0.28em] text-accent">
            Your Race Calendar
            {events.length > 0 && (
              <span className="ml-2 rounded-full bg-ink/8 px-2 py-0.5 text-[10px] font-semibold text-ink/50">
                {events.length}
              </span>
            )}
          </p>

          {loading ? (
            <div className="rounded-[28px] border border-ink/10 bg-white p-10 text-center">
              <p className="text-sm text-ink/40">Loading…</p>
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-ink/15 bg-white/40 p-10 text-center">
              <p className="text-2xl">🗓</p>
              <p className="mt-3 font-semibold text-ink">No races on your calendar yet</p>
              <p className="mt-2 text-sm leading-6 text-ink/50">
                Search above to add your first event. You can add as many races as you want.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const days = daysUntil(event.event_date);
                return (
                  <div
                    key={event.id}
                    className={`rounded-[24px] border bg-white p-5 shadow-[0_4px_16px_rgba(19,24,22,0.05)] ${
                      event.is_goal_race ? 'border-accent/30' : 'border-ink/10'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      {/* Left: name + metadata */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-ink">{event.name}</p>
                          {event.is_goal_race && (
                            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                              Goal Race
                            </span>
                          )}
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_STYLE[event.priority] || PRIORITY_STYLE.B}`}>
                            {event.priority} Race
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink/55">
                          <span>{formatDate(event.event_date)}</span>
                          {days !== null && (
                            <span className="font-semibold text-accent">
                              {days === 0 ? 'Race day!' : `${days}d out`}
                            </span>
                          )}
                          {event.location && <span>{event.location}</span>}
                          {event.distance_miles && <span>{event.distance_miles} mi</span>}
                          {event.race_type && <span>{event.race_type}</span>}
                        </div>
                        {event.url && (
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 block text-xs text-accent underline"
                          >
                            Race website ↗
                          </a>
                        )}
                      </div>

                      {/* Right: controls */}
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {/* Priority toggle */}
                        {['A', 'B', 'C'].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handlePriority(event.id, p)}
                            title={`Mark as ${p} race`}
                            className={`h-6 w-6 rounded-full text-xs font-bold transition ${
                              event.priority === p
                                ? p === 'A' ? 'bg-red-100 text-red-700'
                                : p === 'B' ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                                : 'bg-ink/6 text-ink/35 hover:bg-ink/12'
                            }`}
                          >
                            {p}
                          </button>
                        ))}

                        {!event.is_goal_race && (
                          <button
                            type="button"
                            onClick={() => handleSetGoal(event.id)}
                            className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink transition hover:bg-paper"
                          >
                            Set goal
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleBlueprint(event)}
                          className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                        >
                          Blueprint →
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(event.id)}
                          className="rounded-full border border-red-100 px-3 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
