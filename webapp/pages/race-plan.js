import { useEffect, useMemo, useState } from 'react';
import NavMenu from '../components/NavMenu';

// ─── Fueling targets by race type ────────────────────────────────────────────
const RACE_FUELING = {
  '1 Mile / 1500m': { target: 0, range: '0', note: 'No fueling needed at this distance.' },
  '3K / 5K':        { target: 0, range: '0', note: 'No fueling needed at this distance.' },
  '10K':            { target: 20, range: '0–30', note: 'One gel optional. Energy depletion is not a limiter.' },
  'Half Marathon':  { target: 45, range: '30–60', note: 'One to two gels. GI risk is low at this duration.' },
  'Marathon':       { target: 80, range: '60–90', note: 'Gut training is the difference-maker here. Most DNFs are fueling-related.' },
  '50K+':           { target: 70, range: '60–80', note: 'Gut tolerance is the ceiling, not the target. Build to 80+ across a training block.' },
  'Gravel':         { target: 60, range: '50–80', note: 'Dependent on duration. Treat like a marathon if >4 hrs.' },
  'Triathlon':      { target: 70, range: '60–90', note: 'Front-load carbs on the bike. Run fueling is typically limited.' },
  'Other':          { target: 60, range: '40–80', note: 'Estimate based on expected race duration and gut tolerance.' },
};

// ─── Heat acclimation benchmarks ─────────────────────────────────────────────
const HEAT_BLOCK_TARGET = 10; // sessions in 21-day window
const HEAT_TEMP_THRESHOLD_F = 65; // below this, heat block is low-priority

// ─── Helper: days until a date ───────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

// ─── Helper: format a date as "Mon D" ────────────────────────────────────────
function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Add/subtract days from a date string ────────────────────────────────────
function shiftDate(dateStr, days) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ─── Build the pre-race intervention timeline ─────────────────────────────────
function buildTimeline({ raceDate, daysLeft, heatSessionsDone, useHeat, useBicarb, useCaffeine, expectedTempF, gutGapG }) {
  const items = [];
  if (!raceDate || daysLeft === null) return items;

  // Heat block
  if (useHeat && Number(expectedTempF) >= HEAT_TEMP_THRESHOLD_F) {
    const heatRemaining = Math.max(0, HEAT_BLOCK_TARGET - Number(heatSessionsDone || 0));
    if (heatRemaining > 0 && daysLeft >= 7) {
      const windowEnd = shiftDate(raceDate, -5);
      items.push({
        label: `Complete heat block`,
        detail: `${heatRemaining} session${heatRemaining !== 1 ? 's' : ''} remaining — finish by ${formatShortDate(windowEnd)} (5+ days before race)`,
        daysOut: Math.min(daysLeft - 5, 21),
        status: daysLeft < 5 ? 'overdue' : heatRemaining === 0 ? 'done' : 'pending',
        icon: '🔥',
      });
    } else if (heatRemaining === 0) {
      items.push({
        label: 'Heat block complete',
        detail: `${Number(heatSessionsDone)} sessions logged — plasma volume expansion is underway.`,
        daysOut: null,
        status: 'done',
        icon: '🔥',
      });
    }
  }

  // Gut training
  if (gutGapG > 15 && daysLeft >= 14) {
    const sessionsNeeded = Math.ceil(gutGapG / 5);
    items.push({
      label: 'Continue gut training',
      detail: `~${sessionsNeeded} more session${sessionsNeeded !== 1 ? 's' : ''} to close the ${gutGapG}g/hr gap. Stop structured gut training 5 days out.`,
      daysOut: daysLeft - 5,
      status: 'pending',
      icon: '🥤',
    });
  } else if (gutGapG <= 15 && gutGapG > 0) {
    items.push({
      label: 'Gut training: nearly there',
      detail: `${gutGapG}g/hr gap is within normal race-day variance. One or two more sessions is sufficient.`,
      daysOut: daysLeft > 10 ? daysLeft - 5 : null,
      status: 'pending',
      icon: '🥤',
    });
  }

  // Caffeine taper
  if (useCaffeine && daysLeft >= 6) {
    const taperStart = shiftDate(raceDate, -7);
    items.push({
      label: 'Begin caffeine taper',
      detail: `Cut caffeine 5–7 days before race (${formatShortDate(taperStart)}) to restore receptor sensitivity. Race-day dose is most effective after a withdrawal period.`,
      daysOut: 7,
      status: daysLeft <= 7 ? 'now' : 'upcoming',
      icon: '☕',
    });
  }

  // Bicarb practice run
  if (useBicarb && daysLeft >= 8) {
    items.push({
      label: 'Bicarb protocol test run',
      detail: `Log one full-dose trial 7–10 days before race. Confirm timing, delivery format, and GI response before race week.`,
      daysOut: 10,
      status: daysLeft <= 10 ? 'now' : 'upcoming',
      icon: '🧪',
    });
  }

  // Race week — carb loading
  if (daysLeft <= 7 && daysLeft > 0) {
    items.push({
      label: 'Carb loading phase',
      detail: `Increase daily carb intake to 8–10g/kg for 2–3 days (for marathon+). Focus on low-fiber, easily digestible sources.`,
      daysOut: 3,
      status: daysLeft <= 3 ? 'now' : 'upcoming',
      icon: '🍝',
    });
  }

  // Race morning
  if (daysLeft <= 3 && daysLeft > 0) {
    if (useBicarb) {
      items.push({
        label: 'Race morning: bicarb',
        detail: `Take bicarb 90–120 min before gun. Have a backup plan if GI discomfort appears — reduce to 0.2g/kg.`,
        daysOut: 0,
        status: 'upcoming',
        icon: '🧪',
      });
    }
    if (useCaffeine) {
      items.push({
        label: 'Race morning: caffeine',
        detail: `Take caffeine dose 45–60 min before start. After a 5-7 day taper this will hit harder than your training baseline.`,
        daysOut: 0,
        status: 'upcoming',
        icon: '☕',
      });
    }
  }

  // Sort: overdue first, then by daysOut ascending
  return items.sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (b.status === 'done' && a.status !== 'done') return -1;
    const aD = a.daysOut ?? 999;
    const bD = b.daysOut ?? 999;
    return aD - bD;
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'done') return (
    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Done</span>
  );
  if (status === 'overdue') return (
    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">Overdue</span>
  );
  if (status === 'now') return (
    <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Act now</span>
  );
  return (
    <span className="rounded-full bg-ink/6 px-2.5 py-0.5 text-xs font-semibold text-ink/50">Upcoming</span>
  );
}

// ─── Output card ──────────────────────────────────────────────────────────────
function BlueprintCard({ title, children, accent }) {
  return (
    <div className={`rounded-[24px] border ${accent ? 'border-accent/30 bg-accent/6' : 'border-ink/10 bg-white'} p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]`}>
      <p className="text-xs uppercase tracking-[0.28em] text-accent">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

// ─── Stat row ─────────────────────────────────────────────────────────────────
function StatRow({ label, value, sub }) {
  return (
    <div className="flex items-baseline justify-between border-b border-ink/6 py-3 last:border-0">
      <span className="text-sm text-ink/65">{label}</span>
      <span className="text-right">
        <span className="font-mono text-base font-semibold text-ink">{value}</span>
        {sub ? <span className="ml-1.5 text-xs text-ink/45">{sub}</span> : null}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RacePlanPage() {
  const navLinks = [
    { href: '/dashboard', label: 'UltraOS Home' },
    { href: '/guide', label: 'Guide' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/log-intervention', label: 'Log Intervention' },
  ];

  // Form state
  const [form, setForm] = useState({
    raceName: '',
    raceDate: '',
    raceType: 'Marathon',
    distanceMiles: '',
    expectedTempF: '',
    predictedFinishH: '',
    predictedFinishM: '',
    currentGutBaselineG: '',
    heatSessionsDone: '',
    trainingPhase: 'Build',
    useBicarb: false,
    useCaffeine: true,
    useHeat: false,
    bodyWeightLb: '',
    z2CeilingBpm: '',
  });

  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Load race from localStorage + settings from API
  useEffect(() => {
    // Pre-fill from saved race context (format: { target_race, target_race_date, race_type, race_profile })
    try {
      const saved = localStorage.getItem('ultraos-default-race');
      if (saved) {
        const race = JSON.parse(saved);
        const profile = race.race_profile || {};
        setForm((prev) => ({
          ...prev,
          raceName: race.target_race || profile.name || '',
          raceDate: race.target_race_date || profile.event_date || '',
          raceType: race.race_type || profile.race_type || 'Marathon',
          distanceMiles: profile.distance_miles ? String(profile.distance_miles) : '',
        }));
      }
    } catch (_) {}

    // Pre-fill from athlete settings
    fetch('/api/settings')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.settings) return;
        const s = data.settings;
        setForm((prev) => ({
          ...prev,
          bodyWeightLb: s.body_weight_lb ? String(s.body_weight_lb) : prev.bodyWeightLb,
          z2CeilingBpm: s.hr_zone_2_max ? String(s.hr_zone_2_max) : prev.z2CeilingBpm,
          currentGutBaselineG: s.normal_long_run_carb_g_per_hr ? String(s.normal_long_run_carb_g_per_hr) : prev.currentGutBaselineG,
        }));
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setGenerated(false);
  }

  // ─── Derived calculations (memoized) ───────────────────────────────────────
  const blueprint = useMemo(() => {
    const daysLeft = daysUntil(form.raceDate);
    const fueling = RACE_FUELING[form.raceType] || RACE_FUELING['Other'];
    const targetCarbG = fueling.target;
    const currentGut = parseFloat(form.currentGutBaselineG) || 0;
    const gutGapG = Math.max(0, targetCarbG - currentGut);
    const gutSessions = gutGapG > 5 ? Math.ceil(gutGapG / 5) : 0;

    // Finish time in hours
    const finishH = parseFloat(form.predictedFinishH) || 0;
    const finishM = parseFloat(form.predictedFinishM) || 0;
    const finishHours = finishH + finishM / 60;

    // Total carbs needed
    const totalCarbsG = finishHours > 0 && targetCarbG > 0 ? Math.round(targetCarbG * finishHours) : null;

    // Bicarb dose
    const weightKg = form.bodyWeightLb ? parseFloat(form.bodyWeightLb) * 0.453592 : null;
    const bicarbDoseG = weightKg ? (weightKg * 0.3).toFixed(1) : null;
    const caffeineDoseMg = weightKg ? Math.round(weightKg * 4) : null;

    // Hydration (if we have sweat rate from settings — we'll estimate 750ml/hr otherwise)
    const approxFluidMlPerHr = 700;
    const totalFluidL = finishHours > 0 ? ((approxFluidMlPerHr * finishHours) / 1000).toFixed(1) : null;

    // Heat priority
    const heatDone = parseInt(form.heatSessionsDone) || 0;
    const heatRemaining = Math.max(0, HEAT_BLOCK_TARGET - heatDone);
    const heatComplete = heatDone >= HEAT_BLOCK_TARGET;
    const raceIsHot = parseFloat(form.expectedTempF) >= HEAT_TEMP_THRESHOLD_F;

    // Timeline
    const timeline = buildTimeline({
      raceDate: form.raceDate,
      daysLeft,
      heatSessionsDone: form.heatSessionsDone,
      useHeat: form.useHeat,
      useBicarb: form.useBicarb,
      useCaffeine: form.useCaffeine,
      expectedTempF: form.expectedTempF,
      gutGapG,
    });

    return {
      daysLeft,
      fueling,
      targetCarbG,
      currentGut,
      gutGapG,
      gutSessions,
      finishHours,
      totalCarbsG,
      bicarbDoseG,
      caffeineDoseMg,
      totalFluidL,
      heatDone,
      heatRemaining,
      heatComplete,
      raceIsHot,
      timeline,
    };
  }, [form]);

  const hasEnoughToGenerate = form.raceType && (form.raceDate || form.currentGutBaselineG || form.predictedFinishH);

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">

        {/* ── Header bar ─────────────────────────────────────── */}
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Race Blueprint</p>
          <NavMenu
            label="Race plan navigation"
            links={navLinks}
            primaryLink={{ href: '/log-intervention', label: 'Log Intervention', variant: 'secondary' }}
          />
        </div>

        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(145deg,#eee7dc_0%,#d8c7b2_48%,#8e7354_100%)] p-6 md:p-10">
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Race Architecture Builder</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Your race,<br />your blueprint.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-ink/70">
            Enter your race details and current training state. The builder generates a personalized fueling plan, hydration targets, and a pre-race intervention timeline — all from your logged data.
          </p>
        </section>

        {/* ── Main grid ──────────────────────────────────────── */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[420px_1fr]">

          {/* ── LEFT: Input form ─────────────────────────────── */}
          <div className="space-y-5">

            {/* Race info */}
            <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Race Details</p>
              <div className="mt-4 space-y-4">

                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Race name</label>
                  <input
                    type="text"
                    name="raceName"
                    value={form.raceName}
                    onChange={handleChange}
                    placeholder="e.g. Western States 100"
                    className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-ink">Race date</label>
                    <input
                      type="date"
                      name="raceDate"
                      value={form.raceDate}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-ink">Race type</label>
                    <select
                      name="raceType"
                      value={form.raceType}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      {Object.keys(RACE_FUELING).map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Expected race temperature (°F)</label>
                  <input
                    type="number"
                    name="expectedTempF"
                    value={form.expectedTempF}
                    onChange={handleChange}
                    placeholder="e.g. 72"
                    className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Predicted finish time</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="predictedFinishH"
                      value={form.predictedFinishH}
                      onChange={handleChange}
                      placeholder="hrs"
                      min="0"
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    <span className="shrink-0 text-sm text-ink/40">h</span>
                    <input
                      type="number"
                      name="predictedFinishM"
                      value={form.predictedFinishM}
                      onChange={handleChange}
                      placeholder="min"
                      min="0"
                      max="59"
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    <span className="shrink-0 text-sm text-ink/40">m</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Current training state */}
            <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Current Training State</p>
              {!settingsLoaded && (
                <p className="mt-2 text-xs text-ink/40">Loading your athlete profile…</p>
              )}
              <div className="mt-4 space-y-4">

                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">
                    Gut training baseline
                    <span className="ml-1 font-normal text-ink/45">(g carb/hr currently tolerated)</span>
                  </label>
                  <input
                    type="number"
                    name="currentGutBaselineG"
                    value={form.currentGutBaselineG}
                    onChange={handleChange}
                    placeholder="e.g. 60"
                    className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-ink">Body weight (lb)</label>
                    <input
                      type="number"
                      name="bodyWeightLb"
                      value={form.bodyWeightLb}
                      onChange={handleChange}
                      placeholder="lbs"
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-ink">Training phase</label>
                    <select
                      name="trainingPhase"
                      value={form.trainingPhase}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      {['Base', 'Build', 'Peak', 'Taper'].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>
            </div>

            {/* Interventions */}
            <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Planned Interventions</p>
              <div className="mt-4 space-y-4">

                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">
                    Heat sessions completed
                    <span className="ml-1 font-normal text-ink/45">(in last 21 days)</span>
                  </label>
                  <input
                    type="number"
                    name="heatSessionsDone"
                    value={form.heatSessionsDone}
                    onChange={handleChange}
                    placeholder="e.g. 5"
                    min="0"
                    className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>

                <div className="space-y-2.5">
                  {[
                    { name: 'useHeat', label: 'Heat acclimation block', sub: 'Sauna / hot bath sessions' },
                    { name: 'useBicarb', label: 'Sodium bicarbonate', sub: 'Loading protocol on race morning' },
                    { name: 'useCaffeine', label: 'Caffeine strategy', sub: '5-day taper + race-day dose' },
                  ].map((opt) => (
                    <label key={opt.name} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-ink/8 bg-paper px-4 py-3 hover:bg-white">
                      <input
                        type="checkbox"
                        name={opt.name}
                        checked={form[opt.name]}
                        onChange={handleChange}
                        className="h-4 w-4 accent-ink"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-ink">{opt.label}</span>
                        <span className="block text-xs text-ink/45">{opt.sub}</span>
                      </span>
                    </label>
                  ))}
                </div>

              </div>
            </div>

            <button
              onClick={() => setGenerated(true)}
              disabled={!hasEnoughToGenerate}
              className="w-full rounded-full bg-ink py-4 text-sm font-semibold text-paper shadow-[0_4px_16px_rgba(19,24,22,0.2)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Generate Race Blueprint →
            </button>

          </div>

          {/* ── RIGHT: Blueprint output ───────────────────────── */}
          <div className="space-y-5">

            {!generated ? (
              <div className="flex h-full min-h-[300px] items-center justify-center rounded-[28px] border border-dashed border-ink/15 bg-white/40 p-10 text-center">
                <div>
                  <p className="text-2xl">🗺️</p>
                  <p className="mt-3 font-semibold text-ink">Your blueprint will appear here</p>
                  <p className="mt-2 text-sm leading-6 text-ink/50">Fill in your race details and training state, then click Generate.</p>
                </div>
              </div>
            ) : (
              <>
                {/* ── Race summary pill ──── */}
                {(form.raceName || form.raceDate) && (
                  <div className="flex items-center gap-4 rounded-full border border-ink/10 bg-white px-5 py-3">
                    <span className="text-lg">📍</span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{form.raceName || form.raceType}</p>
                      {blueprint.daysLeft !== null && (
                        <p className="text-xs text-ink/50">
                          {blueprint.daysLeft > 0
                            ? `${blueprint.daysLeft} day${blueprint.daysLeft !== 1 ? 's' : ''} out · ${formatShortDate(form.raceDate)}`
                            : blueprint.daysLeft === 0
                            ? 'Race day!'
                            : 'Race date has passed'}
                        </p>
                      )}
                    </div>
                    <span className="ml-auto shrink-0 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-amber-800">
                      {form.trainingPhase} phase
                    </span>
                  </div>
                )}

                {/* ── Fueling Blueprint ─── */}
                <BlueprintCard title="Fueling Blueprint" accent>
                  <StatRow
                    label="Race-day carb target"
                    value={`${blueprint.targetCarbG}g / hr`}
                    sub={`range: ${blueprint.fueling.range}g/hr`}
                  />
                  <StatRow
                    label="Current gut baseline"
                    value={blueprint.currentGut > 0 ? `${blueprint.currentGut}g / hr` : '—'}
                    sub="from your log / settings"
                  />
                  <StatRow
                    label="Training gap to close"
                    value={blueprint.gutGapG > 0 ? `${blueprint.gutGapG}g / hr` : 'None'}
                    sub={blueprint.gutSessions > 0 ? `≈ ${blueprint.gutSessions} more gut training sessions` : ''}
                  />
                  {blueprint.totalCarbsG && (
                    <StatRow
                      label="Total carbs to carry"
                      value={`~${blueprint.totalCarbsG}g`}
                      sub={`for ${blueprint.finishHours.toFixed(1)}h finish`}
                    />
                  )}
                  <p className="mt-4 text-xs leading-5 text-ink/55">{blueprint.fueling.note}</p>
                </BlueprintCard>

                {/* ── Hydration & Electrolytes ─── */}
                <BlueprintCard title="Hydration & Electrolytes">
                  <StatRow
                    label="Estimated fluid intake"
                    value={blueprint.totalFluidL ? `~${blueprint.totalFluidL}L` : '—'}
                    sub="~700ml/hr · update in Settings for precision"
                  />
                  <StatRow
                    label="Start drinking"
                    value="From gun"
                    sub="Don't wait for thirst — especially in heat"
                  />
                  <StatRow
                    label="Electrolyte priority"
                    value="Sodium"
                    sub="200–400mg/hr for most athletes; more if heavy sweater"
                  />
                  {blueprint.raceIsHot && form.expectedTempF && (
                    <div className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-xs font-semibold text-amber-800">Hot race ({form.expectedTempF}°F)</p>
                      <p className="mt-1 text-xs leading-5 text-amber-700">Increase fluid target by 15–25%. Pre-hydrate with 500ml 60–90 min before start. Consider an ice slurry or cold vest at the start line.</p>
                    </div>
                  )}
                </BlueprintCard>

                {/* ── Intervention Doses ─── */}
                {(form.useBicarb || form.useCaffeine) && (
                  <BlueprintCard title="Race-Day Doses">
                    {form.useBicarb && (
                      <>
                        <StatRow
                          label="Sodium bicarb dose"
                          value={blueprint.bicarbDoseG ? `${blueprint.bicarbDoseG}g` : '0.3g/kg'}
                          sub={blueprint.bicarbDoseG ? `0.3g/kg × ${(parseFloat(form.bodyWeightLb) * 0.453592).toFixed(1)}kg` : 'enter body weight for exact dose'}
                        />
                        <StatRow label="Timing" value="90–120 min" sub="before gun" />
                        <StatRow label="Delivery" value="Capsules preferred" sub="lower GI risk than powder" />
                      </>
                    )}
                    {form.useCaffeine && (
                      <>
                        <StatRow
                          label="Caffeine dose"
                          value={blueprint.caffeineDoseMg ? `${blueprint.caffeineDoseMg}mg` : '200–300mg'}
                          sub={blueprint.caffeineDoseMg ? `4mg/kg × ${(parseFloat(form.bodyWeightLb) * 0.453592).toFixed(1)}kg` : 'enter body weight for exact dose'}
                        />
                        <StatRow label="Timing" value="45–60 min" sub="before gun" />
                        <StatRow label="Taper window" value="5–7 days" sub="before race for max effect" />
                      </>
                    )}
                  </BlueprintCard>
                )}

                {/* ── Pre-Race Timeline ─── */}
                {blueprint.timeline.length > 0 && (
                  <BlueprintCard title="Pre-Race Action Timeline">
                    <div className="space-y-3">
                      {blueprint.timeline.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-[14px] border border-ink/6 bg-paper px-4 py-3">
                          <span className="mt-0.5 text-base leading-none">{item.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-ink">{item.label}</p>
                              <StatusBadge status={item.status} />
                            </div>
                            <p className="mt-1 text-xs leading-5 text-ink/55">{item.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </BlueprintCard>
                )}

                {/* ── Heat acclimation status ─── */}
                {form.useHeat && (
                  <BlueprintCard title="Heat Acclimation">
                    <StatRow
                      label="Sessions completed"
                      value={`${blueprint.heatDone} / ${HEAT_BLOCK_TARGET}`}
                      sub="in last 21 days"
                    />
                    <div className="mt-3">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
                        <div
                          className="h-2 rounded-full bg-accent transition-all"
                          style={{ width: `${Math.min(100, (blueprint.heatDone / HEAT_BLOCK_TARGET) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-ink/45">
                        {blueprint.heatComplete
                          ? '✓ Block complete — plasma volume adaptation is likely underway.'
                          : `${blueprint.heatRemaining} more session${blueprint.heatRemaining !== 1 ? 's' : ''} to complete the block.`}
                      </p>
                    </div>
                    {blueprint.raceIsHot && !blueprint.heatComplete && blueprint.daysLeft !== null && blueprint.daysLeft > 14 && (
                      <div className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-xs font-semibold text-amber-800">Hot race detected</p>
                        <p className="mt-1 text-xs leading-5 text-amber-700">
                          You have {blueprint.daysLeft} days. A complete 10-session block now could reduce your race HR by 4–7% at a given pace.
                        </p>
                      </div>
                    )}
                  </BlueprintCard>
                )}

                {/* ── Gut training progress summary ─── */}
                {blueprint.targetCarbG > 0 && (
                  <BlueprintCard title="Gut Training Gap">
                    <div>
                      <div className="flex items-end justify-between">
                        <span className="text-xs text-ink/50">Current</span>
                        <span className="text-xs text-ink/50">Target</span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-paper">
                        <div
                          className={`h-2 rounded-full transition-all ${blueprint.gutGapG === 0 ? 'bg-emerald-500' : 'bg-accent'}`}
                          style={{ width: `${Math.min(100, blueprint.targetCarbG > 0 ? (blueprint.currentGut / blueprint.targetCarbG) * 100 : 0)}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="font-mono text-sm font-semibold text-ink">{blueprint.currentGut || 0}g/hr</span>
                        <span className="font-mono text-sm font-semibold text-ink">{blueprint.targetCarbG}g/hr</span>
                      </div>
                    </div>
                    {blueprint.gutGapG === 0 ? (
                      <p className="mt-3 text-xs leading-5 text-ink/55">
                        ✓ You're at or above the target carb intake. Maintain gut training runs through your taper to hold the adaptation.
                      </p>
                    ) : (
                      <p className="mt-3 text-xs leading-5 text-ink/55">
                        Closing a {blueprint.gutGapG}g/hr gap typically takes {blueprint.gutSessions} structured gut training sessions, incrementing ~5g/hr per session. Log each session to track your compliance trend.
                      </p>
                    )}
                  </BlueprintCard>
                )}

                {/* ── Race week checklist ─── */}
                <BlueprintCard title="Race Week Checklist">
                  <div className="space-y-2">
                    {[
                      'Confirm race-day nutrition plan (gels, bars, drinks) and pack bags',
                      'Pre-hydrate: extra 500–750ml evening before and race morning',
                      ...(form.useCaffeine ? ['Last day of caffeine taper — no coffee, no pre-workout'] : []),
                      'Lay out race kit the night before — nothing new on race day',
                      ...(form.useBicarb ? ['Set phone alarm for bicarb dose 90–120 min before start'] : []),
                      'Sleep target: 8+ hrs two nights before (night-before sleep is often interrupted)',
                      'Race morning: eat 2–3 hrs before gun — familiar, low-fiber meal',
                      'Arrive early enough to warm up and visit porta-potty twice',
                    ].map((item, i) => (
                      <label key={i} className="flex cursor-pointer items-start gap-2.5">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-ink" />
                        <span className="text-xs leading-5 text-ink/70">{item}</span>
                      </label>
                    ))}
                  </div>
                </BlueprintCard>

              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
