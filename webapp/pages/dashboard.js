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
import ProtocolComplianceRing from '../components/ProtocolComplianceRing';
import { getAdminRequestContext } from '../lib/authServer';
import { getProtocolStripeClass } from '../lib/protocolAssignmentEngine';
import { getDashboardPreview } from '../lib/previews/dashboard';

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

function formatPromptDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
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

function ProtocolMessages({ messages = [] }) {
  if (!messages.length) return null;

  return (
    <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-amber-800">Coach comments</p>
      <div className="mt-3 space-y-3">
        {messages.map((message) => (
          <div key={message.id} className="rounded-[16px] bg-white/85 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">
              {message.sender_role === 'coach' ? 'Coach' : 'Athlete'} · {formatActivityDate(message.created_at)}
            </p>
            <p className="mt-2 text-sm leading-6 text-ink">{message.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FollowUpPromptCard({ prompt, busy, onDismiss }) {
  const activityName = prompt.metadata?.activity_name || 'Workout';
  const providerLabel = prompt.provider ? `${prompt.provider[0].toUpperCase()}${prompt.provider.slice(1)}` : 'Provider';

  return (
    <article className="rounded-[26px] border border-amber-200 bg-amber-50/70 p-5 shadow-[0_14px_30px_rgba(146,102,36,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent">{providerLabel} follow-up</p>
          <h3 className="mt-2 text-lg font-semibold text-ink">{prompt.title}</h3>
        </div>
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-ink/60">
          {formatPromptDate(prompt.occurred_at)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink/72">{prompt.body}</p>
      <div className="mt-4 rounded-[20px] bg-white/75 px-4 py-3 text-xs uppercase tracking-[0.16em] text-ink/52">
        Activity: {activityName}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={prompt.href || '/log-intervention'} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
          Open prompt
        </a>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDismiss(prompt.id)}
          className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink/70"
        >
          {busy ? 'Saving...' : 'Dismiss'}
        </button>
      </div>
    </article>
  );
}

function daysBetweenNow(dateLike) {
  if (!dateLike) return null;
  const target = new Date(dateLike);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function buildTodayActions({
  activities = [],
  followUpPrompts = [],
  currentRace = null,
  protocolSummary = null,
  settings = null,
}) {
  const actions = [];
  const latestActivity = activities[0];

  if (followUpPrompts.length) {
    const prompt = followUpPrompts[0];
    actions.push({
      tone: 'urgent',
      label: 'Waiting on you',
      title: prompt.title || 'Finish the latest workout follow-up',
      body: prompt.body || 'A recent imported workout has a short follow-up ready.',
      href: prompt.href || '/log-intervention',
      cta: 'Open prompt',
    });
  } else if (latestActivity) {
    actions.push({
      tone: 'active',
      label: 'Auto-detected',
      title: `${latestActivity.name || 'Latest workout'} is in the system`,
      body: 'Threshold imported the session. Add a quick check-in if the workout still feels fresh.',
      href: `/log-intervention?type=Workout+Check-in&activity=${encodeURIComponent(latestActivity.id || '')}&provider=${encodeURIComponent(latestActivity.provider || 'strava')}`,
      cta: 'Add check-in',
    });
  } else {
    actions.push({
      tone: 'setup',
      label: 'Connect data',
      title: 'Connect Strava to reduce manual work',
      body: 'Once activities import automatically, Threshold can queue the right follow-ups instead of making you start from a blank form.',
      href: '/connections',
      cta: 'Open connections',
    });
  }

  const daysUntilRace = daysBetweenNow(currentRace?.event_date || currentRace?.target_race_date);
  if (currentRace && daysUntilRace !== null && daysUntilRace >= 0) {
    if (daysUntilRace <= 21 && daysUntilRace >= 10) {
      actions.push({
        tone: 'race',
        label: `${daysUntilRace} days out`,
        title: 'Race-specific protocols should be locked in',
        body: 'This is the window to finalize heat, fueling, caffeine, bicarb testing, and taper decisions before race week gets noisy.',
        href: '/race-plan',
        cta: 'Open race plan',
      });
    } else if (daysUntilRace <= 9) {
      actions.push({
        tone: 'race',
        label: `${daysUntilRace} days out`,
        title: 'Race week: stop experimenting',
        body: 'Use only protocols you have already tested. Threshold should be tracking execution now, not adding new variables.',
        href: '/race-plan',
        cta: 'Review plan',
      });
    }
  } else {
    actions.push({
      tone: 'setup',
      label: 'Race missing',
      title: 'Set a target race to unlock prep automation',
      body: 'Race date drives the heat block, gut-training ramp, taper, carb-load, and debrief timing.',
      href: '/log-intervention',
      cta: 'Set race',
    });
  }

  const activeAssignments = protocolSummary?.activeAssignments || [];
  const missedProtocol = activeAssignments.find((assignment) => {
    const expected = Number(assignment.expected_entries || 0);
    const actual = Number(assignment.actual_entries || 0);
    return expected > 0 && actual < expected;
  });

  if (missedProtocol) {
    actions.push({
      tone: 'urgent',
      label: 'Protocol gap',
      title: `${missedProtocol.protocol_name || missedProtocol.protocol_type} is behind this week`,
      body: `Logged ${missedProtocol.actual_entries || 0} of ${missedProtocol.expected_entries || 0} expected entries. Adjust the dose or log the completed sessions.`,
      href: `/log-intervention?type=${encodeURIComponent(missedProtocol.protocol_type || '')}&protocol=${encodeURIComponent(missedProtocol.id || '')}`,
      cta: 'Log protocol',
    });
  }

  if (!settings?.hr_zone_3_min || !settings?.sodium_target_mg_per_hr) {
    actions.push({
      tone: 'setup',
      label: 'Personalization',
      title: 'Finish baseline settings',
      body: 'HR zones, sodium targets, and baseline supplements make insights specific to you instead of generic research advice.',
      href: '/settings',
      cta: 'Update settings',
    });
  }

  return actions.slice(0, 4);
}

function TodayActionCard({ action }) {
  const toneClass = {
    urgent: 'border-amber-300 bg-amber-50',
    active: 'border-emerald-200 bg-emerald-50',
    race: 'border-ink/10 bg-white',
    setup: 'border-ink/10 bg-paper',
  }[action.tone] || 'border-ink/10 bg-white';

  return (
    <article className={`rounded-[20px] border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-accent">{action.label}</p>
      <h3 className="mt-2 text-base font-semibold leading-snug text-ink">{action.title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/68">{action.body}</p>
      <a href={action.href} className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper">
        {action.cta}
      </a>
    </article>
  );
}

export default function Dashboard({ previewMode = null, previewData = null }) {
  const router = useRouter();
  const isPreview = Boolean(previewMode && previewData);
  const isFirstLogin = router.query.welcome === '1';
  const coachWelcomeName = typeof router.query.coach_welcome === 'string'
    ? router.query.coach_welcome
    : '';
  const [loading, setLoading] = useState(!isPreview);
  const [athlete, setAthlete] = useState(previewData?.athlete || null);
  const [activities, setActivities] = useState(previewData?.activities || []);
  const [interventions, setInterventions] = useState(previewData?.interventions || []);
  const [interventionCount, setInterventionCount] = useState(previewData?.interventionCount || 0);
  const [settings, setSettings] = useState(previewData?.settings || null);
  const [timeframe, setTimeframe] = useState(30);
  const [metric, setMetric] = useState('mileage');
  const [currentRace, setCurrentRace] = useState(previewData?.currentRace || null);
  const [protocolSummary, setProtocolSummary] = useState(previewData?.protocolSummary || null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(previewData?.unreadMessageCount || 0);
  const [heatmapDay, setHeatmapDay] = useState(null);
  const [activitiesSyncing, setActivitiesSyncing] = useState(false);
  const [followUpPrompts, setFollowUpPrompts] = useState([]);
  const [followUpBusyId, setFollowUpBusyId] = useState('');

  useEffect(() => {
    if (isPreview) {
      setLoading(false);
      setAthlete(previewData.athlete || null);
      setActivities(sortActivitiesMostRecentFirst(previewData.activities || []));
      setInterventions(previewData.interventions || []);
      setInterventionCount(previewData.interventionCount || 0);
      setSettings(previewData.settings || null);
      setCurrentRace(previewData.currentRace || null);
      setProtocolSummary(previewData.protocolSummary || null);
      setUnreadMessageCount(Number(previewData.unreadMessageCount || 0));
      setActivitiesSyncing(false);
      return;
    }

    async function fetchData() {
      try {
        const [meRes, settingsRes, actRes, interventionsRes, protocolRes, promptsRes] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/settings'),
          fetch('/api/activities'),
          fetch('/api/interventions'),
          fetch('/api/current-protocol-assignment'),
          fetch('/api/follow-up-prompts'),
        ]);

        if (meRes.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
          return;
        }

        if (meRes.ok) {
          const me = await meRes.json();
          setAthlete(me.athlete);
          setInterventionCount(me.interventionCount);
          setUnreadMessageCount(Number(me.unreadMessageCount || 0));
        }

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings({ ...settingsData.settings, supplements: settingsData.supplements || [] });
        }

        if (actRes.ok) {
          const actData = await actRes.json();
          setActivities(sortActivitiesMostRecentFirst(actData.activities || []));

          if (actData.hasStravaConnection && actData.needsSync) {
            setActivitiesSyncing(true);
            void fetch('/api/strava/sync', { method: 'POST' })
              .then((response) => (response.ok ? fetch('/api/activities') : null))
              .then(async (response) => {
                if (!response?.ok) return;
                const refreshed = await response.json();
                setActivities(sortActivitiesMostRecentFirst(refreshed.activities || []));
              })
              .catch((error) => {
                console.error('[dashboard] background Strava sync failed:', error);
              })
              .finally(() => {
                setActivitiesSyncing(false);
              });
          }
        }

        if (interventionsRes.ok) {
          const interventionData = await interventionsRes.json();
          setInterventions(interventionData.interventions || []);
        }

        if (protocolRes.ok) {
          const protocolData = await protocolRes.json();
          setProtocolSummary(protocolData);
          setCurrentRace(protocolData.currentRace || null);
        }

        if (promptsRes.ok) {
          const promptData = await promptsRes.json();
          setFollowUpPrompts(promptData.prompts || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isPreview, previewData, router]);

  async function handleDismissFollowUpPrompt(promptId) {
    setFollowUpBusyId(promptId);
    try {
      const response = await fetch('/api/follow-up-prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: promptId,
          status: 'dismissed',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not dismiss prompt.');
      }
      setFollowUpPrompts((current) => current.filter((item) => item.id !== promptId));
    } catch (error) {
      console.error('[dashboard] dismiss follow-up prompt failed:', error);
    } finally {
      setFollowUpBusyId('');
    }
  }
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
  const todayActions = useMemo(
    () =>
      buildTodayActions({
        activities,
        followUpPrompts,
        currentRace,
        protocolSummary,
        settings,
      }),
    [activities, followUpPrompts, currentRace, protocolSummary, settings]
  );
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
      <div className="rounded-[28px] border border-ink/10 bg-white px-6 py-5 text-sm text-ink/70 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
        Redirecting to login...
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

        {isPreview ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-amber-300 bg-amber-50 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-800">Preview Mode</p>
              <p className="mt-1 text-sm text-ink/70">
                Viewing the athlete dashboard with seeded fake data. No real athlete records are being changed.
              </p>
            </div>
            <a href="/admin" className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Back to Admin
            </a>
          </div>
        ) : null}

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

        <section className="mb-8 rounded-[24px] border border-ink/10 bg-white p-5 shadow-warm md:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Today&apos;s Actions</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Threshold noticed these next steps</h2>
            </div>
            <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/60">
              Auto-built from activity, race, and protocol data
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {todayActions.map((action) => (
              <TodayActionCard key={`${action.label}-${action.title}`} action={action} />
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Race Countdown</p>
            <div className="flex items-center gap-2">
              <a href="/messages" className="relative rounded-full border border-ink/10 px-3 py-1 text-xs text-ink/70">
                Messages
                {unreadMessageCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full bg-amber-500" />
                ) : null}
              </a>
              <a href="/log-intervention" className="rounded-full border border-ink/10 px-3 py-1 text-xs text-ink/70">
                Update race
              </a>
            </div>
          </div>
          {currentRace ? (
            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <div className="rounded-[24px] bg-paper p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-accent">Target Race</p>
                <p className="mt-2 text-lg font-semibold text-ink">{currentRace.name}</p>
              </div>
              <div className="rounded-[24px] bg-paper p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-accent">Days Out</p>
                <p className="mt-2 text-lg font-semibold text-ink">
                  {protocolSummary?.daysUntilRace === null || protocolSummary?.daysUntilRace === undefined
                    ? 'Date needed'
                    : `${protocolSummary.daysUntilRace} days`}
                </p>
              </div>
              <div className="rounded-[24px] bg-paper p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-accent">Current Phase</p>
                <p className="mt-2 text-lg font-semibold text-ink">{protocolSummary?.phase || 'Base'}</p>
              </div>
              <div className="rounded-[24px] bg-paper p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-accent">Race Type</p>
                <p className="mt-2 text-lg font-semibold text-ink">{currentRace.race_type || 'Not set'}</p>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[24px] bg-paper p-4 text-sm text-ink/75">
              <p>Set your target race to activate your dashboard.</p>
              <a href="/log-intervention" className="mt-4 inline-flex rounded-full bg-panel px-4 py-2 text-sm font-semibold text-paper">
                Set Target Race
              </a>
            </div>
          )}
          {currentRace ? (
            <div className="mt-4 rounded-[24px] border border-ink/10 bg-[linear-gradient(145deg,#f8f2e8_0%,#eadcc7_48%,#d5bf9f_100%)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-accent">Protocol Context</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {protocolSummary?.protocolStatus || 'No active protocols — log your first intervention'}
              </p>
            </div>
          ) : null}
        </section>

        {protocolSummary?.activeAssignments?.length ? (
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-accent">My Protocols</p>
                <p className="mt-1 text-sm text-ink/60">
                  Active coach-assigned protocols with this week&apos;s instructions and a quick logging shortcut.
                </p>
              </div>
              <a href="/log-intervention" className="ui-button-secondary py-2">
                Log Entry
              </a>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {protocolSummary.activeAssignments.map((protocol) => (
                <article
                  key={protocol.id}
                  id={`protocol-${protocol.id}`}
                  className={`ui-card overflow-hidden ${String(router.query.protocol || '') === protocol.id ? 'ring-2 ring-amber-300' : ''}`}
                >
                  <div className="flex gap-4">
                    <div className={`w-2 shrink-0 rounded-full ${getProtocolStripeClass(protocol.protocol_type)}`} />
                    <div className="flex-1">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.18em] text-accent">{protocol.coach_name}</p>
                          <h2 className="mt-2 text-xl font-semibold text-ink">{protocol.protocol_name}</h2>
                          <p className="mt-1 text-sm text-ink/60">{protocol.protocol_type}</p>
                        </div>
                        <ProtocolComplianceRing value={protocol.compliance} />
                      </div>

                      <div className="mt-5 rounded-[20px] bg-paper p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-accent">Current Week Instructions</p>
                        <p className="mt-2 text-sm font-semibold text-ink">
                          {protocol.current_week_summary || 'No current-week instructions yet.'}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink/42">
                          Week {protocol.current_week} · {protocol.actual_entries}/{protocol.expected_entries || 0} entries
                        </p>
                      </div>

                      <details className="mt-4 rounded-[20px] bg-surface-light p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-ink">
                          View full multi-week plan
                        </summary>
                        <div className="mt-4 space-y-3">
                          {(protocol.instructions?.weekly_blocks || []).map((block) => (
                            <div key={`${protocol.id}-week-${block.week_number}`} className="rounded-[16px] bg-white px-4 py-3">
                              <p className="text-sm font-semibold text-ink">Week {block.week_number}</p>
                              <p className="mt-1 text-sm text-ink/65">{block.instruction_text || 'No instruction text yet.'}</p>
                              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink/42">
                                {block.frequency_per_week ? `${block.frequency_per_week}x/week` : 'Frequency not set'}
                                {block.target_metric ? ` · ${block.target_metric}` : ''}
                              </p>
                            </div>
                          ))}
                        </div>
                      </details>

                      <ProtocolMessages messages={protocol.context_messages || []} />

                      <div className="mt-4 flex flex-wrap gap-3">
                        <a
                          href={`/log-intervention?type=${encodeURIComponent(protocol.protocol_type)}`}
                          className="ui-button-primary py-2"
                        >
                          Log Entry
                        </a>
                        <span className="rounded-full bg-paper px-3 py-2 text-xs font-semibold text-ink/68">
                          {protocol.start_date} to {protocol.end_date}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {followUpPrompts.length ? (
          <section className="mb-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-accent">After Your Latest Activity</p>
                <p className="mt-1 text-sm text-ink/60">
                  Threshold noticed new activity events and queued the next logging step for you.
                </p>
              </div>
              <a href="/notifications" className="ui-button-secondary py-2">
                Open notifications
              </a>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {followUpPrompts.map((prompt) => (
                <FollowUpPromptCard
                  key={prompt.id}
                  prompt={prompt}
                  busy={followUpBusyId === prompt.id}
                  onDismiss={handleDismissFollowUpPrompt}
                />
              ))}
            </div>
          </section>
        ) : null}

        <div className="mb-12 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] xl:items-center">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Training Intelligence Home</p>
              <h1 className="font-display mt-4 max-w-3xl text-4xl leading-tight md:text-6xl xl:text-7xl">
                Welcome back, {athlete.name}
              </h1>
              {currentRace ? (
                <div className="mt-5 flex max-w-3xl flex-wrap gap-3 text-sm text-ink/75">
                  <span className="rounded-full bg-white/60 px-4 py-2 font-semibold text-ink">{currentRace.name}</span>
                  {currentRace.race_type ? (
                    <span className="rounded-full bg-white/60 px-4 py-2 font-semibold text-ink">{currentRace.race_type}</span>
                  ) : null}
                  {currentRace.distance_miles ? (
                    <span className="rounded-full bg-white/60 px-4 py-2 font-semibold text-ink">
                      {Number(currentRace.distance_miles).toFixed(1)} mi
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-8 flex max-w-3xl flex-wrap gap-4">
                <a href={isPreview ? '/log-intervention' : '/log-intervention?type=Workout+Check-in'} className="rounded-full bg-ink px-6 py-3 font-semibold text-paper">
                  📋 Log today's training
                </a>
                <a href="/log-intervention" className="rounded-full border border-ink/20 bg-white/50 px-6 py-3 font-semibold text-ink">
                  Log Intervention
                </a>
                <a href="/insights" className="rounded-full border border-ink/20 bg-white/50 px-6 py-3 font-semibold text-ink">
                  Insights
                </a>
                <a href="/history" className="rounded-full border border-ink/20 bg-white/50 px-6 py-3 font-semibold text-ink">
                  History
                </a>
              </div>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)] xl:justify-self-end xl:w-full xl:max-w-[420px]">
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
            {coachWelcomeName ? (
              <div className="mb-5 rounded-[20px] border border-accent/20 bg-accent/8 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Coach Connected</p>
                <p className="mt-2 text-sm leading-6 text-ink/70">
                  You are now connected to {coachWelcomeName}. They can start assigning protocols and reviewing your progress from their coaching workspace.
                </p>
              </div>
            ) : null}
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
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                {activitiesSyncing ? 'Syncing latest from Strava...' : 'Most Recent First'}
              </span>
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

export async function getServerSideProps(context) {
  const previewMode = typeof context.query.preview === 'string' ? context.query.preview : null;

  if (!previewMode) {
    return { props: {} };
  }

  try {
    const adminContext = await getAdminRequestContext(context.req);
    if (!adminContext.authorized) {
      return {
        redirect: {
          destination: '/dashboard',
          permanent: false,
        },
      };
    }

    const previewData = getDashboardPreview(previewMode);
    if (!previewData) {
      return {
        redirect: {
          destination: '/admin',
          permanent: false,
        },
      };
    }

    return {
      props: {
        previewMode,
        previewData,
      },
    };
  } catch (error) {
    console.error('[dashboard preview] failed:', error);
    return {
      redirect: {
        destination: '/admin',
        permanent: false,
      },
    };
  }
}
