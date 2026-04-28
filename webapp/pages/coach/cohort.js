import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getCoachCohortData } from '../../lib/coachAnalytics';

const COMPARE_OPTIONS = [
  { id: 'protocolCompliance', label: 'Compare Protocol Compliance' },
  { id: 'interventionVolume', label: 'Compare Intervention Volume' },
  { id: 'raceReadiness', label: 'Compare Race Readiness' },
];

const CHART_VIEW_OPTIONS = [
  { id: 'table', label: 'Table' },
  { id: 'chart', label: 'Chart' },
];

const ATHLETE_COLORS = ['#B8752A', '#D4893A', '#0F766E', '#2563EB', '#7C3AED', '#BE185D'];

function toneClasses(tone) {
  if (tone === 'green') return 'bg-emerald-100 text-emerald-900';
  if (tone === 'amber') return 'bg-amber-100 text-amber-900';
  return 'bg-red-100 text-red-800';
}

function cellClasses(tone) {
  if (tone === 'green') return 'bg-emerald-50 text-emerald-900';
  if (tone === 'amber') return 'bg-amber-50 text-amber-900';
  return 'bg-red-50 text-red-800';
}

function formatValue(value, compareMode) {
  if (compareMode === 'interventionVolume') return String(value);
  return `${value}%`;
}

function ExportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="ui-button-secondary py-2"
    >
      Export to PDF
    </button>
  );
}

function CohortToolbar({
  athletes,
  selectedAthleteIds,
  setSelectedAthleteIds,
  compareMode,
  setCompareMode,
  viewMode,
  setViewMode,
  groupFilter,
  setGroupFilter,
  groups,
}) {
  function toggleAthlete(athleteId) {
    setSelectedAthleteIds((current) => (
      current.includes(athleteId)
        ? current.filter((id) => id !== athleteId)
        : [...current, athleteId]
    ));
  }

  function toggleAllVisible() {
    if (selectedAthleteIds.length === athletes.length) {
      setSelectedAthleteIds([]);
      return;
    }
    setSelectedAthleteIds(athletes.map((athlete) => athlete.athleteId));
  }

  return (
    <section className="ui-card">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-accent">Cohort comparison</p>
          <h1 className="font-display mt-3 text-4xl text-ink md:text-5xl">Multi-athlete readiness board</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/62">
            Select a race cohort, choose the comparison lens, then print a clean coach-facing PDF for expo week or athlete review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/coach/groups" className="ui-button-secondary py-2">Manage Groups</Link>
          <ExportButton />
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,220px))]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label className="text-xs uppercase tracking-[0.16em] text-ink/45">Athletes</label>
            <button type="button" onClick={toggleAllVisible} className="text-sm font-semibold text-accent">
              {selectedAthleteIds.length === athletes.length ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="max-h-[240px] space-y-2 overflow-y-auto rounded-[20px] border border-border-subtle bg-surface-light p-3">
            {athletes.map((athlete) => (
              <label key={athlete.athleteId} className="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] bg-white px-3 py-3">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedAthleteIds.includes(athlete.athleteId)}
                    onChange={() => toggleAthlete(athlete.athleteId)}
                    className="h-4 w-4 accent-amber-700"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{athlete.athleteName}</span>
                    <span className="block text-xs text-ink/52">{athlete.upcomingRace?.name || 'No race linked yet'}</span>
                  </span>
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClasses(athlete.tones.readiness)}`}>
                  {athlete.readinessScore}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.16em] text-ink/45">Group filter</label>
          <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="ui-input mt-2">
            <option value="all">All groups</option>
            {groups.map((group) => (
              <option key={group.id} value={group.name}>{group.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.16em] text-ink/45">Comparison mode</label>
          <select value={compareMode} onChange={(event) => setCompareMode(event.target.value)} className="ui-input mt-2">
            {COMPARE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.16em] text-ink/45">View</label>
          <select value={viewMode} onChange={(event) => setViewMode(event.target.value)} className="ui-input mt-2">
            {CHART_VIEW_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}

function ComparisonTable({ rows, selectedAthletes, compareMode }) {
  return (
    <section className="ui-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm text-ink">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="text-xs uppercase tracking-[0.18em] text-ink/45">
              <th className="border-b border-border-subtle px-4 py-3">Metric</th>
              {selectedAthletes.map((athlete) => (
                <th key={athlete.athleteId} className="border-b border-border-subtle px-4 py-3">
                  {athlete.athleteName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.metric} className={index % 2 === 0 ? 'bg-white' : 'bg-surface-light/65'}>
                <td className="border-b border-border-subtle px-4 py-4 font-semibold text-ink">{row.metric}</td>
                {selectedAthletes.map((athlete) => {
                  const value = row.values.find((item) => item.athleteId === athlete.athleteId) || { value: 0, tone: 'red' };
                  return (
                    <td key={`${row.metric}-${athlete.athleteId}`} className="border-b border-border-subtle px-4 py-4">
                      <span className={`inline-flex min-w-[72px] items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold ${cellClasses(value.tone)}`}>
                        {formatValue(value.value, compareMode)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReadinessRadarChart({ selectedAthletes, mounted }) {
  const radarData = [
    { dimension: 'Training Load' },
    { dimension: 'Heat Prep' },
    { dimension: 'Gut Training' },
    { dimension: 'Sleep Quality' },
    { dimension: 'Protocol Compliance' },
  ].map((row) => {
    const result = { dimension: row.dimension };
    selectedAthletes.forEach((athlete) => {
      result[athlete.athleteName] =
        row.dimension === 'Training Load' ? athlete.breakdown.trainingLoad
          : row.dimension === 'Heat Prep' ? athlete.breakdown.heatPrep
            : row.dimension === 'Gut Training' ? athlete.breakdown.gutTraining
              : row.dimension === 'Sleep Quality' ? athlete.breakdown.sleepQuality
                : athlete.breakdown.protocolCompliance;
    });
    return result;
  });

  if (!mounted) {
    return <div className="h-[420px] rounded-[24px] bg-white/5" />;
  }

  return (
    <ResponsiveContainer width="100%" height={420}>
      <RadarChart data={radarData}>
        <PolarGrid stroke="rgba(255,255,255,0.22)" />
        <PolarAngleAxis dataKey="dimension" tick={{ fill: '#F0EAE0', fontSize: 12 }} />
        {selectedAthletes.map((athlete, index) => (
          <Radar
            key={athlete.athleteId}
            name={athlete.athleteName}
            dataKey={athlete.athleteName}
            stroke={ATHLETE_COLORS[index % ATHLETE_COLORS.length]}
            fill={ATHLETE_COLORS[index % ATHLETE_COLORS.length]}
            fillOpacity={0.5}
          />
        ))}
        <Legend wrapperStyle={{ color: '#F0EAE0' }} />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function BarComparisonChart({ rows, selectedAthletes, mounted, compareMode }) {
  const chartData = rows.map((row) => {
    const item = { metric: row.metric };
    row.values.forEach((value) => {
      item[value.athleteName] = value.value;
    });
    return item;
  });

  if (!mounted) {
    return <div className="h-[420px] rounded-[24px] bg-surface-light" />;
  }

  return (
    <ResponsiveContainer width="100%" height={420}>
      <BarChart data={chartData}>
        <XAxis dataKey="metric" stroke="#6B5B4B" tick={{ fontSize: 12 }} />
        <YAxis stroke="#6B5B4B" tick={{ fontSize: 12 }} domain={[0, compareMode === 'interventionVolume' ? 'auto' : 100]} />
        <Tooltip />
        <Legend />
        {selectedAthletes.map((athlete, index) => (
          <Bar
            key={athlete.athleteId}
            dataKey={athlete.athleteName}
            fill={ATHLETE_COLORS[index % ATHLETE_COLORS.length]}
            radius={[8, 8, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function SummaryCards({ selectedAthletes }) {
  const averageReadiness = Math.round(
    selectedAthletes.reduce((total, athlete) => total + athlete.readinessScore, 0) / Math.max(1, selectedAthletes.length)
  );
  const highest = [...selectedAthletes].sort((left, right) => right.readinessScore - left.readinessScore)[0];
  const risks = Array.from(new Set(selectedAthletes.flatMap((athlete) => athlete.risks))).slice(0, 4);

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <article className="ui-card-dark">
        <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Average readiness</p>
        <p className="ui-data mt-4 text-5xl text-white">{averageReadiness}</p>
        <p className="mt-3 text-sm text-white/62">Across the currently selected cohort.</p>
      </article>
      <article className="ui-card">
        <p className="text-xs uppercase tracking-[0.24em] text-accent">Most ready</p>
        <p className="mt-4 text-2xl font-semibold text-ink">{highest?.athleteName || 'No athlete selected'}</p>
        <p className="mt-2 text-sm text-ink/58">{highest ? `${highest.readinessScore}/100 readiness` : 'Select at least one athlete to compare.'}</p>
      </article>
      <article className="ui-card">
        <p className="text-xs uppercase tracking-[0.24em] text-accent">Common risks</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {risks.length ? risks.map((risk) => (
            <span key={risk} className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">{risk}</span>
          )) : (
            <p className="text-sm text-ink/58">No shared risk flags in this selection.</p>
          )}
        </div>
      </article>
    </section>
  );
}

export default function CoachCohortPage({ initialData }) {
  const [mounted, setMounted] = useState(false);
  const [compareMode, setCompareMode] = useState('protocolCompliance');
  const [viewMode, setViewMode] = useState('table');
  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedAthleteIds, setSelectedAthleteIds] = useState(
    (initialData?.athletes || []).slice(0, 4).map((athlete) => athlete.athleteId)
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const visibleAthletes = useMemo(() => {
    return (initialData?.athletes || []).filter((athlete) => (
      groupFilter === 'all' || athlete.groupName === groupFilter
    ));
  }, [groupFilter, initialData]);

  useEffect(() => {
    setSelectedAthleteIds((current) => current.filter((id) => visibleAthletes.some((athlete) => athlete.athleteId === id)));
  }, [visibleAthletes]);

  const selectedAthletes = useMemo(() => {
    const fallback = visibleAthletes.slice(0, 4);
    const filtered = visibleAthletes.filter((athlete) => selectedAthleteIds.includes(athlete.athleteId));
    return filtered.length ? filtered : fallback;
  }, [selectedAthleteIds, visibleAthletes]);

  const rows = useMemo(() => {
    if (compareMode === 'protocolCompliance') {
      return (initialData?.comparison?.protocolComplianceRows || []).map((row) => ({
        ...row,
        values: row.values.filter((value) => selectedAthletes.some((athlete) => athlete.athleteId === value.athleteId)),
      }));
    }

    if (compareMode === 'interventionVolume') {
      return (initialData?.comparison?.interventionVolumeRows || []).map((row) => ({
        ...row,
        values: row.values.filter((value) => selectedAthletes.some((athlete) => athlete.athleteId === value.athleteId)),
      }));
    }

    return [
      { metric: 'Training Load', values: selectedAthletes.map((athlete) => ({ athleteId: athlete.athleteId, athleteName: athlete.athleteName, value: athlete.breakdown.trainingLoad, tone: athlete.tones.trainingLoad })) },
      { metric: 'Heat Prep', values: selectedAthletes.map((athlete) => ({ athleteId: athlete.athleteId, athleteName: athlete.athleteName, value: athlete.breakdown.heatPrep, tone: scoreTone(athlete.breakdown.heatPrep) })) },
      { metric: 'Gut Training', values: selectedAthletes.map((athlete) => ({ athleteId: athlete.athleteId, athleteName: athlete.athleteName, value: athlete.breakdown.gutTraining, tone: athlete.tones.gutTraining })) },
      { metric: 'Sleep Quality', values: selectedAthletes.map((athlete) => ({ athleteId: athlete.athleteId, athleteName: athlete.athleteName, value: athlete.breakdown.sleepQuality, tone: athlete.tones.sleepQuality })) },
      { metric: 'Protocol Compliance', values: selectedAthletes.map((athlete) => ({ athleteId: athlete.athleteId, athleteName: athlete.athleteName, value: athlete.breakdown.protocolCompliance, tone: athlete.tones.protocolCompliance })) },
    ];
  }, [compareMode, initialData, selectedAthletes]);

  if (!initialData) {
    return <main className="ui-shell"><div className="ui-card">Could not load cohort comparison.</div></main>;
  }

  return (
    <main className="ui-shell text-ink print:px-0">
      <div className="space-y-6">
        <CohortToolbar
          athletes={visibleAthletes}
          selectedAthleteIds={selectedAthleteIds}
          setSelectedAthleteIds={setSelectedAthleteIds}
          compareMode={compareMode}
          setCompareMode={setCompareMode}
          viewMode={viewMode}
          setViewMode={setViewMode}
          groupFilter={groupFilter}
          setGroupFilter={setGroupFilter}
          groups={initialData.groups || []}
        />

        <SummaryCards selectedAthletes={selectedAthletes} />

        {viewMode === 'table' ? (
          <ComparisonTable rows={rows} selectedAthletes={selectedAthletes} compareMode={compareMode} />
        ) : compareMode === 'raceReadiness' ? (
          <section className="ui-card-dark">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Radar chart</p>
                <p className="mt-2 text-sm text-white/62">Five readiness dimensions across the selected athletes.</p>
              </div>
            </div>
            <div className="mt-6">
              <ReadinessRadarChart selectedAthletes={selectedAthletes} mounted={mounted} />
            </div>
          </section>
        ) : (
          <section className="ui-card">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-accent">Comparison chart</p>
              <p className="mt-2 text-sm text-ink/58">
                {compareMode === 'protocolCompliance'
                  ? 'Side-by-side protocol compliance across active protocol types.'
                  : 'Intervention counts by phase category for the current cohort window.'}
              </p>
            </div>
            <div className="mt-6">
              <BarComparisonChart rows={rows} selectedAthletes={selectedAthletes} mounted={mounted} compareMode={compareMode} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function scoreTone(value) {
  if (value >= 80) return 'green';
  if (value >= 60) return 'amber';
  return 'red';
}

export async function getServerSideProps(context) {
  try {
    const data = await getCoachCohortData({ req: context.req });

    if (!data.authenticated) {
      return {
        redirect: {
          destination: '/login?next=/coach/cohort',
          permanent: false,
        },
      };
    }

    return {
      props: {
        initialData: data,
      },
    };
  } catch (error) {
    console.error('[coach cohort page] failed:', error);
    return {
      props: {
        initialData: null,
      },
    };
  }
}
