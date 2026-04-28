import { useEffect, useMemo, useState } from 'react';
import DashboardTabs from '../components/DashboardTabs';
import NavMenu from '../components/NavMenu';
import BlurredInsightPreview from '../components/BlurredInsightPreview';
import { sortActivitiesMostRecentFirst } from '../lib/activityInsights';
import { deriveRaceType } from '../lib/raceTypes';
import { canAccessFullInsights } from '../lib/subscriptionTiers';
import { buildTrainingResponseCorrelations, buildCheckInTimeSeries, buildCheckInSummary } from '../lib/trainingInsights';
import { getStoredValue } from '../lib/browserStorage';

const defaultRaceStorageKey = 'threshold-default-race';
const legacyDefaultRaceStorageKey = 'ultraos-default-race';
const MIN_GROUP_SIZE = 3; // mirrors trainingInsights.js threshold for UI messaging

// ─── Intervention-driven insight builders ─────────────────────────────────────

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function buildInterventionInsights(interventions = [], settings = {}, currentRace = null) {
  const cards = [];
  if (interventions.length === 0) return cards;

  // ── 1. Gut training progression ──────────────────────────────────────────
  const gutSessions = interventions
    .filter((i) => i.intervention_type === 'Gut Training' && i.protocol_payload?.carb_actual_g_per_hr)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (gutSessions.length >= 2) {
    const first = parseFloat(gutSessions[0].protocol_payload.carb_actual_g_per_hr);
    const last = parseFloat(gutSessions[gutSessions.length - 1].protocol_payload.carb_actual_g_per_hr);
    const giScores = gutSessions.map((s) => parseFloat(s.protocol_payload.gi_response || s.gi_response || 5)).filter(Boolean);
    const avgGI = giScores.length ? (giScores.reduce((a, b) => a + b, 0) / giScores.length).toFixed(1) : null;
    const trend = last > first ? `up from ${first}g to ${last}g/hr` : last < first ? `down from ${first}g to ${last}g/hr` : `steady at ${last}g/hr`;

    cards.push({
      id: 'gut-progression',
      category: 'Gut Training',
      title: 'Gut training progression',
      body: `Across ${gutSessions.length} logged gut training sessions, your carb tolerance has moved ${trend}. ${avgGI ? `Average GI response: ${avgGI}/10.` : ''} Keep incrementing ~5g/hr per session to close the gap to your race target.`,
      action: { label: 'Log a gut training session', href: '/log-intervention' },
      confidence: gutSessions.length >= 5 ? 'high' : 'moderate',
      dataPoints: gutSessions.length,
    });
  }

  // ── 2. Heat acclimation status ────────────────────────────────────────────
  const heatSessions = interventions.filter((i) =>
    (i.intervention_type === 'Heat Acclimation' || i.intervention_type === 'Sauna - Recovery') &&
    i.date
  );
  const now = new Date();
  const twentyOneDaysAgo = new Date(now);
  twentyOneDaysAgo.setDate(now.getDate() - 21);
  const recentHeatSessions = heatSessions.filter((i) => new Date(`${i.date}T00:00:00`) >= twentyOneDaysAgo);

  if (heatSessions.length >= 3) {
    const sessionCount = recentHeatSessions.length;
    const allTimeCount = heatSessions.length;
    const blockComplete = sessionCount >= 10;

    const avgResponse = heatSessions.length >= 2
      ? (heatSessions
          .map((s) => parseFloat(s.protocol_payload?.response || s.physical_response || 0))
          .filter(Boolean)
          .reduce((a, b, _, arr) => a + b / arr.length, 0)
        ).toFixed(1)
      : null;

    cards.push({
      id: 'heat-acclimation',
      category: 'Heat',
      title: 'Heat acclimation block',
      body: `${allTimeCount} heat sessions logged all-time, ${sessionCount} in the last 21 days. ${blockComplete ? 'A complete heat block is likely underway — plasma volume expansion is in progress.' : `${Math.max(0, 10 - sessionCount)} more sessions to complete a full block.`}${avgResponse ? ` Average physiological response: ${avgResponse}/10.` : ''}`,
      action: blockComplete ? null : { label: 'Log a heat session', href: '/log-intervention' },
      confidence: heatSessions.length >= 8 ? 'high' : 'moderate',
      dataPoints: heatSessions.length,
    });
  }

  // ── 3. Bicarb protocol optimization ──────────────────────────────────────
  const bicarbSessions = interventions.filter((i) =>
    i.intervention_type === 'Sodium Bicarbonate - Loading Protocol' &&
    i.protocol_payload?.performance_feel &&
    i.protocol_payload?.gi_response
  );

  if (bicarbSessions.length >= 3) {
    // Find best performance_feel with lowest gi_response
    const bestTrial = bicarbSessions
      .map((s) => ({
        ...s,
        feel: parseFloat(s.protocol_payload.performance_feel),
        gi: parseFloat(s.protocol_payload.gi_response),
        dose: s.protocol_payload.dose,
        timing: s.protocol_payload.timing_minutes_before_effort,
        delivery: s.protocol_payload.delivery,
      }))
      .filter((s) => s.feel >= 7 && s.gi <= 5)
      .sort((a, b) => b.feel - a.feel || a.gi - b.gi)[0];

    const avgFeel = (bicarbSessions.reduce((sum, s) => sum + parseFloat(s.protocol_payload.performance_feel || 0), 0) / bicarbSessions.length).toFixed(1);
    const avgGI = (bicarbSessions.reduce((sum, s) => sum + parseFloat(s.protocol_payload.gi_response || 0), 0) / bicarbSessions.length).toFixed(1);

    if (bestTrial) {
      cards.push({
        id: 'bicarb-optimization',
        category: 'Supplementation',
        title: 'Bicarb protocol: optimal window found',
        body: `Across ${bicarbSessions.length} trials, your best combo (feel ≥7, GI ≤5) is ${bestTrial.dose || '0.3g/kg'}${bestTrial.timing ? `, ${bestTrial.timing} min before effort` : ''}${bestTrial.delivery ? `, ${bestTrial.delivery}` : ''}. Average across all trials: feel ${avgFeel}/10, GI ${avgGI}/10.`,
        action: null,
        confidence: bicarbSessions.length >= 6 ? 'high' : 'moderate',
        dataPoints: bicarbSessions.length,
      });
    } else {
      cards.push({
        id: 'bicarb-no-sweet-spot',
        category: 'Supplementation',
        title: 'Bicarb protocol: still calibrating',
        body: `${bicarbSessions.length} bicarb trials logged. Average feel: ${avgFeel}/10, GI response: ${avgGI}/10. No trial yet has hit ≥7 feel + ≤5 GI simultaneously — keep experimenting with dose, timing, and delivery format.`,
        action: { label: 'Log a bicarb trial', href: '/log-intervention' },
        confidence: 'low',
        dataPoints: bicarbSessions.length,
      });
    }
  }

  // ── 4. Race readiness snapshot ────────────────────────────────────────────
  if (currentRace?.event_date) {
    const daysLeft = daysUntil(currentRace.event_date);
    if (daysLeft !== null && daysLeft > 0 && daysLeft <= 60) {
      const heatReady = recentHeatSessions.length >= 8;
      const gutReady = gutSessions.length >= 4 && gutSessions.length > 0
        ? parseFloat(gutSessions[gutSessions.length - 1]?.protocol_payload?.carb_actual_g_per_hr || 0) >= 60
        : false;
      const bicarbReady = bicarbSessions.length >= 3;

      const readyItems = [
        heatReady ? '✓ Heat block' : '○ Heat block',
        gutReady ? '✓ Gut training' : '○ Gut training',
        bicarbReady ? '✓ Bicarb calibrated' : '○ Bicarb trials',
      ];

      cards.push({
        id: 'race-readiness',
        category: 'Race Prep',
        title: `${daysLeft} days to ${currentRace.name || 'your race'}`,
        body: `Prep status: ${readyItems.join(' · ')}. ${daysLeft <= 14 ? 'Final two weeks — stop structured gut training and heat sessions 5 days out. Focus on recovery and sleep.' : 'Continue building your prep blocks.'}`,
        action: { label: 'Open Race Blueprint', href: '/race-plan' },
        confidence: 'high',
        dataPoints: interventions.length,
      });
    }
  }

  // ── 5. Sleep vs next-day pattern (if sleep logs exist) ───────────────────
  const sleepLogs = interventions.filter((i) =>
    i.intervention_type === 'Sleep Optimization' &&
    i.protocol_payload?.hours_slept
  );

  if (sleepLogs.length >= 5) {
    const typicalSleep = parseFloat(settings?.typical_sleep_hours || 7.5);
    const shortNights = sleepLogs.filter((s) => parseFloat(s.protocol_payload.hours_slept) < typicalSleep - 0.5);
    const shortPct = Math.round((shortNights.length / sleepLogs.length) * 100);

    cards.push({
      id: 'sleep-pattern',
      category: 'Recovery',
      title: 'Sleep pattern',
      body: `${sleepLogs.length} sleep entries logged. ${shortPct}% of nights are below your ${typicalSleep}hr baseline. ${shortPct >= 40 ? 'Consistent sleep debt signals are present — prioritize sleep extension before high-load weeks.' : 'Sleep quality appears generally adequate.'}`,
      action: shortPct >= 40 ? { label: 'Log a sleep entry', href: '/log-intervention' } : null,
      confidence: sleepLogs.length >= 10 ? 'high' : 'moderate',
      dataPoints: sleepLogs.length,
    });
  }

  return cards;
}

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ level }) {
  if (level === 'high') return (
    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">High confidence</span>
  );
  if (level === 'moderate') return (
    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Building signal</span>
  );
  return (
    <span className="rounded-full bg-ink/6 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/45">Early signal</span>
  );
}

// ─── Category chip ────────────────────────────────────────────────────────────
function CategoryChip({ category }) {
  const colorMap = {
    'Gut Training': 'bg-emerald-50 text-emerald-800',
    'Heat': 'bg-orange-50 text-orange-800',
    'Supplementation': 'bg-blue-50 text-blue-800',
    'Race Prep': 'bg-accent/15 text-amber-900',
    'Recovery': 'bg-purple-50 text-purple-800',
  };
  const cls = colorMap[category] || 'bg-ink/6 text-ink/60';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {category}
    </span>
  );
}

export default function InsightsPage() {
  const [athlete, setAthlete] = useState(null);
  const [activities, setActivities] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [interventionCount, setInterventionCount] = useState(0);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentRace, setCurrentRace] = useState(null);
  const [insightsAllowed, setInsightsAllowed] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
          const me = await meRes.json();
          setAthlete(me.athlete);
          setInterventionCount(me.interventionCount || 0);
          setInsightsAllowed(canAccessFullInsights(me.athlete).allowed);
        }

        const settingsRes = await fetch('/api/settings');
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setSettings({ ...data.settings, supplements: data.supplements || [] });
        }

        const activitiesRes = await fetch('/api/activities');
        if (activitiesRes.ok) {
          const data = await activitiesRes.json();
          setActivities(sortActivitiesMostRecentFirst(data.activities || []));
        }

        const interventionsRes = await fetch('/api/interventions');
        if (interventionsRes.ok) {
          const data = await interventionsRes.json();
          setInterventions(data.interventions || []);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = getStoredValue(defaultRaceStorageKey, legacyDefaultRaceStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed?.target_race) return;
      setCurrentRace({
        name: parsed.target_race,
        event_date: parsed.target_race_date,
        race_type: parsed.race_type || deriveRaceType(parsed.race_profile?.distance_miles, parsed.race_profile?.surface),
      });
    } catch {
      setCurrentRace(null);
    }
  }, []);

  const cards = useMemo(
    () => buildInterventionInsights(interventions, settings || {}, currentRace),
    [interventions, settings, currentRace]
  );

  const trainingCorrelationData = useMemo(
    () => buildTrainingResponseCorrelations(interventions),
    [interventions]
  );

  const checkInTimeSeries = useMemo(
    () => buildCheckInTimeSeries(interventions, 20),
    [interventions]
  );

  const checkInSummary = useMemo(
    () => buildCheckInSummary(interventions),
    [interventions]
  );

  const navLinks = [
    { href: '/dashboard', label: 'Threshold Home' },
    { href: '/guide', label: 'Guide' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/explorer', label: 'Explorer' },
    { href: '/history', label: 'Intervention History' },
  ];

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Insights</p>
          <NavMenu label="Insights navigation" links={navLinks} primaryLink={{ href: '/dashboard', label: 'Home', variant: 'secondary' }} />
        </div>

        <DashboardTabs
          activeHref="/insights"
          tabs={[
            { href: '/insights', label: 'Insights' },
            { href: '/explorer', label: 'Explorer' },
            { href: '/guide', label: 'Guide' },
            { href: '/pricing', label: 'Pricing' },
          ]}
        />

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(145deg,#f8f2e8_0%,#eadcc7_48%,#d5bf9f_100%)] p-6 md:p-10">
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Insights</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">
            {athlete ? `${athlete.name}'s insights` : 'Insights'}
          </h1>
          {currentRace ? (
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-ink/75">
              <span className="rounded-full bg-white/60 px-4 py-2 font-semibold text-ink">{currentRace.name}</span>
              {currentRace.race_type ? (
                <span className="rounded-full bg-white/60 px-4 py-2 font-semibold text-ink">{currentRace.race_type}</span>
              ) : null}
              {currentRace.event_date ? (
                <span className="rounded-full bg-white/60 px-4 py-2 font-semibold text-ink">{currentRace.event_date}</span>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="mt-12 grid gap-4 lg:grid-cols-2">
          {!loading && !insightsAllowed ? (
            <div className="lg:col-span-2">
              <BlurredInsightPreview body="The free tier lets you collect the data. Upgrade to Individual to unlock the full correlation engine and insight cards." />
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-[28px] border border-ink/10 bg-white p-6 text-sm text-ink/70 lg:col-span-2">
              Loading insights…
            </div>
          ) : null}

          {!loading && insightsAllowed && cards.length > 0
            ? cards.map((card) => (
                <article key={card.id} className="flex flex-col rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryChip category={card.category} />
                    <ConfidenceBadge level={card.confidence} />
                    {card.dataPoints ? (
                      <span className="ml-auto text-xs text-ink/35">{card.dataPoints} data point{card.dataPoints !== 1 ? 's' : ''}</span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-base font-semibold text-ink">{card.title}</p>
                  <p className="mt-2 text-sm leading-7 text-ink/70">{card.body}</p>
                  {card.action ? (
                    <a
                      href={card.action.href}
                      className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-ink/10 bg-paper px-4 py-2 text-xs font-semibold text-ink transition hover:bg-white"
                    >
                      {card.action.label} &rarr;
                    </a>
                  ) : null}
                </article>
              ))
            : null}

          {/* Empty state / progress toward first insight */}
          {!loading && insightsAllowed && cards.length === 0 ? (
            <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)] lg:col-span-2">
              <p className="text-sm uppercase tracking-[0.22em] text-accent">Building your dataset</p>
              <p className="mt-4 text-lg font-semibold text-ink">
                {interventionCount > 0
                  ? `${interventionCount} intervention${interventionCount === 1 ? '' : 's'} logged`
                  : 'Log your first intervention to start building your protocol history'}
              </p>
              {interventionCount > 0 && (
                <p className="mt-1 text-sm text-ink/55">
                  Insights unlock when you have 2+ sessions of the same type with response data. Try logging gut training, heat sessions, or bicarb trials.
                </p>
              )}
              <div className="mt-5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
                  <div
                    className="h-2 rounded-full bg-accent transition-all"
                    style={{ width: `${Math.min(100, (interventionCount / 10) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-ink/50">{Math.min(interventionCount, 10)} / 10 interventions</p>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { emoji: '🔥', label: 'Heat / Sauna', sub: '3+ sessions to unlock heat block insight' },
                  { emoji: '🥤', label: 'Gut Training', sub: '2+ sessions with carb data to unlock trend' },
                  { emoji: '🧪', label: 'Bicarb', sub: '3+ trials to find your optimal dose' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[18px] border border-ink/8 bg-paper p-4">
                    <span className="text-xl">{item.emoji}</span>
                    <p className="mt-2 text-sm font-semibold text-ink">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-ink/50">{item.sub}</p>
                  </div>
                ))}
              </div>
              <a
                href="/log-intervention"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper"
              >
                Log an intervention &rarr;
              </a>
            </div>
          ) : null}
        </section>

        {/* ── Training Response Correlation Section ───────────────────── */}
        <section className="mt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Training Response</p>
              <h2 className="font-display mt-1 text-3xl font-semibold text-ink">What moves your training quality?</h2>
              <p className="mt-2 text-sm leading-6 text-ink/55 max-w-2xl">
                Every time you log a Workout Check-in, Threshold compares it against interventions from the prior 48 hours. Patterns emerge automatically — no manual tagging.
              </p>
            </div>
            <a
              href="/log-intervention?type=Workout+Check-in"
              className="shrink-0 rounded-full border border-ink/10 bg-white px-4 py-2.5 text-xs font-semibold text-ink shadow-sm transition hover:bg-paper"
            >
              Log check-in →
            </a>
          </div>

          {/* Check-in summary strip */}
          {!loading && insightsAllowed && checkInSummary ? (
            <div className="mb-5 grid gap-3 sm:grid-cols-4">
              {[
                { label: 'Check-ins logged', value: checkInSummary.count },
                { label: 'Avg legs feel', value: checkInSummary.avgLegs ? `${checkInSummary.avgLegs}/10` : '—' },
                { label: 'Avg energy', value: checkInSummary.avgEnergy ? `${checkInSummary.avgEnergy}/10` : '—' },
                {
                  label: '7-day trend',
                  value: checkInSummary.legsTrend !== null
                    ? `${checkInSummary.legsTrend > 0 ? '+' : ''}${checkInSummary.legsTrend}`
                    : '—',
                  highlight: checkInSummary.legsTrend !== null && checkInSummary.legsTrend !== 0,
                  positive: checkInSummary.legsTrend > 0,
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[22px] border border-ink/10 bg-white px-5 py-4 shadow-[0_4px_16px_rgba(19,24,22,0.05)]">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">{stat.label}</p>
                  <p className={`mt-1.5 font-mono text-2xl font-semibold ${
                    stat.highlight ? (stat.positive ? 'text-emerald-600' : 'text-red-500') : 'text-ink'
                  }`}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {/* Sparkline time series */}
          {!loading && insightsAllowed && checkInTimeSeries.length >= 3 ? (
            <div className="mb-5 rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
              <p className="mb-4 text-xs uppercase tracking-[0.22em] text-accent">Legs feel over time</p>
              <div className="flex items-end gap-1 h-16">
                {checkInTimeSeries.map((pt, i) => {
                  const score = pt.legsScore || 0;
                  const heightPct = score > 0 ? Math.round((score / 10) * 100) : 4;
                  const isRecent = i >= checkInTimeSeries.length - 3;
                  return (
                    <div key={i} className="group relative flex-1" title={`${pt.date}: ${score ? `${score}/10` : '—'} ${pt.sessionType}`}>
                      <div
                        className={`rounded-t-sm transition-all ${
                          score >= 8 ? 'bg-emerald-400' :
                          score >= 6 ? 'bg-accent' :
                          score >= 4 ? 'bg-amber-300' :
                          score > 0 ? 'bg-red-300' : 'bg-ink/10'
                        } ${isRecent ? 'opacity-100' : 'opacity-60'}`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-ink/30">
                <span>{checkInTimeSeries[0]?.date}</span>
                <span>≥8 great · ≥6 good · &lt;4 rough</span>
                <span>today</span>
              </div>
            </div>
          ) : null}

          {/* Correlation cards */}
          {!loading && insightsAllowed && trainingCorrelationData.correlations?.length > 0 ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {trainingCorrelationData.correlations.map((corr) => {
                  // Determine secondary metric: show if both have signal and secondary delta ≥ 0.4
                  const secondaryMetric = corr.metric === 'legs' ? 'energy' : 'legs';
                  const secondaryDelta = corr.metric === 'legs' ? corr.energyDelta : corr.legsDelta;
                  const secondaryWith = corr.metric === 'legs' ? corr.avgEnergyWithType : corr.avgLegsWithType;
                  const secondaryWithout = corr.metric === 'legs' ? corr.avgEnergyWithoutType : corr.avgLegsWithoutType;
                  const showSecondary = secondaryDelta !== null && Math.abs(secondaryDelta) >= 0.4
                    && secondaryWith !== null && secondaryWithout !== null;

                  return (
                    <article key={corr.id} className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          corr.positive ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
                        }`}>
                          {corr.positive ? `+${corr.deltaAbs} pts` : `−${corr.deltaAbs} pts`}
                        </span>
                        <ConfidenceBadge level={corr.confidence} />
                        <span className="ml-auto text-xs text-ink/35">{corr.dataPoints} sessions</span>
                      </div>

                      <p className="mt-3 text-base font-semibold text-ink">{corr.interventionType}</p>
                      <p className="mt-1 text-xs text-ink/50">
                        {corr.metric === 'legs' ? 'Legs feel' : 'Energy level'} correlation · 48hr window
                      </p>

                      {/* Primary metric comparison bars */}
                      <div className="mt-4 space-y-2">
                        <div>
                          <div className="flex items-center justify-between text-xs text-ink/55">
                            <span>With {corr.interventionType}</span>
                            <span className="font-mono font-semibold text-ink">{corr.avgWith}/10</span>
                          </div>
                          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-paper">
                            <div
                              className={`h-2.5 rounded-full ${corr.positive ? 'bg-emerald-400' : 'bg-accent'}`}
                              style={{ width: `${(corr.avgWith / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-xs text-ink/55">
                            <span>Without</span>
                            <span className="font-mono font-semibold text-ink">{corr.avgWithout}/10</span>
                          </div>
                          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-paper">
                            <div
                              className="h-2.5 rounded-full bg-ink/20"
                              style={{ width: `${(corr.avgWithout / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Secondary metric (when both signals are present) */}
                      {showSecondary ? (
                        <div className="mt-3 rounded-[14px] bg-paper p-3">
                          <p className="mb-2 text-[10px] uppercase tracking-wide text-ink/40">
                            Also: {secondaryMetric === 'legs' ? 'legs feel' : 'energy level'}
                            {secondaryDelta > 0 ? ` +${Math.abs(secondaryDelta)}` : ` −${Math.abs(secondaryDelta)}`} pts
                          </p>
                          <div className="space-y-1.5">
                            <div>
                              <div className="flex items-center justify-between text-[10px] text-ink/45">
                                <span>With</span>
                                <span className="font-mono">{secondaryWith}/10</span>
                              </div>
                              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-white">
                                <div
                                  className={`h-1.5 rounded-full ${secondaryDelta > 0 ? 'bg-emerald-300' : 'bg-amber-400'}`}
                                  style={{ width: `${(secondaryWith / 10) * 100}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-[10px] text-ink/45">
                                <span>Without</span>
                                <span className="font-mono">{secondaryWithout}/10</span>
                              </div>
                              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-white">
                                <div className="h-1.5 rounded-full bg-ink/15" style={{ width: `${(secondaryWithout / 10) * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <p className="mt-4 text-xs leading-5 text-ink/55">{corr.narrative}</p>
                    </article>
                  );
                })}
              </div>
              {/* Keep logging nudge */}
              <div className="mt-4 flex items-center justify-between rounded-[18px] border border-ink/8 bg-paper px-5 py-3.5">
                <p className="text-xs text-ink/55">
                  {trainingCorrelationData.checkInCount < 10
                    ? `${trainingCorrelationData.checkInCount} check-ins logged — more data sharpens every signal`
                    : `${trainingCorrelationData.checkInCount} check-ins powering these patterns`}
                </p>
                <a
                  href="/log-intervention?type=Workout+Check-in"
                  className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper transition hover:bg-ink/80"
                >
                  Log today's check-in →
                </a>
              </div>
            </>
          ) : null}

          {/* Progress toward first correlation */}
          {!loading && insightsAllowed && (!trainingCorrelationData.correlations || trainingCorrelationData.correlations.length === 0) ? (
            <div className="rounded-[28px] border border-dashed border-ink/15 bg-white/50 p-8">
              <p className="text-sm font-semibold text-ink">
                {trainingCorrelationData.checkInCount === 0
                  ? 'No Workout Check-ins logged yet'
                  : `${trainingCorrelationData.checkInCount} check-in${trainingCorrelationData.checkInCount !== 1 ? 's' : ''} logged`}
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/55">
                {trainingCorrelationData.needsMore > 0
                  ? `${trainingCorrelationData.needsMore} more Workout Check-in${trainingCorrelationData.needsMore !== 1 ? 's' : ''} needed before correlations can surface. Log check-ins after easy days, hard sessions, and recovery days.`
                  : 'Log more check-ins alongside different interventions to build a comparison group. Foam roll some days, skip it others — the pattern will emerge.'}
              </p>
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
                  <div
                    className="h-2 rounded-full bg-accent transition-all"
                    style={{ width: `${Math.min(100, ((trainingCorrelationData.checkInCount || 0) / (MIN_GROUP_SIZE * 2)) * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-ink/40">
                  {trainingCorrelationData.checkInCount || 0} / {MIN_GROUP_SIZE * 2} check-ins to unlock first correlation
                </p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { emoji: '🌀', label: 'Foam Rolling', sub: 'Do it some days, skip others — let data decide' },
                  { emoji: '🧖', label: 'Sauna / Recovery', sub: 'Does the post-sauna run feel better?' },
                  { emoji: '🧊', label: 'Cold Immersion', sub: 'Ice bath → next-day training response?' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[18px] border border-ink/8 bg-paper p-4">
                    <span className="text-xl">{item.emoji}</span>
                    <p className="mt-2 text-sm font-semibold text-ink">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-ink/50">{item.sub}</p>
                  </div>
                ))}
              </div>
              <a
                href="/log-intervention?type=Workout+Check-in"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper"
              >
                Log a Workout Check-in →
              </a>
            </div>
          ) : null}
        </section>

      </div>
    </main>
  );
}
