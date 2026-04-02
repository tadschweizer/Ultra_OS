import { useEffect, useMemo, useState } from 'react';
import DashboardTabs from '../components/DashboardTabs';
import NavMenu from '../components/NavMenu';
import EmptyStateCard from '../components/EmptyStateCard';
import UpgradePrompt from '../components/UpgradePrompt';
import { usePlan } from '../lib/planUtils';
import { defaultAssignmentWindow } from '../lib/coachProtocols';
import { interventionCatalog } from '../lib/interventionCatalog';

function statusTone(status) {
  if (status === 'Green') return 'bg-category-sleep/55 text-ink';
  if (status === 'Yellow') return 'bg-category-nutrition/70 text-ink';
  return 'bg-category-respiratory/55 text-ink';
}

function formatCountdown(daysUntilRace) {
  if (daysUntilRace === null || daysUntilRace === undefined) return 'Date needed';
  return `${daysUntilRace} days`;
}

const interventionTypes = interventionCatalog.flatMap((group) => group.types.map((type) => type.label));

export default function CoachesPage() {
  const { coachFeatures } = usePlan();
  const [profile, setProfile] = useState(null);
  const [roster, setRoster] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    athlete_id: '',
    intervention_type: 'Heat Acclimation',
    start_date: new Date().toISOString().slice(0, 10),
    target_completion_date: defaultAssignmentWindow(new Date().toISOString().slice(0, 10)) || '',
    frequency_type: 'weekly',
    planned_sessions: '',
    note: '',
  });

  const navLinks = [
    { href: '/', label: 'Landing Page' },
    { href: '/dashboard', label: 'Home' },
    { href: '/guide', label: 'Guide' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/explorer', label: 'Explorer' },
    { href: '/connections', label: 'Connections' },
    { href: '/log-intervention', label: 'Log Intervention' },
    { href: '/history', label: 'Intervention History' },
  ];

  useEffect(() => {
    async function load() {
      const [rosterRes, assignmentsRes] = await Promise.all([
        fetch('/api/coach-roster'),
        fetch('/api/coach-assignments'),
      ]);

      if (rosterRes.ok) {
        const rosterData = await rosterRes.json();
        setProfile(rosterData.profile || null);
        setRoster(rosterData.roster || []);
        setForm((current) => ({
          ...current,
          athlete_id: current.athlete_id || rosterData.roster?.[0]?.athlete_id || '',
        }));
      }

      if (assignmentsRes.ok) {
        const assignmentData = await assignmentsRes.json();
        setAssignments(assignmentData.assignments || []);
      }
    }

    if (coachFeatures) {
      load();
    }
  }, [coachFeatures]);

  const triageCards = useMemo(
    () =>
      [...roster]
        .filter((item) => item.status !== 'Green' || item.activeAssignment)
        .sort((a, b) => {
          const urgencyOrder = { Red: 0, Yellow: 1, Green: 2 };
          return urgencyOrder[a.status] - urgencyOrder[b.status];
        }),
    [roster]
  );

  const selectedAthlete = roster.find((item) => item.athlete_id === form.athlete_id) || null;

  async function handleAssignProtocol(event) {
    event.preventDefault();
    setMessage('');

    const res = await fetch('/api/coach-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        target_race_id: selectedAthlete?.nextRace?.id || null,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || 'Unable to assign protocol.');
      return;
    }

    setAssignments((current) => [
      ...current,
      {
        ...data.assignment,
        athlete: selectedAthlete?.athlete || null,
        completion_count: 0,
      },
    ]);
    setMessage('Protocol assigned.');
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold Coach Dashboard</p>
          </div>
          <NavMenu
            label="Coach page navigation"
            links={navLinks}
            primaryLink={{ href: '/dashboard', label: 'Home', variant: 'secondary' }}
          />
        </div>

        <DashboardTabs activeHref="/coaches" tabs={[{ href: '/coaches', label: 'Coaches' }]} />

        {!coachFeatures ? (
          <section className="mt-12">
            <UpgradePrompt
              featureName="Coach Dashboard"
              unlockTier="Coach Monthly or Coach Annual"
              body="Coach Dashboard unlocks on Coach Monthly and Coach Annual."
            />
          </section>
        ) : roster.length === 0 ? (
          <section className="mt-12">
            <EmptyStateCard
              icon="network"
              title="No athletes connected yet."
              body="Share your coach code to start building your roster and assigning protocols."
            />
          </section>
        ) : (
          <>
            <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(140deg,#1b2421_0%,#26332f_42%,#857056_100%)] p-6 text-white md:p-10">
              <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-accent">Coach Dashboard</p>
                  <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">Coach Dashboard</h1>
                </div>

                <div className="rounded-[34px] border border-white/10 bg-white/8 p-6 backdrop-blur">
                  <p className="text-sm uppercase tracking-[0.25em] text-accent">Coach Code</p>
                  <p className="mt-4 text-2xl font-semibold text-white">{profile?.coach_code || 'Loading...'}</p>
                  <p className="mt-2 text-sm text-white/76">Share this code with athletes you coach.</p>
                </div>
              </div>
            </section>

            <section className="mt-12">
              <h2 className="font-display mt-2 text-4xl leading-tight md:text-5xl">Triage feed</h2>
              <div className="mt-6 rounded-[30px] bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.25em] text-accent">Sorted by urgency</p>
                  <span className="rounded-full border border-ink/10 bg-white/70 px-3 py-1 text-xs text-ink/70">Open athlete for detail</span>
                </div>
                <div className="mt-5 space-y-3">
                  {triageCards.length ? triageCards.map((card) => (
                    <article key={card.id} className="rounded-[24px] border border-ink/10 bg-white/75 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{card.athlete?.name || 'Athlete'}</p>
                          <p className="mt-1 text-sm text-ink/68">
                            {card.nextRace?.name || 'No race set'} · {formatCountdown(card.daysUntilRace)} to race
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(card.status)}`}>{card.status}</span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-ink/78">
                        {card.activeAssignment
                          ? `${card.activeAssignment.intervention_type}: ${card.activeAssignment.completion_count} logged / ${card.activeAssignment.planned_sessions} planned.`
                          : card.reason}
                      </p>
                    </article>
                  )) : (
                    <div className="rounded-[24px] border border-ink/10 bg-white/75 p-4 text-sm text-ink/75">
                      All athletes are on track.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-12">
              <h2 className="font-display mt-2 text-4xl leading-tight md:text-5xl">Full roster view</h2>
              <div className="mt-6 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <div className="flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.25em] text-accent">Every connected athlete</p>
                  <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">{roster.length} athletes</span>
                </div>
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-ink">
                    <thead>
                      <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.18em] text-ink/55">
                        <th className="pb-3 pr-4">Athlete</th>
                        <th className="pb-3 pr-4">Race</th>
                        <th className="pb-3 pr-4">Phase</th>
                        <th className="pb-3 pr-4">Last Log</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3">Why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((row) => (
                        <tr key={row.id} className="border-b border-ink/8 align-top">
                          <td className="py-4 pr-4 font-semibold">{row.athlete?.name || 'Athlete'}</td>
                          <td className="py-4 pr-4">
                            {row.nextRace?.name || 'No race set'}
                            <div className="text-xs text-ink/55">{formatCountdown(row.daysUntilRace)}</div>
                          </td>
                          <td className="py-4 pr-4">{row.phase}</td>
                          <td className="py-4 pr-4">{row.lastLogDate || 'No logs'}</td>
                          <td className="py-4 pr-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="py-4 text-ink/74">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <form onSubmit={handleAssignProtocol} className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-sm uppercase tracking-[0.25em] text-accent">Protocol assignment</p>
                <div className="mt-5 space-y-4">
                  <select
                    value={form.athlete_id}
                    onChange={(event) => setForm((current) => ({ ...current, athlete_id: event.target.value }))}
                    className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                  >
                    <option value="">Select athlete</option>
                    {roster.map((item) => (
                      <option key={item.athlete_id} value={item.athlete_id}>
                        {item.athlete?.name || 'Athlete'}
                      </option>
                    ))}
                  </select>
                  <select
                    value={form.intervention_type}
                    onChange={(event) => setForm((current) => ({ ...current, intervention_type: event.target.value }))}
                    className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                  >
                    {interventionTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))}
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                    />
                    <input
                      type="date"
                      value={form.target_completion_date}
                      onChange={(event) => setForm((current) => ({ ...current, target_completion_date: event.target.value }))}
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <select
                      value={form.frequency_type}
                      onChange={(event) => setForm((current) => ({ ...current, frequency_type: event.target.value }))}
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                    >
                      <option value="daily">Daily</option>
                      <option value="every_other_day">Every Other Day</option>
                      <option value="weekly">Weekly</option>
                      <option value="custom">Custom</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={form.planned_sessions}
                      onChange={(event) => setForm((current) => ({ ...current, planned_sessions: event.target.value }))}
                      placeholder="Planned sessions"
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                    />
                  </div>
                  <textarea
                    value={form.note}
                    onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    rows={3}
                    placeholder="Optional note to athlete"
                    className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                  />
                  <button type="submit" className="rounded-full bg-panel px-5 py-3 text-sm font-semibold text-paper">
                    Assign protocol
                  </button>
                  {message ? <p className="text-sm text-ink/70">{message}</p> : null}
                </div>
              </form>

              <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-sm uppercase tracking-[0.25em] text-accent">Assigned protocols</p>
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-ink">
                    <thead>
                      <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.18em] text-ink/55">
                        <th className="pb-3 pr-4">Athlete</th>
                        <th className="pb-3 pr-4">Protocol</th>
                        <th className="pb-3 pr-4">Window</th>
                        <th className="pb-3 pr-4">Frequency</th>
                        <th className="pb-3">Compliance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((row) => (
                        <tr key={row.id} className="border-b border-ink/8">
                          <td className="py-4 pr-4 font-semibold">{row.athlete?.name || 'Athlete'}</td>
                          <td className="py-4 pr-4">{row.intervention_type}</td>
                          <td className="py-4 pr-4">{row.start_date} - {row.target_completion_date}</td>
                          <td className="py-4 pr-4">{row.frequency_type}</td>
                          <td className="py-4">
                            <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/75">
                              {row.completion_count} / {row.planned_sessions}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
