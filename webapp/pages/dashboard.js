import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  buildInsightCards,
  buildInterventionContextCards,
  buildInterventionOverlay,
  buildModalitySplitCards,
  buildProtocolTrendCards,
  buildRaceFocusCards,
  buildTrainingComparisonCards,
  buildTrendSeries,
  buildWeeklyTableRows,
  classifyActivity,
  classifyActivityType,
  metersToFeet,
  metersToMiles,
  secondsToHours,
  sortActivitiesMostRecentFirst,
} from '../lib/activityInsights';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import EmptyStateCard from '../components/EmptyStateCard';

const timeframeOptions = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
];

const metricOptions = [
  { value: 'mileage', label: 'Mileage' },
  { value: 'elevation', label: 'Elevation' },
  { value: 'hours', label: 'Time' },
  { value: 'count', label: 'Sessions' },
];

function formatActivityDate(startDate) {
  return new Date(startDate).toLocaleString();
}

function formatMiles(value) {
  return `${value.toFixed(1)} mi`;
}

function formatFeet(value) {
  return `${Math.round(value).toLocaleString()} ft`;
}

function formatHours(value) {
  return `${value.toFixed(1)} hrs`;
}

function formatMetricValue(metric, value) {
  switch (metric) {
    case 'elevation':
      return `${Math.round(value).toLocaleString()} ft`;
    case 'hours':
      return `${value.toFixed(1)} hrs`;
    case 'count':
      return `${Math.round(value)}`;
    case 'mileage':
    default:
      return `${value.toFixed(1)} mi`;
  }
}

function formatAverageLabel(metric, value, timeframe) {
  const unit = formatMetricValue(metric, value);
  return timeframe === 90 ? `${unit}/day` : unit;
}

function isWithinLastDays(dateLike, days) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return date >= start && date <= now;
}

function buildTimeframeSummary(activities = [], interventions = [], timeframe = 30) {
  const filteredActivities = activities.filter((activity) => isWithinLastDays(activity.start_date, timeframe));
  const filteredInterventions = interventions.filter((item) => isWithinLastDays(item.date || item.inserted_at, timeframe));

  return {
    activityCount: filteredActivities.length,
    mileage: filteredActivities.reduce((sum, activity) => sum + metersToMiles(activity.distance), 0),
    elevation: filteredActivities.reduce((sum, activity) => sum + metersToFeet(activity.total_elevation_gain), 0),
    hours: filteredActivities.reduce((sum, activity) => sum + secondsToHours(activity.moving_time), 0),
    interventions: filteredInterventions.length,
  };
}

function buildHeatmapWeeks(interventions = [], weekCount = 16) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mondayOffset = (today.getDay() + 6) % 7;
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - mondayOffset);
  const entryMap = interventions.reduce((accumulator, item) => {
    const key = (item.date || item.inserted_at || '').slice(0, 10);
    if (!key) return accumulator;
    accumulator[key] = accumulator[key] || [];
    accumulator[key].push(item);
    return accumulator;
  }, {});

  return Array.from({ length: weekCount }).map((_, weekIndex) => {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() - (weekCount - weekIndex - 1) * 7);

    return {
      key: weekStart.toISOString().slice(0, 10),
      days: Array.from({ length: 7 }).map((__, dayIndex) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayIndex);
        const key = date.toISOString().slice(0, 10);
        return {
          key,
          label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          entries: entryMap[key] || [],
        };
      }),
    };
  });
}

function getHeatmapTone(count) {
  if (count <= 0) return 'bg-paper border border-ink/6';
  if (count === 1) return 'bg-accent/18';
  if (count <= 3) return 'bg-accent/34';
  if (count <= 5) return 'bg-accent/58';
  return 'bg-accent';
}

function TrendChart({ points, metric, interventionOverlay = {} }) {
  const width = 760;
  const height = 280;
  const paddingTop = 18;
  const paddingBottom = 34;
  const paddingLeft = 56;
  const paddingRight = 18;
  const [activeKey, setActiveKey] = useState(points[points.length - 1]?.key || null);

  useEffect(() => {
    setActiveKey(points[points.length - 1]?.key || null);
  }, [points]);

  if (!points.length) {
    return (
      <div className="rounded-[24px] bg-paper px-4 py-8 text-sm text-ink/60">
        No training data is available for this window yet.
      </div>
    );
  }

  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const total = points.reduce((sum, point) => sum + (point.totalValue ?? point.value), 0);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    value: maxValue * ratio,
    y: paddingTop + chartHeight - ratio * chartHeight,
  }));
  const activePoint = points.find((point) => point.key === activeKey) || points[points.length - 1];
  const intervalWidth = chartWidth / Math.max(points.length, 1);
  const activeIndex = Math.max(
    0,
    points.findIndex((point) => point.key === activePoint.key)
  );
  const activeX = paddingLeft + (activeIndex / Math.max(points.length - 1, 1)) * chartWidth;

  const polyline = points
    .map((point, index) => {
      const x = paddingLeft + (index / Math.max(points.length - 1, 1)) * chartWidth;
      const y = paddingTop + chartHeight - (point.value / maxValue) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const area = `${paddingLeft},${paddingTop + chartHeight} ${polyline} ${paddingLeft + chartWidth},${paddingTop + chartHeight}`;
  const chartSurface = 'var(--color-surface-light)';
  const gridStroke = 'var(--color-border-subtle)';
  const textColor = 'var(--color-text-muted)';
  const lineColor = 'var(--color-text-primary)';
  const accentColor = 'var(--color-accent-amber)';
  const areaFill = 'color-mix(in srgb, var(--color-accent-amber) 18%, transparent)';
  const paperColor = 'var(--color-surface-white)';

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold text-ink">{formatMetricValue(metric, total)}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/45">
            {activePoint.aggregation === 'weeklyAverage' ? '90-day weekly average view' : 'Daily view'}
          </p>
        </div>
        <p className="text-sm text-ink/55">{`${points[0].label} - ${points[points.length - 1].label}`}</p>
      </div>
      <div className="mb-4 grid gap-3 rounded-[24px] bg-paper p-4 md:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink/45">Selected window</p>
          <p className="mt-2 text-sm font-semibold text-ink">{activePoint.periodLabel}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink/45">
            {activePoint.aggregation === 'weeklyAverage' ? 'Avg/day' : 'Value'}
          </p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {formatAverageLabel(metric, activePoint.value, activePoint.aggregation === 'weeklyAverage' ? 90 : 30)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink/45">
            {activePoint.aggregation === 'weeklyAverage' ? 'Week total' : 'Sessions'}
          </p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {activePoint.aggregation === 'weeklyAverage'
              ? formatMetricValue(metric, activePoint.totalValue ?? activePoint.value)
              : activePoint.sessionCount}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink/45">Interventions</p>
          <p className="mt-2 text-sm font-semibold text-ink">{interventionOverlay[activePoint.key] || 0}</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
        <rect x="0" y="0" width={width} height={height} rx="28" fill={chartSurface} />
        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={paddingLeft}
              y1={tick.y}
              x2={paddingLeft + chartWidth}
              y2={tick.y}
              stroke={gridStroke}
              strokeDasharray="4 6"
            />
            <text
              x={paddingLeft - 10}
              y={tick.y + 4}
              textAnchor="end"
              fill={textColor}
              className="font-data"
              fontSize="11"
              letterSpacing="0.08em"
            >
              {formatAverageLabel(metric, tick.value, activePoint.aggregation === 'weeklyAverage' ? 90 : 30)}
            </text>
          </g>
        ))}
        <polygon points={area} fill={areaFill} />
        <line
          x1={activeX}
          y1={paddingTop}
          x2={activeX}
          y2={paddingTop + chartHeight}
          stroke={gridStroke}
          strokeDasharray="4 4"
        />
        {points.map((point, index) => {
          const x = paddingLeft + (index / Math.max(points.length - 1, 1)) * chartWidth;
          const y = paddingTop + chartHeight - (point.value / maxValue) * chartHeight;
          const isActive = point.key === activePoint.key;
          return (
            <g key={point.key}>
              <circle cx={x} cy={y} r={isActive ? '5.5' : '3.5'} fill={isActive ? accentColor : lineColor} />
              <rect
                x={paddingLeft + index * intervalWidth - intervalWidth / 2}
                y={paddingTop}
                width={intervalWidth}
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() => setActiveKey(point.key)}
              />
            </g>
          );
        })}
        {points.map((point, index) => {
          const interventionCount = interventionOverlay[point.key] || 0;
          if (!interventionCount) return null;
          const x = paddingLeft + (index / Math.max(points.length - 1, 1)) * chartWidth;
          return (
            <g key={`${point.key}-interventions`}>
              <line
                x1={x}
                y1={paddingTop}
                x2={x}
                y2={paddingTop + chartHeight}
                stroke={accentColor}
                strokeOpacity="0.2"
                strokeDasharray="3 5"
              />
              <circle cx={x} cy={paddingTop + 10} r="5" fill={accentColor} />
              <text x={x} y={paddingTop + 14} textAnchor="middle" fill={paperColor} className="font-data" fontSize="9" fontWeight="700">
                {interventionCount}
              </text>
            </g>
          );
        })}
        <polyline fill="none" stroke={lineColor} strokeWidth="3" points={polyline} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => {
          const x = paddingLeft + (index / Math.max(points.length - 1, 1)) * chartWidth;
          return (
            <text
              key={`${point.key}-label`}
              x={x}
              y={height - 10}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              fill={textColor}
              fillOpacity={index % Math.ceil(points.length / 6 || 1) === 0 || index === points.length - 1 ? '0.6' : '0'}
              className="font-data"
              fontSize="11"
              letterSpacing="0.08em"
            >
              {point.label}
            </text>
          );
        })}
      </svg>
      <div className="mt-3 grid gap-2 text-xs text-ink/55 md:grid-cols-3">
        <div className="rounded-[18px] bg-paper px-3 py-2">
          Peak {activePoint.aggregation === 'weeklyAverage' ? 'avg/day' : 'day'}:{' '}
          {formatAverageLabel(metric, Math.max(...points.map((point) => point.value), 0), activePoint.aggregation === 'weeklyAverage' ? 90 : 30)}
        </div>
        <div className="rounded-[18px] bg-paper px-3 py-2">
          Avg/{activePoint.aggregation === 'weeklyAverage' ? 'week' : 'day'}:{' '}
          {formatMetricValue(metric, total / Math.max(points.length, 1))}
        </div>
        <div className="rounded-[18px] bg-paper px-3 py-2">
          Active {activePoint.aggregation === 'weeklyAverage' ? 'weeks' : 'days'}: {points.filter((point) => point.value > 0).length}
        </div>
        <div className="rounded-[18px] bg-paper px-3 py-2">
          Intervention {activePoint.aggregation === 'weeklyAverage' ? 'weeks' : 'days'}: {points.filter((point) => interventionOverlay[point.key]).length}
        </div>
      </div>
    </div>
  );
}

function HeatmapModal({ day, onClose }) {
  if (!day) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/30 px-4">
      <div className="w-full max-w-xl rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_24px_60px_rgba(19,24,22,0.16)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-accent">Interventions</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{day.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ink/10 px-3 py-1 text-sm font-semibold text-ink"
          >
            Close
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {day.entries.map((entry) => (
            <div key={entry.id} className="rounded-[22px] bg-paper p-4">
              <p className="text-sm font-semibold text-ink">{entry.intervention_type}</p>
              <p className="mt-2 text-sm text-ink/70">{entry.target_race || entry.races?.name || 'No race linked'}</p>
              {entry.details ? <p className="mt-2 text-sm leading-6 text-ink/76">{entry.details}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const isFirstLogin = router.query.welcome === '1';
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState(null);
  const [activities, setActivities] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [interventionCount, setInterventionCount] = useState(0);
  const [settings, setSettings] = useState(null);
  const [timeframe, setTimeframe] = useState(30);
  const [metric, setMetric] = useState('mileage');
  const [currentRace, setCurrentRace] = useState(null);
  const [protocolSummary, setProtocolSummary] = useState(null);
  const [heatmapDay, setHeatmapDay] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const meRes = await fetch('/api/me');
        if (!meRes.ok) return;

        const me = await meRes.json();
        setAthlete(me.athlete);
        setInterventionCount(me.interventionCount);

        const settingsRes = await fetch('/api/settings');
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings({ ...settingsData.settings, supplements: settingsData.supplements || [] });
        }

        const actRes = await fetch('/api/activities');
        if (actRes.ok) {
          const actData = await actRes.json();
          setActivities(sortActivitiesMostRecentFirst(actData.activities));
        }

        const interventionsRes = await fetch('/api/interventions');
        if (interventionsRes.ok) {
          const interventionData = await interventionsRes.json();
          setInterventions(interventionData.interventions || []);
        }

        const protocolRes = await fetch('/api/current-protocol-assignment');
        if (protocolRes.ok) {
          const protocolData = await protocolRes.json();
          setProtocolSummary(protocolData);
          setCurrentRace(protocolData.currentRace || null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);
  const trainingSummary = useMemo(
    () => buildTimeframeSummary(activities, interventions, timeframe),
    [activities, interventions, timeframe]
  );
  const trendSeries = useMemo(
    () => buildTrendSeries(activities, timeframe, metric),
    [activities, timeframe, metric]
  );
  const insightCards = useMemo(
    () => buildInsightCards(activities, interventionCount, settings || {}),
    [activities, interventionCount, settings]
  );
  const classifiedActivities = useMemo(
    () =>
      activities.slice(0, 5).map((activity) => ({
        ...activity,
        classification: classifyActivity(activity, settings || {}),
        activityType: classifyActivityType(activity),
      })),
    [activities, settings]
  );
  const protocolTrendCards = useMemo(
    () => buildProtocolTrendCards(interventions, settings?.supplements || []),
    [interventions, settings]
  );
  const trainingComparisonCards = useMemo(
    () => buildTrainingComparisonCards(activities, interventions),
    [activities, interventions]
  );
  const modalityCards = useMemo(
    () => buildModalitySplitCards(activities),
    [activities]
  );
  const interventionContextCards = useMemo(
    () => buildInterventionContextCards(activities, interventions, settings || {}),
    [activities, interventions, settings]
  );
  const interventionOverlay = useMemo(
    () => buildInterventionOverlay(interventions, timeframe),
    [interventions, timeframe]
  );
  const weeklyTableRows = useMemo(
    () => buildWeeklyTableRows(activities, interventions),
    [activities, interventions]
  );
  const raceFocusCards = useMemo(
    () => buildRaceFocusCards(interventions),
    [interventions]
  );
  const heatmapWeeks = useMemo(() => buildHeatmapWeeks(interventions, 16), [interventions]);
  const showDashboardEmptyState = !currentRace && activities.length === 0 && interventions.length === 0;
  const showWelcomeChecklist = interventions.length === 0;
  const navLinks = [
    { href: '/', label: 'Landing Page', description: 'Return to the Threshold entry page.' },
    { href: '/guide', label: 'Guide', description: 'Learn how each part of Threshold works.' },
    { href: '/pricing', label: 'Pricing', description: 'View plans and feature access.' },
    { href: '/explorer', label: 'Explorer', description: 'Open the self-selection explorer.' },
    { href: '/connections', label: 'Connections', description: 'Link Strava and future platforms.' },
    { href: '/history', label: 'Intervention History', description: 'Review logged protocol history.' },
    { href: '/settings', label: 'Athlete Settings', description: 'Edit athlete baselines and HR zones.' },
    { href: '/account', label: 'Account Settings', description: 'Manage account and security.' },
    { href: '/log-intervention', label: 'Log Intervention', description: 'Create a new intervention entry.' },
    { href: '/content', label: 'Content', description: 'Track the content and community workstream.' },
  ];

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!athlete) {
    return (
      <div className="p-4">
        <p>You are not logged in.</p>
        <a href="/" className="text-accent underline">
          Go to Home
        </a>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold Home</p>
          </div>
          <NavMenu
            label="Threshold home navigation"
            links={navLinks}
            primaryLink={{ href: '/log-intervention', label: 'Log Intervention' }}
          />
        </div>

        <DashboardTabs activeHref="/dashboard" />

        {isFirstLogin ? (
          <div className="mb-6 flex items-start gap-4 rounded-[22px] border border-accent/30 bg-accent/8 px-5 py-4">
            <span className="mt-0.5 text-xl">👋</span>
            <div>
              <p className="text-sm font-semibold text-ink">Welcome to Threshold, {athlete?.name?.split(' ')[0] || 'athlete'}.</p>
              <p className="mt-1 text-sm leading-6 text-ink/65">
                Strava is connected. Now work through the three steps below and you&apos;ll have your first insight within a few sessions.
              </p>
            </div>
          </div>
        ) : null}

        {/* Race readiness + countdown — design system layout */}
        {currentRace ? (
          <section className="mb-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            {/* Race readiness dark panel */}
            <div
              className="rounded-card p-7 text-white shadow-panel"
              style={{ background: 'linear-gradient(135deg, var(--color-surface-dark) 0%, var(--color-surface-dark-raised) 100%)' }}
            >
              <p className="ui-eyebrow" style={{ color: 'var(--color-accent-amber-light)' }}>
                Race-readiness · {currentRace.name}
              </p>
              <div className="mt-4 flex items-end gap-5">
                <span
                  className="font-mono tabular-nums font-semibold leading-none"
                  style={{ fontSize: 72, color: 'var(--color-accent-amber-light)' }}
                >
                  {interventions.length > 0 ? Math.min(40 + interventions.length * 3, 98) : '—'}
                </span>
                <div style={{ paddingBottom: 8 }}>
                  <p className="text-sm font-medium text-white/90">
                    {interventions.length > 0 ? 'Keep building your protocol log' : 'Log interventions to build your score'}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted-on-dark)' }}>
                    {interventions.length} interventions logged
                  </p>
                </div>
              </div>
              {/* Sub-scores */}
              <div className="mt-6 grid grid-cols-4 gap-3">
                {[
                  { label: 'Phase', value: protocolSummary?.phase || 'Base', em: '📋' },
                  { label: 'Type', value: currentRace.race_type || '—', em: '🏔️' },
                  { label: 'Distance', value: currentRace.distance_miles ? `${Number(currentRace.distance_miles).toFixed(0)}mi` : '—', em: '📏' },
                  { label: 'Logs', value: interventions.length, em: '📊' },
                ].map(({ label, value, em }) => (
                  <div key={label}>
                    <p className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: 'rgba(240,234,224,0.55)' }}>{em} {label}</p>
                    <p className="mt-1.5 font-mono text-lg font-semibold leading-none">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Countdown card */}
            <div className="ui-card p-7">
              <p className="ui-eyebrow">Race countdown</p>
              <p className="font-display mt-2 text-2xl font-semibold leading-snug text-ink">{currentRace.name}</p>
              {currentRace.race_date ? (
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {new Date(currentRace.race_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {currentRace.race_type ? ` · ${currentRace.race_type}` : ''}
                </p>
              ) : null}
              <div className="mt-5 flex items-baseline gap-3">
                <span
                  className="font-mono tabular-nums font-semibold leading-none"
                  style={{ fontSize: 64, color: 'var(--color-accent-amber)' }}
                >
                  {protocolSummary?.daysUntilRace ?? '—'}
                </span>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>days</span>
              </div>
              <div className="mt-5 flex gap-2">
                <a href="/race-plan" className="ui-button-secondary py-2 text-sm">View blueprint</a>
                <a href="/log-intervention" className="ui-button-ghost py-2 text-sm">Log intervention</a>
              </div>
            </div>
          </section>
        ) : (
          <section className="mb-8 rounded-[30px] border border-ink/10 bg-white p-6 shadow-warm">
            <p className="ui-eyebrow">Race Countdown</p>
            <div className="mt-4 rounded-[24px] bg-paper p-4 text-sm text-ink/75">
              <p>Set your target race to activate your dashboard.</p>
              <a href="/log-intervention" className="mt-4 inline-flex rounded-full bg-panel px-4 py-2 text-sm font-semibold text-paper">
                Set Target Race
              </a>
            </div>
          </section>
        )}

        <div className="mb-10 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="ui-eyebrow">
                {protocolSummary?.phase ? `Phase: ${protocolSummary.phase}` : 'Training Intelligence'}
                {currentRace && protocolSummary?.daysUntilRace != null ? ` · ${protocolSummary.daysUntilRace} days to ${currentRace.name}` : ''}
              </p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl font-semibold leading-tight md:text-7xl" style={{ letterSpacing: '-0.015em' }}>
                Welcome back, {athlete.name?.split(' ')[0] || athlete.name}.
              </h1>
              {currentRace ? (
                <p className="mt-3 text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {interventions.length > 0
                    ? `${interventions.length} interventions logged — keep building your protocol foundation.`
                    : 'Log your first intervention to start building your readiness score.'}
                </p>
              ) : (
                <p className="mt-3 text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Set a target race to activate your race blueprint and readiness dashboard.
                </p>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/log-intervention" className="ui-button-primary inline-flex items-center gap-2 px-6 py-3">
                  + Log intervention
                </a>
                <a href="/insights" className="ui-button-secondary px-5 py-3 text-sm">Insights</a>
                <a href="/history" className="ui-button-ghost px-5 py-3 text-sm">History</a>
              </div>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.25em] text-accent">Current Trend Window</p>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Last {timeframe} Days</span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Mileage</p>
                  <p className="mt-2 text-xl font-semibold">{formatMiles(trainingSummary.mileage)}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Elevation</p>
                  <p className="mt-2 text-xl font-semibold">{formatFeet(trainingSummary.elevation)}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Time Spent</p>
                  <p className="mt-2 text-xl font-semibold">{formatHours(trainingSummary.hours)}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Interventions</p>
                  <p className="mt-2 text-xl font-semibold">{trainingSummary.interventions}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showWelcomeChecklist ? (
          <section className="mb-10 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Getting started</p>
            <h2 className="font-display mt-3 text-2xl font-semibold text-ink">Three steps to your first insight</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <a
                href="/log-intervention"
                className="group flex flex-col rounded-[22px] border border-ink/10 bg-paper p-4 transition hover:border-ink/20 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${currentRace ? 'bg-accent text-panel' : 'bg-ink/10 text-ink/50'}`}>
                    {currentRace ? '✓' : '1'}
                  </span>
                  <p className="text-sm font-semibold text-ink">Set your target race</p>
                </div>
                <p className="mt-2 pl-10 text-xs leading-5 text-ink/55">
                  {currentRace ? `Racing ${currentRace.name}` : 'Tell Threshold what you\'re training for. Every intervention links to this.'}
                </p>
              </a>
              <a
                href="/settings"
                className="group flex flex-col rounded-[22px] border border-ink/10 bg-paper p-4 transition hover:border-ink/20 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/10 text-xs font-bold text-ink/50">2</span>
                  <p className="text-sm font-semibold text-ink">Fill in your baselines</p>
                </div>
                <p className="mt-2 pl-10 text-xs leading-5 text-ink/55">HR zones, fueling anchors, sweat rate. Makes your insights personal instead of generic.</p>
              </a>
              <a
                href="/log-intervention"
                className="group flex flex-col rounded-[22px] border border-ink/10 bg-paper p-4 transition hover:border-ink/20 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/10 text-xs font-bold text-ink/50">3</span>
                  <p className="text-sm font-semibold text-ink">Log your first intervention</p>
                </div>
                <p className="mt-2 pl-10 text-xs leading-5 text-ink/55">Heat session, gut training run, bicarb trial — whatever you did last. That&apos;s your first data point.</p>
              </a>
            </div>
          </section>
        ) : null}

        {!showDashboardEmptyState ? (
        <>
        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.22em] text-accent">Connections</p>
            <p className="mt-4 text-3xl font-semibold text-ink">1</p>
          </article>
          <article className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.22em] text-accent">Activities</p>
            <p className="mt-4 text-3xl font-semibold text-ink">{trainingSummary.activityCount}</p>
          </article>
          <article className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.22em] text-accent">Interventions</p>
            <p className="mt-4 text-3xl font-semibold text-ink">{trainingSummary.interventions}</p>
          </article>
          <article className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.22em] text-accent">AI Readiness</p>
            <p className="mt-4 text-3xl font-semibold text-ink">
              {settings?.hr_zone_3_min ? 'Seeded' : 'Needs setup'}
            </p>
          </article>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Trends</p>
              <div className="flex flex-wrap gap-2">
                {timeframeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTimeframe(option.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${timeframe === option.value ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {metricOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMetric(option.value)}
                  className={`rounded-full px-3 py-2 text-sm font-semibold ${metric === option.value ? 'bg-ink text-paper' : 'border border-ink/10 text-ink'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-6">
              <TrendChart points={trendSeries} metric={metric} interventionOverlay={interventionOverlay} />
            </div>
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">AI Insights</p>
              <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">Current</span>
            </div>
            <div className="mt-5 space-y-4">
              {insightCards.map((card) => (
                <div key={card.title} className="rounded-[24px] bg-paper p-4">
                  <p className="text-base font-semibold text-ink">{card.title}</p>
                  <p className="mt-2 text-sm leading-7 text-ink/75">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Protocol Signals</p>
            </div>
            <div className="mt-5 space-y-4">
              {protocolTrendCards.map((card) => (
                <div key={card.title} className="rounded-[24px] bg-paper p-4">
                  <p className="text-sm font-semibold text-ink">{card.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/75">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Training Comparisons</p>
            </div>
            <div className="mt-5 space-y-4">
              {trainingComparisonCards.map((card) => (
                <div key={card.title} className="rounded-[24px] bg-paper p-4">
                  <p className="text-sm font-semibold text-ink">{card.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/75">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] bg-[linear-gradient(135deg,#1b2421_0%,#29302d_100%)] p-6 text-white">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Baseline Trends</p>
              <a href="/connections" className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/80">
                Connections
              </a>
            </div>
            <div className="mt-5 space-y-3">
              {[
                `${settings?.supplements?.filter((item) => item.supplement_name || item.amount).length || 0} baseline supplements are tracked.`,
                `${settings?.sweat_sodium_concentration_mg_l || '-'} mg/L sweat sodium concentration is available for electrolyte comparison.`,
                `${interventionCount} intervention records are ready to compare against training load.`,
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[30px] bg-[linear-gradient(135deg,#1b2421_0%,#29302d_100%)] p-6 text-white">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Recent Training</p>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Most Recent First</span>
            </div>
            <div className="mt-5 space-y-3">
              {classifiedActivities.map((activity) => (
                <div key={activity.id} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{activity.name}</p>
                      <p className="mt-1 text-sm text-white/70">{formatActivityDate(activity.start_date)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-paper/15 px-3 py-1 text-xs font-semibold text-white">
                        {activity.activityType.label}
                      </span>
                      <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-panel">
                        {activity.classification.label}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/80">
                    <span>{formatMiles(metersToMiles(activity.distance))}</span>
                    <span>{formatHours(secondsToHours(activity.moving_time))}</span>
                    <span>{formatFeet(metersToFeet(activity.total_elevation_gain))}</span>
                  </div>
                </div>
              ))}
              {classifiedActivities.length === 0 ? (
                <p className="text-sm text-white/70">No recent Strava activities were found.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Inference Inputs</p>
              <a href="/settings" className="rounded-full border border-ink/10 px-3 py-1 text-xs text-ink/80">
                Settings
              </a>
            </div>
            {settings ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] bg-paper p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Resting HR</p>
                  <p className="mt-2 text-xl font-semibold">{settings.resting_hr ?? '-'}</p>
                </div>
                <div className="rounded-[24px] bg-paper p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Zone 3 Min</p>
                  <p className="mt-2 text-xl font-semibold">{settings.hr_zone_3_min ?? '-'}</p>
                </div>
                <div className="rounded-[24px] bg-paper p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Zone 4 Min</p>
                  <p className="mt-2 text-xl font-semibold">{settings.hr_zone_4_min ?? '-'}</p>
                </div>
                <div className="rounded-[24px] bg-paper p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Sleep Altitude</p>
                  <p className="mt-2 text-xl font-semibold">{settings.baseline_sleep_altitude_ft ?? '-'} ft</p>
                </div>
                <div className="rounded-[24px] bg-paper p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Electrolytes</p>
                  <p className="mt-2 text-xl font-semibold">{settings.sodium_target_mg_per_hr ?? '-'} mg/hr</p>
                </div>
                <div className="rounded-[24px] bg-paper p-4 sm:col-span-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Baseline Supplements</p>
                  <p className="mt-2 text-xl font-semibold">
                    {settings.supplements?.filter((item) => item.supplement_name || item.amount).length || 0}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-ink/10 bg-paper p-4">
                <p className="text-sm text-ink/75">
                  Add your baseline settings to fill this section.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Modality Breakdown</p>
            </div>
            <div className="mt-5 space-y-4">
              {modalityCards.map((card) => (
                <div key={card.title} className="rounded-[24px] bg-paper p-4">
                  <p className="text-sm font-semibold text-ink">{card.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/75">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Intervention Context</p>
            </div>
            <div className="mt-5 space-y-4">
              {interventionContextCards.map((card) => (
                <div key={card.title} className="rounded-[24px] bg-paper p-4">
                  <p className="text-sm font-semibold text-ink">{card.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/75">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Intervention History</p>
              <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">Last 16 weeks</span>
            </div>
            <div className="mt-5">
              <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-2">
                {heatmapWeeks.map((week) => (
                  <div key={week.key} className="grid gap-2">
                    {week.days.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => day.entries.length && setHeatmapDay(day)}
                        className={`h-5 w-5 rounded-[6px] transition ${getHeatmapTone(day.entries.length)} ${day.entries.length ? 'cursor-pointer' : 'cursor-default'}`}
                        aria-label={`${day.label}: ${day.entries.length} interventions`}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-ink/60">
                <span>less</span>
                {[
                  'bg-paper border border-ink/6',
                  'bg-accent/18',
                  'bg-accent/34',
                  'bg-accent/58',
                  'bg-accent',
                ].map((tone) => (
                  <span key={tone} className={`h-3 w-3 rounded-[4px] ${tone}`} />
                ))}
                <span>more</span>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Race Focus</p>
            </div>
            <div className="mt-5 space-y-4">
              {raceFocusCards.map((card) => (
                <div key={card.title} className="rounded-[24px] bg-paper p-4">
                  <p className="text-sm font-semibold text-ink">{card.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/75">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Weekly Drill-down</p>
              <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">Last 10 weeks</span>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm text-ink">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-[0.18em] text-ink/55">
                    <th className="pb-3 pr-4">Week</th>
                    <th className="pb-3 pr-4">Miles</th>
                    <th className="pb-3 pr-4">Elev</th>
                    <th className="pb-3 pr-4">Hours</th>
                    <th className="pb-3 pr-4">Run %</th>
                    <th className="pb-3 pr-4">Bike %</th>
                    <th className="pb-3">Interventions</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyTableRows.map((row) => (
                    <tr key={row.key} className="border-b border-ink/8">
                      <td className="py-3 pr-4 font-semibold">{row.key}</td>
                      <td className="py-3 pr-4">{row.mileage.toFixed(1)}</td>
                      <td className="py-3 pr-4">{row.elevation.toFixed(0)}</td>
                      <td className="py-3 pr-4">{row.hours.toFixed(1)}</td>
                      <td className="py-3 pr-4">{row.runShare.toFixed(0)}%</td>
                      <td className="py-3 pr-4">{row.bikeShare.toFixed(0)}%</td>
                      <td className="py-3 font-semibold">{row.interventions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <HeatmapModal day={heatmapDay} onClose={() => setHeatmapDay(null)} />
        </>
        ) : null}
      </div>
    </main>
  );
}
