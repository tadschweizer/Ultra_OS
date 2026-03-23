import { useEffect, useMemo, useState } from 'react';
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
  summarizeRecentTraining,
} from '../lib/activityInsights';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';

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

function TrendChart({ points, metric, interventionOverlay = {} }) {
  const width = 760;
  const height = 280;
  const paddingTop = 18;
  const paddingBottom = 34;
  const paddingLeft = 56;
  const paddingRight = 18;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    value: maxValue * ratio,
    y: paddingTop + chartHeight - ratio * chartHeight,
  }));

  const polyline = points
    .map((point, index) => {
      const x = paddingLeft + (index / Math.max(points.length - 1, 1)) * chartWidth;
      const y = paddingTop + chartHeight - (point.value / maxValue) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const area = `${paddingLeft},${paddingTop + chartHeight} ${polyline} ${paddingLeft + chartWidth},${paddingTop + chartHeight}`;

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <p className="text-3xl font-semibold text-ink">{formatMetricValue(metric, total)}</p>
        <p className="text-sm text-ink/55">{points.length > 0 ? `${points[0].label} - ${points[points.length - 1].label}` : ''}</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
        <rect x="0" y="0" width={width} height={height} rx="28" fill="#f3eadf" />
        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={paddingLeft}
              y1={tick.y}
              x2={paddingLeft + chartWidth}
              y2={tick.y}
              stroke="#18211f"
              strokeOpacity="0.09"
              strokeDasharray="4 6"
            />
            <text
              x={paddingLeft - 10}
              y={tick.y + 4}
              textAnchor="end"
              fill="#18211f"
              fillOpacity="0.55"
              fontSize="11"
              letterSpacing="0.08em"
            >
              {formatMetricValue(metric, tick.value)}
            </text>
          </g>
        ))}
        <polygon points={area} fill="rgba(24,33,31,0.1)" />
        {points.map((point, index) => {
          const x = paddingLeft + (index / Math.max(points.length - 1, 1)) * chartWidth;
          const y = paddingTop + chartHeight - (point.value / maxValue) * chartHeight;
          return <circle key={point.key} cx={x} cy={y} r="3.5" fill="#18211f" />;
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
                stroke="#ba7a36"
                strokeOpacity="0.2"
                strokeDasharray="3 5"
              />
              <circle cx={x} cy={paddingTop + 10} r="5" fill="#ba7a36" />
              <text x={x} y={paddingTop + 14} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">
                {interventionCount}
              </text>
            </g>
          );
        })}
        <polyline fill="none" stroke="#18211f" strokeWidth="3" points={polyline} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => {
          const x = paddingLeft + (index / Math.max(points.length - 1, 1)) * chartWidth;
          return (
            <text
              key={`${point.key}-label`}
              x={x}
              y={height - 10}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              fill="#18211f"
              fillOpacity={index % Math.ceil(points.length / 6 || 1) === 0 || index === points.length - 1 ? '0.6' : '0'}
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
          Peak day: {formatMetricValue(metric, Math.max(...points.map((point) => point.value), 0))}
        </div>
        <div className="rounded-[18px] bg-paper px-3 py-2">
          Avg/day: {formatMetricValue(metric, total / Math.max(points.length, 1))}
        </div>
        <div className="rounded-[18px] bg-paper px-3 py-2">
          Active days: {points.filter((point) => point.value > 0).length}
        </div>
        <div className="rounded-[18px] bg-paper px-3 py-2">
          Intervention days: {points.filter((point) => interventionOverlay[point.key]).length}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState(null);
  const [activities, setActivities] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [interventionCount, setInterventionCount] = useState(0);
  const [settings, setSettings] = useState(null);
  const [timeframe, setTimeframe] = useState(30);
  const [metric, setMetric] = useState('mileage');

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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const trainingSummary = useMemo(() => summarizeRecentTraining(activities), [activities]);
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
  const navLinks = [
    { href: '/', label: 'Landing Page', description: 'Return to the UltraOS entry page.' },
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
            <p className="text-xs uppercase tracking-[0.35em] text-accent">UltraOS Home</p>
          </div>
          <NavMenu
            label="UltraOS home navigation"
            links={navLinks}
            primaryLink={{ href: '/log-intervention', label: 'Log Intervention' }}
          />
        </div>

        <DashboardTabs activeHref="/dashboard" />

        <div className="mb-12 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Training Intelligence Home</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                Welcome back, {athlete.name}
              </h1>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="/connections" className="rounded-full bg-ink px-6 py-3 font-semibold text-paper">
                  Add Connection / Source
                </a>
                <a href="/log-intervention" className="rounded-full border border-ink/20 bg-white/50 px-6 py-3 font-semibold text-ink">
                  Log an Intervention
                </a>
                <a href="/history" className="rounded-full border border-ink/20 bg-white/50 px-6 py-3 font-semibold text-ink">
                  Intervention History
                </a>
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
                  <p className="mt-2 text-xl font-semibold">{interventionCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

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
            <p className="mt-4 text-3xl font-semibold text-ink">{interventionCount}</p>
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
              <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">Early Heuristics</span>
            </div>
            <div className="mt-5 space-y-4">
              {insightCards.map((card) => (
                <div key={card.title} className="rounded-[24px] bg-paper p-4">
                  <p className="text-sm font-semibold text-ink">{card.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/75">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Protocol Signals</p>
              <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">Interventions + baseline stack</span>
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
              <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">Weekly load + intervention context</span>
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
                Expand Sources
              </a>
            </div>
            <div className="mt-5 space-y-3">
              {[
                `${settings?.supplements?.filter((item) => item.supplement_name || item.amount).length || 0} baseline supplements are tracked.`,
                `${settings?.sweat_sodium_concentration_mg_l || '-'} mg/L sweat sodium concentration is available for electrolyte comparison.`,
                `${interventionCount} intervention records are ready to compare against training load.`,
                'Supplement trends will surface here once more workouts and intervention pairings accumulate.',
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
                Edit Settings
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
                  Save HR zones and baseline settings so training trends and future insight quality improve.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Modality Breakdown</p>
              <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">Run / bike / other</span>
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
              <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">Phase / workout / race</span>
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
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Race Focus</p>
              <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">Target race slices</span>
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
      </div>
    </main>
  );
}
