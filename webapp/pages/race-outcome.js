import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import NavMenu from '../components/NavMenu';
import {
  formatMinutes,
  StravaActivityPicker,
} from '../components/InterventionFormShared';
import { deriveRaceType, raceTypeOptions } from '../lib/raceTypes';
import { sortActivitiesMostRecentFirst } from '../lib/activityInsights';
import { getStoredValue } from '../lib/browserStorage';

const FINISH_OUTCOMES = [
  'Finished - better than goal',
  'Finished - on goal',
  'Finished - slower than goal',
  'Finished - time not my focus',
  'DNF - physical issue',
  'DNF - GI issue',
  'DNF - mental / motivation',
  'DNS - did not start',
];

const GI_LABELS = ['None', 'Minor', 'Moderate', 'Significant', 'Race-ending'];
const ENERGY_LABELS = ['Crashed hard', 'Faded', 'Consistent', 'Strong finish', 'Negative split'];
const PACING_LABELS = ['Went out too fast', 'Even split', 'Negative split', 'Too conservative early'];
const PRIMARY_LIMITERS = [
  'Pacing / execution',
  'Fueling',
  'Hydration',
  'Heat',
  'Altitude',
  'GI tolerance',
  'Muscular durability',
  'Cramping',
  'Logistics / aid stations',
  'Mental focus',
  'Equipment',
  'No major limiter',
];

const defaultRaceStorageKey = 'threshold-default-race';
const legacyDefaultRaceStorageKey = 'ultraos-default-race';
const recentRaceOutcomeStorageKey = 'threshold-recent-race-outcome';
const legacyRecentRaceOutcomeStorageKey = 'ultraos-recent-race-outcome';

const emptyForm = {
  linkedActivityId: '',
  linkedActivityProvider: '',
  raceName: '',
  raceDate: '',
  raceType: '',
  finishOutcome: '',
  finishTimeH: '',
  finishTimeM: '',
  goalTimeH: '',
  goalTimeM: '',
  overallRating: '',
  giDistressScore: '0',
  energyManagement: '',
  pacingStrategy: '',
  primaryLimiter: '',
  peakHrBpm: '',
  avgHrBpm: '',
  avgCarbsGPerHr: '',
  totalFluidL: '',
  heatImpact: '',
  whatWorked: '',
  whatToChange: '',
  wouldUseAgain: '',
  notes: '',
};

function ScaleButton({ value, selected, onClick, label }) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition
        ${
          selected
            ? 'bg-ink text-paper shadow-[0_4px_12px_rgba(19,24,22,0.22)]'
            : 'border border-ink/10 bg-paper text-ink/60 hover:bg-white hover:text-ink'
        }`}
      title={label}
    >
      {value}
    </button>
  );
}

function SectionTitle({ children }) {
  return <p className="mb-4 text-xs uppercase tracking-[0.28em] text-accent">{children}</p>;
}

function FieldLabel({ children, sub }) {
  return (
    <label className="mb-1.5 block text-sm font-semibold text-ink">
      {children}
      {sub ? <span className="ml-1 font-normal text-ink/45">{sub}</span> : null}
    </label>
  );
}

function formatDistanceMiles(value) {
  if (value === null || value === undefined || value === '') return 'Distance N/A';
  return `${(Number(value) / 1609.34).toFixed(1)} mi`;
}

function getActivityDate(activity) {
  if (!activity?.start_date) return '';
  return activity.start_date.slice(0, 10);
}

function splitDurationToFields(totalSeconds) {
  if (!totalSeconds || Number.isNaN(Number(totalSeconds))) {
    return { hours: '', minutes: '' };
  }

  const totalMinutes = Math.round(Number(totalSeconds) / 60);
  return {
    hours: String(Math.floor(totalMinutes / 60)),
    minutes: String(totalMinutes % 60),
  };
}

function inferRaceTypeFromActivity(activity) {
  if (!activity) return '';

  const normalizedSport = String(activity.sport_type || activity.type || '').toLowerCase();
  if (normalizedSport.includes('triathlon')) return 'Triathlon';
  if (normalizedSport.includes('gravel')) return 'Gravel';

  const distanceMiles = Number(activity.distance || 0) / 1609.34;
  return deriveRaceType(distanceMiles, normalizedSport);
}

const inputCls = 'w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30';
const selectCls = 'w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30';
const textareaCls = 'w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none';

export default function RaceOutcomePage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [activitySearch, setActivitySearch] = useState('');
  const [stravaConnected, setStravaConnected] = useState(true);

  const navLinks = [
    { href: '/dashboard', label: 'Threshold Home' },
    { href: '/race-plan', label: 'Race Blueprint' },
    { href: '/history', label: 'Intervention History' },
    { href: '/insights', label: 'Insights' },
  ];

  useEffect(() => {
    try {
      const stored = getStoredValue(recentRaceOutcomeStorageKey, legacyRecentRaceOutcomeStorageKey);
      if (stored) return;

      const savedRace = getStoredValue(defaultRaceStorageKey, legacyDefaultRaceStorageKey);
      if (savedRace) {
        const race = JSON.parse(savedRace);
        const profile = race.race_profile || {};
        setForm((prev) => ({
          ...prev,
          raceName: race.target_race || profile.name || '',
          raceDate: race.target_race_date || profile.event_date || '',
          raceType: race.race_type || profile.race_type || '',
        }));
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch('/api/activities');
        if (!res.ok) {
          setStravaConnected(false);
          setActivities([]);
          return;
        }

        const { activities: fetchedActivities } = await res.json();
        setStravaConnected(true);
        setActivities(sortActivitiesMostRecentFirst(fetchedActivities || []));
      } catch (requestError) {
        console.error(requestError);
        setStravaConnected(false);
        setActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    }

    fetchActivities();
  }, []);

  useEffect(() => {
    if (!router.isReady || loadingActivities) return;
    const activityParam = router.query.activity;
    if (!activityParam || typeof activityParam !== 'string') return;
    handleActivitySelect(String(activityParam));
  }, [activities, loadingActivities, router.isReady, router.query.activity]);

  const filteredActivities = useMemo(() => {
    const query = activitySearch.trim().toLowerCase();
    if (!query) return activities.slice(0, 24);

    return activities.filter((activity) => {
      const searchable = [
        activity.name,
        activity.type,
        activity.sport_type,
        new Date(activity.start_date).toLocaleDateString(),
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [activities, activitySearch]);

  const selectedActivity = useMemo(
    () => activities.find((activity) => String(activity.id) === String(form.linkedActivityId)),
    [activities, form.linkedActivityId]
  );

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleActivitySelect(activityId) {
    if (!activityId) {
      setForm((prev) => ({
        ...prev,
        linkedActivityId: '',
        linkedActivityProvider: '',
      }));
      return;
    }

    const activity = activities.find((item) => String(item.id) === String(activityId));
    if (!activity) return;

    const finishTime = splitDurationToFields(activity.elapsed_time || activity.moving_time);
    const inferredRaceType = inferRaceTypeFromActivity(activity);

    setForm((prev) => ({
      ...prev,
      linkedActivityId: String(activity.id),
      linkedActivityProvider: String(activity.provider || 'strava'),
      raceName: activity.name || prev.raceName,
      raceDate: getActivityDate(activity) || prev.raceDate,
      raceType: inferredRaceType || prev.raceType,
      finishTimeH: finishTime.hours || prev.finishTimeH,
      finishTimeM: finishTime.minutes || prev.finishTimeM,
      avgHrBpm: activity.average_heartrate ? String(Math.round(activity.average_heartrate)) : prev.avgHrBpm,
      peakHrBpm: activity.max_heartrate ? String(Math.round(activity.max_heartrate)) : prev.peakHrBpm,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.raceName.trim()) {
      setError('Please enter a race name.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        linked_activity_id: form.linkedActivityId || null,
        linked_activity_provider: form.linkedActivityProvider || null,
        race_name: form.raceName.trim(),
        race_date: form.raceDate || null,
        race_type: form.raceType || null,
        finish_outcome: form.finishOutcome || null,
        finish_time_minutes:
          form.finishTimeH || form.finishTimeM
            ? parseInt(form.finishTimeH || 0, 10) * 60 + parseInt(form.finishTimeM || 0, 10)
            : null,
        goal_time_minutes:
          form.goalTimeH || form.goalTimeM
            ? parseInt(form.goalTimeH || 0, 10) * 60 + parseInt(form.goalTimeM || 0, 10)
            : null,
        overall_rating: form.overallRating ? parseInt(form.overallRating, 10) : null,
        gi_distress_score: parseInt(form.giDistressScore, 10),
        energy_management: form.energyManagement || null,
        pacing_strategy: form.pacingStrategy || null,
        primary_limiter: form.primaryLimiter || null,
        peak_hr_bpm: form.peakHrBpm ? parseInt(form.peakHrBpm, 10) : null,
        avg_hr_bpm: form.avgHrBpm ? parseInt(form.avgHrBpm, 10) : null,
        avg_carbs_g_per_hr: form.avgCarbsGPerHr ? parseFloat(form.avgCarbsGPerHr) : null,
        total_fluid_l: form.totalFluidL ? parseFloat(form.totalFluidL) : null,
        heat_impact: form.heatImpact || null,
        what_worked: form.whatWorked.trim() || null,
        what_to_change: form.whatToChange.trim() || null,
        would_use_again: form.wouldUseAgain || null,
        notes: form.notes.trim() || null,
      };

      const res = await fetch('/api/race-outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }

      localStorage.setItem(
        recentRaceOutcomeStorageKey,
        JSON.stringify({ raceName: form.raceName, savedAt: new Date().toISOString() })
      );
      localStorage.removeItem(legacyRecentRaceOutcomeStorageKey);

      setSaved(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <main className="min-h-screen bg-paper px-4 py-6 text-ink">
        <div className="mx-auto max-w-xl">
          <div className="mt-20 rounded-[36px] border border-ink/10 bg-white p-10 text-center shadow-[0_24px_60px_rgba(19,24,22,0.07)]">
            <p className="text-4xl">🏅</p>
            <h1 className="font-display mt-6 text-3xl font-semibold">Race logged.</h1>
            <p className="mt-3 text-sm leading-7 text-ink/60">
              Your outcome is saved with the key context needed for better future race analysis.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/insights"
                className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper shadow-[0_4px_14px_rgba(19,24,22,0.18)]"
              >
                View Insights →
              </a>
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-ink/10 px-6 py-3 text-sm font-semibold text-ink"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Race Outcome</p>
          <NavMenu
            label="Race outcome navigation"
            links={navLinks}
            primaryLink={{ href: '/race-plan', label: 'Race Blueprint', variant: 'secondary' }}
          />
        </div>

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(145deg,#eee7dc_0%,#c5b8a8_60%,#7a6553_100%)] p-8 md:p-10">
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Post-Race Log</p>
          <h1 className="font-display mt-3 text-4xl leading-tight md:text-5xl">How did it go?</h1>
          <p className="mt-3 text-sm leading-6 text-ink/65">
            Link the race activity first if you have it. Threshold will prefill the objective workout data, and you can layer on the subjective debrief that future AI analysis actually needs.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <SectionTitle>Linked Activity</SectionTitle>
            <StravaActivityPicker
              activities={filteredActivities}
              activitySearch={activitySearch}
              selectedActivityId={form.linkedActivityId}
              onSearchChange={setActivitySearch}
              onSelect={handleActivitySelect}
              loading={loadingActivities}
              stravaConnected={stravaConnected}
              helperCopy="Optional but recommended. Linking the race activity lets Threshold prefill race date, likely finish time, and heart-rate fields."
              emptyCopy="Connect Strava to attach the actual race activity to this post-race log."
            />

            {selectedActivity ? (
              <div className="mt-4 rounded-[24px] bg-paper p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{selectedActivity.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-accent">
                      {new Date(selectedActivity.start_date).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-xs text-ink/55">You can still edit any prefilled value below.</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-accent">Distance</p>
                    <p className="mt-1 text-lg font-semibold text-ink">{formatDistanceMiles(selectedActivity.distance)}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-accent">Duration</p>
                    <p className="mt-1 text-lg font-semibold text-ink">
                      {formatMinutes(selectedActivity.elapsed_time || selectedActivity.moving_time) || 'N/A'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-ink/55">
                  Threshold uses the linked activity as objective context. If your official race result differs from the watch file, update the finish time manually below.
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <SectionTitle>Race Details</SectionTitle>
            <div className="space-y-4">
              <div>
                <FieldLabel>Race name</FieldLabel>
                <input type="text" name="raceName" value={form.raceName} onChange={handleChange} placeholder="e.g. Boston Marathon 2026" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Race date</FieldLabel>
                  <input type="date" name="raceDate" value={form.raceDate} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <FieldLabel>Race type</FieldLabel>
                  <select name="raceType" value={form.raceType} onChange={handleChange} className={selectCls}>
                    <option value="">Select type</option>
                    {raceTypeOptions.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <SectionTitle>Race Outcome</SectionTitle>
            <div className="space-y-4">
              <div>
                <FieldLabel>How did it go?</FieldLabel>
                <select name="finishOutcome" value={form.finishOutcome} onChange={handleChange} className={selectCls}>
                  <option value="">Select outcome</option>
                  {FINISH_OUTCOMES.map((outcome) => (
                    <option key={outcome}>{outcome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Finish time</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input type="number" name="finishTimeH" value={form.finishTimeH} onChange={handleChange} placeholder="hrs" min="0" className={inputCls} />
                    <span className="shrink-0 text-sm text-ink/40">h</span>
                    <input type="number" name="finishTimeM" value={form.finishTimeM} onChange={handleChange} placeholder="min" min="0" max="59" className={inputCls} />
                    <span className="shrink-0 text-sm text-ink/40">m</span>
                  </div>
                </div>
                <div>
                  <FieldLabel>Goal time</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input type="number" name="goalTimeH" value={form.goalTimeH} onChange={handleChange} placeholder="hrs" min="0" className={inputCls} />
                    <span className="shrink-0 text-sm text-ink/40">h</span>
                    <input type="number" name="goalTimeM" value={form.goalTimeM} onChange={handleChange} placeholder="min" min="0" max="59" className={inputCls} />
                    <span className="shrink-0 text-sm text-ink/40">m</span>
                  </div>
                </div>
              </div>

              <div>
                <FieldLabel>Overall race rating</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <ScaleButton
                      key={value}
                      value={String(value)}
                      selected={form.overallRating === String(value)}
                      onClick={(nextValue) => setField('overallRating', nextValue)}
                      label={value <= 3 ? 'Poor' : value <= 6 ? 'Okay' : value <= 8 ? 'Good' : 'Outstanding'}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink/40">1 = disaster, 10 = best race of your life</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <SectionTitle>Race Execution</SectionTitle>
            <div className="space-y-4">
              <div>
                <FieldLabel>GI distress</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {GI_LABELS.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setField('giDistressScore', String(index))}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition
                        ${
                          form.giDistressScore === String(index)
                            ? 'bg-ink text-paper'
                            : 'border border-ink/10 bg-paper text-ink/60 hover:bg-white hover:text-ink'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Energy management</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {ENERGY_LABELS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setField('energyManagement', label)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition
                        ${
                          form.energyManagement === label
                            ? 'bg-ink text-paper'
                            : 'border border-ink/10 bg-paper text-ink/60 hover:bg-white hover:text-ink'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Pacing strategy</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {PACING_LABELS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setField('pacingStrategy', label)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition
                        ${
                          form.pacingStrategy === label
                            ? 'bg-ink text-paper'
                            : 'border border-ink/10 bg-paper text-ink/60 hover:bg-white hover:text-ink'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Primary limiter</FieldLabel>
                <select name="primaryLimiter" value={form.primaryLimiter} onChange={handleChange} className={selectCls}>
                  <option value="">Select the biggest limiter</option>
                  {PRIMARY_LIMITERS.map((limiter) => (
                    <option key={limiter}>{limiter}</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Did heat significantly impact performance?</FieldLabel>
                <div className="flex gap-2">
                  {['Yes - big factor', 'Somewhat', 'No - non-issue'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setField('heatImpact', label)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition
                        ${
                          form.heatImpact === label
                            ? 'bg-ink text-paper'
                            : 'border border-ink/10 bg-paper text-ink/60 hover:bg-white hover:text-ink'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <SectionTitle>Race-Day Data</SectionTitle>
            <p className="mb-4 text-xs leading-5 text-ink/45">These fields matter for pattern detection later, so fill them in if you know them.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Avg HR</FieldLabel>
                <input type="number" name="avgHrBpm" value={form.avgHrBpm} onChange={handleChange} placeholder="bpm" className={inputCls} />
              </div>
              <div>
                <FieldLabel>Peak HR</FieldLabel>
                <input type="number" name="peakHrBpm" value={form.peakHrBpm} onChange={handleChange} placeholder="bpm" className={inputCls} />
              </div>
              <div>
                <FieldLabel>Avg carbs</FieldLabel>
                <input type="number" name="avgCarbsGPerHr" value={form.avgCarbsGPerHr} onChange={handleChange} placeholder="g/hr" step="0.1" className={inputCls} />
              </div>
              <div>
                <FieldLabel>Total fluid</FieldLabel>
                <input type="number" name="totalFluidL" value={form.totalFluidL} onChange={handleChange} placeholder="liters" step="0.1" className={inputCls} />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <SectionTitle>Race Debrief</SectionTitle>
            <div className="space-y-4">
              <div>
                <FieldLabel>What worked well?</FieldLabel>
                <textarea
                  name="whatWorked"
                  value={form.whatWorked}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Examples: pacing discipline, cooling plan, carb timing, crew execution, gear choice."
                  className={textareaCls}
                />
              </div>

              <div>
                <FieldLabel>What would you change next time?</FieldLabel>
                <textarea
                  name="whatToChange"
                  value={form.whatToChange}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Examples: start slower, increase carb tolerance, carry more fluid, different shoes."
                  className={textareaCls}
                />
              </div>

              <div>
                <FieldLabel>Would you use this prep stack again?</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {['Yes - no changes', 'Yes - with adjustments', 'Unsure', 'No'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setField('wouldUseAgain', label)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition
                        ${
                          form.wouldUseAgain === label
                            ? 'bg-ink text-paper'
                            : 'border border-ink/10 bg-paper text-ink/60 hover:bg-white hover:text-ink'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Additional notes</FieldLabel>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Add the context an AI cannot infer from numbers alone: weather, terrain, crew issues, mistakes, breakthroughs, or anything unusual."
                  className={textareaCls}
                />
              </div>
            </div>
          </div>

          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-ink py-4 text-sm font-semibold text-paper shadow-[0_4px_16px_rgba(19,24,22,0.2)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Race Outcome →'}
          </button>

          <p className="pb-8 text-center text-xs text-ink/35">
            Your race outcomes are private and used only to generate personalized insights.
          </p>
        </form>
      </div>
    </main>
  );
}
