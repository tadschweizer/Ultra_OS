import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  INTENSITY_ZONES,
  STEP_TYPES,
  WORKOUT_SPORTS,
  estimateTss,
  summarizeStructure,
  summarizeWeek,
  toDateKey,
} from '../lib/workoutCompliance';

// ─── Date helpers ────────────────────────────────────────────────────────────

function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmtDuration(min) {
  if (min == null) return null;
  const m = Math.round(Number(min));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
}

function fmtFullDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

const SPORT_EMOJI = {
  run: '🏃', bike: '🚴', swim: '🏊', strength: '🏋️', row: '🚣', ski: '⛷️', hike: '🥾', other: '⚡',
};

const NOTE_META = {
  general: { icon: '📝', label: 'Note', card: 'border-ink/10 bg-amber-50/60' },
  day_off: { icon: '🛌', label: 'Day off', card: 'border-dashed border-ink/20 bg-ink/4' },
  event: { icon: '🏁', label: 'Event', card: 'border-amber-300/60 bg-amber-50' },
  goal: { icon: '🎯', label: 'Goal', card: 'border-ink/10 bg-sky-50/60' },
};

const COMPLIANCE_DOT = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-rose-500',
  none: 'bg-ink/15',
};

const emptyStep = { type: 'work', repeat: 1, duration_min: 10, distance_km: '', intensity: 'z2', target_type: 'open', target_min: '', target_max: '', target_units: '', notes: '' };

const emptyForm = {
  id: null,
  title: '',
  sport: 'run',
  workout_date: toDateKey(new Date()),
  description: '',
  objective: '',
  coach_instructions: '',
  target_metric: 'duration',
  planned_if: '',
  visibility: 'athlete_visible',
  planned_duration_min: '',
  planned_distance_km: '',
  // null → the editor falls back to the athlete's saved unit preference.
  planned_distance_unit: null,
  structure: [],
};

// ─── Distance units ──────────────────────────────────────────────────────────

const KM_PER_MILE = 1.609344;

function kmToUnit(km, unit) {
  if (km == null || km === '') return '';
  const value = unit === 'km' ? Number(km) : Number(km) / KM_PER_MILE;
  return String(Math.round(value * 100) / 100);
}

function unitToKm(value, unit) {
  if (value === '' || value == null) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  const km = unit === 'km' ? num : num * KM_PER_MILE;
  return Math.round(km * 100) / 100;
}

// Renders a canonical km distance in the workout's chosen unit, e.g. "6.2 mi".
function formatDistance(km, unit = 'mi') {
  if (km == null || km === '') return null;
  const value = kmToUnit(km, unit);
  return value === '' ? null : `${value} ${unit === 'km' ? 'km' : 'mi'}`;
}

const FEET_PER_METRE = 3.28084;

/** Elevation follows the athlete's distance preference: metres for km, feet for miles. */
function fmtElevation(metres, unit = 'mi') {
  if (metres == null || metres === '') return null;
  const value = Number(metres);
  if (!Number.isFinite(value) || value <= 0) return null;
  return unit === 'km'
    ? `${Math.round(value).toLocaleString()} m`
    : `${Math.round(value * FEET_PER_METRE).toLocaleString()} ft`;
}

// ─── Structure-step targets ──────────────────────────────────────────────────

const TARGET_TYPES = [
  { id: 'open', label: 'Open target' },
  { id: 'pace', label: 'Pace' },
  { id: 'heart_rate', label: 'Heart rate' },
  { id: 'power', label: 'Power' },
  { id: 'zone', label: 'Zone' },
  { id: 'rpe', label: 'RPE' },
];

// The unit shown beside the target inputs. Pace tracks the athlete's distance
// unit (min/mi vs min/km); everything else is fixed.
function targetUnitLabel(targetType, distanceUnit = 'mi') {
  switch (targetType) {
    case 'pace': return distanceUnit === 'km' ? 'min/km' : 'min/mi';
    case 'heart_rate': return 'bpm';
    case 'power': return 'W';
    case 'zone': return 'zone';
    case 'rpe': return 'RPE';
    default: return '';
  }
}

function targetPlaceholders(targetType) {
  switch (targetType) {
    case 'pace': return ['6:24', '7:15'];
    case 'heart_rate': return ['150', '160'];
    case 'power': return ['240', '260'];
    case 'zone': return ['2', '3'];
    case 'rpe': return ['6', '7'];
    default: return ['Min', 'Max'];
  }
}

// ─── Structured workout editor ───────────────────────────────────────────────

const stepFieldClass = 'w-full rounded-xl border border-ink/10 bg-white px-2 py-1.5 text-xs text-ink';
const stepLabelClass = 'text-[10px] font-semibold uppercase tracking-wide text-ink/45';

function StepField({ label, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className={stepLabelClass}>{label}</span>
      {children}
    </label>
  );
}

function StepRow({ step, onChange, onRemove, distanceUnit = 'mi' }) {
  const targetType = step.target_type || 'open';
  const showTarget = targetType !== 'open';
  const unitLabel = targetUnitLabel(targetType, distanceUnit);
  const [minPlaceholder, maxPlaceholder] = targetPlaceholders(targetType);

  return (
    <div className="space-y-2 rounded-2xl border border-ink/10 bg-paper p-3">
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_56px_72px_1fr_1fr_auto]">
        <StepField label="Step">
          <select
            value={step.type}
            onChange={(e) => onChange({ ...step, type: e.target.value })}
            className={stepFieldClass}
          >
            {STEP_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </StepField>
        <StepField label="Reps">
          <input
            type="number"
            min="1"
            value={step.repeat}
            onChange={(e) => onChange({ ...step, repeat: Number(e.target.value) || 1 })}
            title="Number of times this step repeats"
            className={stepFieldClass}
          />
        </StepField>
        <StepField label="Min">
          <input
            type="number"
            min="0"
            step="0.5"
            value={step.duration_min}
            onChange={(e) => onChange({ ...step, duration_min: e.target.value === '' ? '' : Number(e.target.value) })}
            title="Minutes per repeat"
            placeholder="min"
            className={stepFieldClass}
          />
        </StepField>
        <StepField label="Intensity">
          <select
            value={step.intensity}
            onChange={(e) => onChange({ ...step, intensity: e.target.value })}
            className={stepFieldClass}
          >
            {INTENSITY_ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
          </select>
        </StepField>
        <StepField label="Target">
          <select
            value={targetType}
            onChange={(e) => onChange({ ...step, target_type: e.target.value })}
            className={stepFieldClass}
          >
            {TARGET_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </StepField>
        <button
          type="button"
          onClick={onRemove}
          title="Remove step"
          className="h-[30px] rounded-xl border border-ink/10 px-2 text-xs text-ink/50 hover:border-rose-200 hover:text-rose-600"
        >
          ✕
        </button>
      </div>

      {showTarget && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/60 px-2 py-1.5">
          <span className={stepLabelClass}>Target</span>
          <input
            value={step.target_min || ''}
            onChange={(e) => onChange({ ...step, target_min: e.target.value })}
            placeholder={minPlaceholder}
            className="w-20 rounded-xl border border-ink/10 bg-white px-2 py-1.5 text-xs text-ink"
          />
          <span className="text-xs text-ink/40">–</span>
          <input
            value={step.target_max || ''}
            onChange={(e) => onChange({ ...step, target_max: e.target.value })}
            placeholder={maxPlaceholder}
            className="w-20 rounded-xl border border-ink/10 bg-white px-2 py-1.5 text-xs text-ink"
          />
          {unitLabel && <span className="text-xs font-medium text-ink/55">{unitLabel}</span>}
          <span className="text-[10px] text-ink/40">Leave max blank for a single target.</span>
        </div>
      )}

      <input
        value={step.notes || ''}
        onChange={(e) => onChange({ ...step, notes: e.target.value })}
        placeholder="Step notes (e.g. 4×8min @ threshold, 2min jog recovery)"
        className="w-full rounded-xl border border-ink/10 bg-white px-2 py-1.5 text-xs text-ink"
      />
    </div>
  );
}

function WorkoutEditor({ initial, canEditPlan, onSave, onSaveToLibrary, onClose, defaultDistanceUnit = 'mi' }) {
  const [form, setForm] = useState(() => {
    const base = { ...emptyForm, ...initial };
    const unit = base.planned_distance_unit || defaultDistanceUnit || 'mi';
    return {
      ...base,
      planned_distance_unit: unit,
      // Editable value shown in the athlete's preferred unit; the canonical
      // km value is recomputed from this on save.
      planned_distance: kmToUnit(base.planned_distance_km, unit),
    };
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const distanceUnit = form.planned_distance_unit || 'mi';
  const structureTotals = useMemo(() => summarizeStructure(form.structure), [form.structure]);
  const tssEstimate = useMemo(
    () => estimateTss(form.structure, Number(form.planned_duration_min) || structureTotals.durationMin || null),
    [form.structure, form.planned_duration_min, structureTotals.durationMin]
  );

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function changeDistanceUnit(nextUnit) {
    setForm((f) => {
      const km = unitToKm(f.planned_distance, f.planned_distance_unit || 'mi');
      return {
        ...f,
        planned_distance_unit: nextUnit,
        planned_distance: kmToUnit(km, nextUnit),
      };
    });
  }

  function updateStep(index, step) {
    setForm((f) => ({ ...f, structure: f.structure.map((s, i) => (i === index ? step : s)) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    // Stamp each step's target units so the read-only detail view renders the
    // right suffix (min/mi, bpm, W, …) without recomputing.
    const structure = (form.structure || []).map((step) => ({
      ...step,
      target_units: targetUnitLabel(step.target_type || 'open', distanceUnit),
    }));
    const result = await onSave({
      ...form,
      structure,
      planned_duration_min: form.planned_duration_min === '' ? null : Number(form.planned_duration_min),
      planned_distance_km: unitToKm(form.planned_distance, distanceUnit),
      planned_distance_unit: distanceUnit,
      planned_tss: tssEstimate,
      planned_if: form.planned_if === '' ? null : Number(form.planned_if),
    });
    setSaving(false);
    if (result && result.ok) {
      onClose();
    } else {
      setMessage((result && result.error) || 'Could not save workout. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-ink/10 bg-paper p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">
            {form.id ? 'Edit workout' : 'Plan workout'}
          </p>
          <button onClick={onClose} className="rounded-full border border-ink/10 px-4 py-1.5 text-sm text-ink/70 hover:bg-ink/5">Close</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_140px]">
            <input
              required
              disabled={!canEditPlan}
              placeholder="Workout title (e.g. Threshold intervals)"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
            />
            <select
              disabled={!canEditPlan}
              value={form.sport}
              onChange={(e) => setField('sport', e.target.value)}
              className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
            >
              {WORKOUT_SPORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <input
              type="date"
              required
              disabled={!canEditPlan}
              value={form.workout_date}
              onChange={(e) => setField('workout_date', e.target.value)}
              className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
            />
          </div>

          <textarea
            rows={2}
            disabled={!canEditPlan}
            placeholder="Coach instructions / session goal"
            value={form.description || ''}
            onChange={(e) => setField('description', e.target.value)}
            className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
          />


          <div className="grid gap-3 sm:grid-cols-2">
            <input
              disabled={!canEditPlan}
              placeholder="Workout objective / purpose"
              value={form.objective || ''}
              onChange={(e) => setField('objective', e.target.value)}
              className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
            />
            <input
              disabled={!canEditPlan}
              placeholder="Coach instructions (separate from description)"
              value={form.coach_instructions || ''}
              onChange={(e) => setField('coach_instructions', e.target.value)}
              className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <select
              disabled={!canEditPlan}
              value={form.target_metric || 'duration'}
              onChange={(e) => setField('target_metric', e.target.value)}
              className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
            >
              <option value="duration">Primary target: duration</option>
              <option value="distance">Primary target: distance</option>
              <option value="tss">Primary target: TSS</option>
              <option value="pace">Primary target: pace</option>
              <option value="heart_rate">Primary target: heart rate</option>
              <option value="power">Primary target: power</option>
              <option value="rpe">Primary target: RPE</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={!canEditPlan}
              placeholder="Planned IF"
              value={form.planned_if || ''}
              onChange={(e) => setField('planned_if', e.target.value)}
              className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
            />
            <select
              disabled={!canEditPlan}
              value={form.visibility || 'athlete_visible'}
              onChange={(e) => setField('visibility', e.target.value)}
              className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
            >
              <option value="athlete_visible">Visible to athlete</option>
              <option value="coach_private">Coach private draft</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-ink/55">Planned duration (min)</label>
              <input
                type="number"
                min="0"
                disabled={!canEditPlan}
                value={form.planned_duration_min}
                placeholder={structureTotals.durationMin ? String(structureTotals.durationMin) : ''}
                onChange={(e) => setField('planned_duration_min', e.target.value)}
                className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-xs text-ink/55">Planned distance</label>
                <select
                  disabled={!canEditPlan}
                  value={distanceUnit}
                  onChange={(e) => changeDistanceUnit(e.target.value)}
                  aria-label="Distance unit"
                  className="rounded-lg border border-ink/10 bg-white px-1.5 py-0.5 text-xs text-ink/70 disabled:opacity-60"
                >
                  <option value="mi">mi</option>
                  <option value="km">km</option>
                </select>
              </div>
              <input
                type="number"
                min="0"
                step="0.1"
                disabled={!canEditPlan}
                value={form.planned_distance}
                placeholder={structureTotals.distanceKm ? kmToUnit(structureTotals.distanceKm, distanceUnit) : ''}
                onChange={(e) => setField('planned_distance', e.target.value)}
                className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink/55">Estimated TSS</label>
              <div className="rounded-2xl border border-ink/10 bg-paper px-4 py-3 font-mono text-sm text-ink/70">
                {tssEstimate ?? '—'}
              </div>
            </div>
          </div>

          {/* Structure builder */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.22em] text-ink/55">Structure</p>
              {canEditPlan && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, structure: [...f.structure, { ...emptyStep }] }))}
                  className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink/70 hover:bg-ink/5"
                >
                  + Add step
                </button>
              )}
            </div>
            <div className="mt-2 space-y-2">
              {!form.structure.length && (
                <p className="rounded-2xl border border-dashed border-ink/15 bg-white p-3 text-xs text-ink/50">
                  No structured steps — add warm up, work intervals, and cool down to build the session.
                </p>
              )}
              {form.structure.map((step, i) => (
                <StepRow
                  key={i}
                  step={step}
                  distanceUnit={distanceUnit}
                  onChange={(next) => updateStep(i, next)}
                  onRemove={() => setForm((f) => ({ ...f, structure: f.structure.filter((_, j) => j !== i) }))}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className="rounded-full bg-panel px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-60">
              {saving ? 'Saving…' : 'Save workout'}
            </button>
            {onSaveToLibrary && canEditPlan && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await onSaveToLibrary({
                    ...form,
                    planned_distance_km: unitToKm(form.planned_distance, distanceUnit),
                    planned_distance_unit: distanceUnit,
                  });
                  setMessage(ok ? 'Saved to library.' : 'Could not save to library.');
                }}
                className="rounded-full border border-ink/10 px-5 py-2.5 text-sm font-semibold text-ink/70 hover:bg-ink/5"
              >
                Save to library
              </button>
            )}
            {message && <p className="text-xs text-ink/60">{message}</p>}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Completion / detail panel ───────────────────────────────────────────────

function WorkoutDetail({ workout, role, onUpdate, onEdit, onDelete, onClose }) {
  const distanceUnit = workout.planned_distance_unit || 'mi';
  const [completion, setCompletion] = useState({
    completed_duration_min: workout.completed_duration_min ?? workout.planned_duration_min ?? '',
    // Shown/entered in the workout's unit; converted to km on submit.
    completed_distance: kmToUnit(workout.completed_distance_km ?? workout.planned_distance_km ?? '', distanceUnit),
    athlete_rpe: workout.athlete_rpe ?? '',
    athlete_comment: workout.athlete_comment ?? '',
  });
  const [feedback, setFeedback] = useState(workout.coach_feedback || '');
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/workout-comments?workout_id=${workout.id}`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((d) => { if (active) setComments(d.comments || []); })
      .catch(() => {});
    return () => { active = false; };
  }, [workout.id]);

  async function sendComment() {
    if (!commentBody.trim()) return;
    setBusy(true);
    const res = await fetch('/api/workout-comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planned_workout_id: workout.id, body: commentBody }),
    });
    if (res.ok) {
      const d = await res.json();
      setComments((prev) => [...prev, d.comment]);
      setCommentBody('');
    }
    setBusy(false);
  }

  async function submit(updates) {
    setBusy(true);
    await onUpdate(workout.id, updates);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] border border-ink/10 bg-paper p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">
              {SPORT_EMOJI[workout.sport] || '⚡'} {workout.sport} · {workout.workout_date}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">{workout.title}</h3>
            <p className="mt-1 text-xs text-ink/55">
              {[
                fmtDuration(workout.planned_duration_min) && `Planned ${fmtDuration(workout.planned_duration_min)}`,
                formatDistance(workout.planned_distance_km, workout.planned_distance_unit),
                workout.planned_tss && `TSS ${Math.round(workout.planned_tss)}`,
              ].filter(Boolean).join(' · ') || 'No planned targets'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full border border-ink/10 px-4 py-1.5 text-sm text-ink/70 hover:bg-ink/5">Close</button>
        </div>

        {(workout.objective || workout.description || workout.coach_instructions) && (
          <div className="mt-4 space-y-2 rounded-2xl border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/80">
            {workout.objective && <p><span className="font-semibold">Objective:</span> {workout.objective}</p>}
            {workout.description && <p className="whitespace-pre-wrap">{workout.description}</p>}
            {workout.coach_instructions && <p><span className="font-semibold">Coach instructions:</span> {workout.coach_instructions}</p>}
            {(workout.target_metric || workout.planned_if) && <p className="text-xs text-ink/55">Primary target: {workout.target_metric || 'duration'}{workout.planned_if ? ` · IF ${workout.planned_if}` : ''}</p>}
          </div>
        )}

        {Array.isArray(workout.structure) && workout.structure.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/55">Structure</p>
            <div className="mt-2 space-y-1.5">
              {workout.structure.map((step, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-ink/8 bg-white px-3 py-2 text-xs text-ink/75">
                  <span className="rounded-full bg-paper px-2 py-0.5 font-semibold uppercase tracking-wide text-[10px] text-ink/55">
                    {STEP_TYPES.find((t) => t.id === step.type)?.label || step.type}
                  </span>
                  <span>
                    {step.repeat > 1 ? `${step.repeat} × ` : ''}
                    {step.duration_min ? `${step.duration_min}min` : ''}
                    {step.distance_km ? ` ${step.distance_km}km` : ''}
                    {' '}@ {INTENSITY_ZONES.find((z) => z.id === step.intensity)?.label || step.intensity}
                    {step.target_type && step.target_type !== 'open' ? ` · ${step.target_type}${step.target_min ? ` ${step.target_min}` : ''}${step.target_max ? `–${step.target_max}` : ''}${step.target_units ? ` ${step.target_units}` : ''}` : ''}
                  </span>
                  {step.notes && <span className="text-ink/50">— {step.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completion status */}
        <div className="mt-5 rounded-2xl border border-ink/10 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/55">Completion</p>
            <span className={`h-3 w-3 rounded-full ${COMPLIANCE_DOT[workout.compliance_status] || COMPLIANCE_DOT.none}`} />
          </div>
          {workout.status === 'completed' ? (
            <p className="mt-2 text-sm text-ink/75">
              Completed{workout.completed_duration_min ? ` · ${fmtDuration(workout.completed_duration_min)}` : ''}
              {workout.completed_distance_km ? ` · ${formatDistance(workout.completed_distance_km, workout.planned_distance_unit)}` : ''}
              {workout.compliance_pct != null ? ` · ${workout.compliance_pct}% of plan` : ''}
              {workout.athlete_rpe ? ` · RPE ${workout.athlete_rpe}` : ''}
            </p>
          ) : workout.status === 'skipped' ? (
            <p className="mt-2 text-sm text-rose-600">Skipped</p>
          ) : (
            <p className="mt-2 text-sm text-ink/55">Not completed yet.</p>
          )}
          {workout.matched_activity && (
            <p className="mt-1 text-xs text-emerald-700">Auto-matched to a synced activity on this day.</p>
          )}
          {workout.athlete_comment && (
            <p className="mt-2 rounded-xl bg-paper p-3 text-sm text-ink/75">Athlete: {workout.athlete_comment}</p>
          )}
          {workout.coach_feedback && (
            <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-ink/80">Coach: {workout.coach_feedback}</p>
          )}
        </div>

        {/* Athlete completion form */}
        {role === 'athlete' && workout.status !== 'completed' && (
          <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/55">Log completion</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input
                type="number"
                min="0"
                placeholder="Duration (min)"
                value={completion.completed_duration_min}
                onChange={(e) => setCompletion((c) => ({ ...c, completed_duration_min: e.target.value }))}
                className="rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink"
              />
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder={`Distance (${distanceUnit})`}
                value={completion.completed_distance}
                onChange={(e) => setCompletion((c) => ({ ...c, completed_distance: e.target.value }))}
                className="rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink"
              />
              <select
                value={completion.athlete_rpe}
                onChange={(e) => setCompletion((c) => ({ ...c, athlete_rpe: e.target.value }))}
                className="rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink"
              >
                <option value="">RPE (1–10)</option>
                {Array.from({ length: 10 }).map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select>
            </div>
            <textarea
              rows={2}
              placeholder="How did it go?"
              value={completion.athlete_comment}
              onChange={(e) => setCompletion((c) => ({ ...c, athlete_comment: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink"
            />
            <div className="mt-3 flex gap-2">
              <button
                disabled={busy}
                onClick={() => submit({
                  status: 'completed',
                  completed_duration_min: completion.completed_duration_min === '' ? null : Number(completion.completed_duration_min),
                  completed_distance_km: unitToKm(completion.completed_distance, distanceUnit),
                  athlete_rpe: completion.athlete_rpe === '' ? null : Number(completion.athlete_rpe),
                  athlete_comment: completion.athlete_comment || null,
                })}
                className="rounded-full bg-panel px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
              >
                Mark completed
              </button>
              <button
                disabled={busy}
                onClick={() => submit({ status: 'skipped', athlete_comment: completion.athlete_comment || null })}
                className="rounded-full border border-ink/10 px-4 py-2 text-sm text-ink/70 hover:bg-ink/5 disabled:opacity-60"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Athlete comment on completed workouts */}
        {role === 'athlete' && workout.status === 'completed' && (
          <div className="mt-4 flex gap-2">
            <input
              placeholder="Add a comment for your coach…"
              value={completion.athlete_comment}
              onChange={(e) => setCompletion((c) => ({ ...c, athlete_comment: e.target.value }))}
              className="flex-1 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink"
            />
            <button
              disabled={busy}
              onClick={() => submit({ athlete_comment: completion.athlete_comment || null })}
              className="rounded-full bg-panel px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
            >
              Save
            </button>
          </div>
        )}

        {/* Coach feedback */}
        {role === 'coach' && (
          <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/55">Coach feedback</p>
            <textarea
              rows={2}
              placeholder="Feedback the athlete will see on this workout"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="mt-2 w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink"
            />
            <button
              disabled={busy}
              onClick={() => submit({ coach_feedback: feedback || null })}
              className="mt-2 rounded-full bg-panel px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
            >
              Save feedback
            </button>
          </div>
        )}


        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/55">Workout discussion</p>
            <span className="text-[10px] text-ink/40">Visible to you and your {role === 'coach' ? 'athlete' : 'coach'}</span>
          </div>
          <div className="mt-3 space-y-2">
            {!comments.length && <p className="text-sm text-ink/50">No messages on this workout yet. Ask a question or leave context — it stays attached to this session.</p>}
            {comments.map((comment) => (
              <div
                key={comment.id}
                className={`rounded-xl p-3 text-sm ${comment.sender_role === 'coach' ? 'border border-accent/20 bg-accent/5 text-ink/80' : 'bg-paper text-ink/75'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink/45">{comment.sender_role}</p>
                  <p className="text-[10px] text-ink/35">{comment.created_at ? new Date(comment.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</p>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
              placeholder="Message about this workout…"
              className="flex-1 rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink"
            />
            <button disabled={busy || !commentBody.trim()} onClick={sendComment} className="rounded-full bg-panel px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60">Send</button>
          </div>
        </div>

        {/* Edit / delete */}
        <div className="mt-5 flex items-center justify-between border-t border-ink/8 pt-4">
          <a
            href={`/api/workout-export?id=${workout.id}`}
            className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5"
          >
            Export JSON
          </a>
          {(role === 'coach' || !workout.coach_id) ? (
            <button onClick={() => onEdit(workout)} className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5">
              Edit workout
            </button>
          ) : <span className="text-xs text-ink/45">Assigned by your coach</span>}
          {(role === 'coach' || !workout.coach_id) && (
            <button
              onClick={() => { if (window.confirm('Delete this workout?')) onDelete(workout.id); }}
              className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Day add-menu (TrainingPeaks-style) ──────────────────────────────────────

function DayMenu({ date, role, onAddWorkout, onAddDayOff, onAddNote, onAddEvent, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-[28px] border border-ink/10 bg-paper p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ink">{fmtFullDate(date)}</h3>
          <button onClick={onClose} className="rounded-full border border-ink/10 px-3 py-1 text-sm text-ink/60 hover:bg-ink/5">✕</button>
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Add a workout</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {WORKOUT_SPORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => onAddWorkout(s.id)}
              className="flex flex-col items-center gap-1 rounded-2xl border border-ink/10 bg-white px-2 py-3 text-xs font-semibold text-ink/75 transition hover:border-accent/50 hover:bg-accent/5"
            >
              <span className="text-lg">{SPORT_EMOJI[s.id] || '⚡'}</span>
              {s.label}
            </button>
          ))}
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Add other</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            onClick={onAddDayOff}
            className="flex flex-col items-center gap-1 rounded-2xl border border-ink/10 bg-white px-2 py-3 text-xs font-semibold text-ink/75 transition hover:border-accent/50 hover:bg-accent/5"
          >
            <span className="text-lg">🛌</span>
            Day off
          </button>
          <button
            onClick={onAddNote}
            className="flex flex-col items-center gap-1 rounded-2xl border border-ink/10 bg-white px-2 py-3 text-xs font-semibold text-ink/75 transition hover:border-accent/50 hover:bg-accent/5"
          >
            <span className="text-lg">📝</span>
            Note
          </button>
          {role === 'athlete' ? (
            <button
              onClick={onAddEvent}
              className="flex flex-col items-center gap-1 rounded-2xl border border-ink/10 bg-white px-2 py-3 text-xs font-semibold text-ink/75 transition hover:border-accent/50 hover:bg-accent/5"
            >
              <span className="text-lg">🏁</span>
              Race / Event
            </button>
          ) : (
            <button
              onClick={() => onAddNote('goal')}
              className="flex flex-col items-center gap-1 rounded-2xl border border-ink/10 bg-white px-2 py-3 text-xs font-semibold text-ink/75 transition hover:border-accent/50 hover:bg-accent/5"
            >
              <span className="text-lg">🎯</span>
              Goal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Note editor ─────────────────────────────────────────────────────────────

function NoteEditor({ initial, role, canEdit, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    id: initial.id || null,
    note_date: initial.note_date,
    title: initial.title || '',
    body: initial.body || '',
    note_type: initial.note_type || 'general',
    visibility: initial.visibility || 'athlete_visible',
  });
  const [saving, setSaving] = useState(false);
  const meta = NOTE_META[form.note_type] || NOTE_META.general;

  async function submit(e) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-[28px] border border-ink/10 bg-paper p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">{meta.icon} {meta.label} · {form.note_date}</p>
          <button onClick={onClose} className="rounded-full border border-ink/10 px-3 py-1 text-sm text-ink/60 hover:bg-ink/5">✕</button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            required
            disabled={!canEdit}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Title"
            className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
          />
          <textarea
            rows={4}
            disabled={!canEdit}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Details (optional)"
            className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              disabled={!canEdit}
              value={form.note_date}
              onChange={(e) => setForm((f) => ({ ...f, note_date: e.target.value }))}
              className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
            />
            {role === 'coach' && (
              <select
                disabled={!canEdit}
                value={form.visibility}
                onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
                className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink disabled:opacity-60"
              >
                <option value="athlete_visible">Visible to athlete</option>
                <option value="coach_private">Coach private</option>
              </select>
            )}
          </div>
          <div className="flex items-center justify-between">
            {canEdit ? (
              <button type="submit" disabled={saving} className="rounded-full bg-panel px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            ) : <span className="text-xs text-ink/45">Added by your coach</span>}
            {form.id && canEdit && (
              <button
                type="button"
                onClick={() => { if (window.confirm('Delete this item?')) onDelete(form.id); }}
                className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Race / event quick-add ──────────────────────────────────────────────────

function EventEditor({ date, onSave, onClose }) {
  const [name, setName] = useState('');
  const [raceType, setRaceType] = useState('Marathon');
  const [priority, setPriority] = useState('B');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave({ name, event_date: date, race_type: raceType, priority });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-[28px] border border-ink/10 bg-paper p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">🏁 Race / Event · {date}</p>
          <button onClick={onClose} className="rounded-full border border-ink/10 px-3 py-1 text-sm text-ink/60 hover:bg-ink/5">✕</button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Event name"
            className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={raceType} onChange={(e) => setRaceType(e.target.value)} className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink">
              {['1 Mile / 1500m', '3k / 5k', '10k', 'Half Marathon', 'Marathon', '50k+', 'Triathlon', 'Gravel', 'Other'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink">
              <option value="A">A race (goal)</option>
              <option value="B">B race</option>
              <option value="C">C race (training)</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="rounded-full bg-panel px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-60">
            {saving ? 'Saving…' : 'Add to calendar'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main calendar ───────────────────────────────────────────────────────────

// Start with a useful block of history rather than a nearly empty strip above
// today. More history is available on demand, which keeps the first calendar
// load quick for athletes with years of imported activities.
const INITIAL_PAST_WEEKS = 16;
const INITIAL_FUTURE_WEEKS = 16;
const EXTEND_BY_WEEKS = 8;
const MAX_PAST_WEEKS = 104;
const MAX_FUTURE_WEEKS = 104; // plan up to two years out

function formatCalendarRange(startKey, endKey) {
  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

function sumBy(items, pick) {
  return items.reduce((total, item) => total + (Number(pick(item)) || 0), 0);
}

/**
 * Weekly rollup covering both halves of the week: what was planned, and what
 * actually happened. Actuals combine completed plans with imported activities
 * that never had a plan, so a week of unplanned training still totals up.
 */
function summarizeCalendarWeek(days) {
  const workouts = days.flatMap((day) => day.workouts);
  const planned = summarizeWeek(workouts);
  const imported = days.flatMap((day) => day.activities);
  const completedWorkouts = workouts.filter((w) => w.status === 'completed');

  const actualDurationMin = planned.completedDurationMin + sumBy(imported, (a) => a.duration_min);
  const actualDistanceKm = planned.completedDistanceKm + sumBy(imported, (a) => a.distance_km);
  const actualTss = sumBy(completedWorkouts, (w) => w.completed_tss ?? w.planned_tss)
    + sumBy(imported, (a) => a.tss);

  // Per-sport actuals drive the breakdown rows in the week rail.
  const bySport = new Map();
  const addSport = (sport, durationMin, distanceKm) => {
    const key = sport || 'other';
    const current = bySport.get(key) || { sport: key, durationMin: 0, distanceKm: 0, count: 0 };
    current.durationMin += Number(durationMin) || 0;
    current.distanceKm += Number(distanceKm) || 0;
    current.count += 1;
    bySport.set(key, current);
  };
  completedWorkouts.forEach((w) => addSport(w.sport, w.completed_duration_min, w.completed_distance_km));
  imported.forEach((a) => addSport(a.sport, a.duration_min, a.distance_km));

  return {
    ...planned,
    completedSessionCount: planned.completedCount + imported.length,
    importedActivityCount: imported.length,
    actualDurationMin,
    actualDistanceKm,
    actualTss,
    elevationGainM: sumBy(imported, (a) => a.elevation_gain_m),
    kilojoules: sumBy(imported, (a) => a.kilojoules),
    sports: [...bySport.values()].sort((a, b) => b.durationMin - a.durationMin),
    hasActuals: planned.completedCount + imported.length > 0,
  };
}

/** Planned-vs-actual progress bar used in the week rail. */
function ProgressMeter({ label, actual, planned, formatValue, unit = '' }) {
  const hasPlan = Number(planned) > 0;
  const pct = hasPlan ? Math.min(100, Math.round((actual / planned) * 100)) : (actual > 0 ? 100 : 0);
  const onTarget = hasPlan && pct >= 95;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[10px] uppercase tracking-wide text-ink/40">{label}</span>
        <span className="font-mono text-[11px] font-semibold text-ink">
          {formatValue(actual)}{unit}
          {hasPlan && <span className="font-normal text-ink/40"> / {formatValue(planned)}{unit}</span>}
          {onTarget && <span className="text-emerald-600"> ✓</span>}
        </span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-ink/8">
        <div
          className={`h-full rounded-full transition-[width] ${onTarget ? 'bg-emerald-500' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function TrainingCalendar({ athleteId = null, role = 'athlete' }) {
  const router = useRouter();
  const anchorMonday = useMemo(() => mondayOf(new Date()), []);
  const [pastWeeks, setPastWeeks] = useState(INITIAL_PAST_WEEKS);
  const [futureWeeks, setFutureWeeks] = useState(INITIAL_FUTURE_WEEKS);
  const [workouts, setWorkouts] = useState([]);
  const [notes, setNotes] = useState([]);
  const [events, setEvents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [library, setLibrary] = useState([]);
  const [distanceUnitPref, setDistanceUnitPref] = useState('mi');
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [error, setError] = useState('');
  const [editorInitial, setEditorInitial] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [dayMenuKey, setDayMenuKey] = useState(null);
  const [noteEditor, setNoteEditor] = useState(null);
  const [eventEditorDate, setEventEditorDate] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const scrollRef = useRef(null);
  const todayRowRef = useRef(null);
  const didInitialScroll = useRef(false);
  const prependHeightRef = useRef(null);
  const extendingRef = useRef(false);
  const lastOpenedFromQuery = useRef(null);

  const rangeStart = toDateKey(addDays(anchorMonday, -pastWeeks * 7));
  const rangeEnd = toDateKey(addDays(anchorMonday, futureWeeks * 7 + 6));
  const todayKey = toDateKey(new Date());
  const athleteParam = athleteId ? `&athlete_id=${encodeURIComponent(athleteId)}` : '';

  const reload = useCallback(async () => {
    setError('');
    try {
      const [workoutsRes, notesRes, eventsRes] = await Promise.all([
        fetch(`/api/planned-workouts?start=${rangeStart}&end=${rangeEnd}${athleteParam}`),
        fetch(`/api/calendar-notes?start=${rangeStart}&end=${rangeEnd}${athleteParam}`),
        role === 'athlete' ? fetch('/api/race-events') : Promise.resolve(null),
      ]);
      if (!workoutsRes.ok) {
        const d = await workoutsRes.json().catch(() => ({}));
        setError(d.error || 'Could not load the training calendar.');
        return;
      }
      const workoutsData = await workoutsRes.json();
      setWorkouts(workoutsData.workouts || []);
      setActivities(workoutsData.activities || []);
      if (notesRes?.ok) {
        const notesData = await notesRes.json();
        setNotes(notesData.notes || []);
      }
      if (eventsRes?.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData.events || []);
      }
    } catch {
      setError('Could not load the training calendar.');
    } finally {
      setLoading(false);
      setLoadingEarlier(false);
      extendingRef.current = false;
    }
  }, [rangeStart, rangeEnd, athleteParam, role]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (role !== 'coach') return;
    fetch('/api/workout-library')
      .then((r) => (r.ok ? r.json() : { workouts: [] }))
      .then((d) => setLibrary(d.workouts || []))
      .catch(() => {});
  }, [role]);

  // Distance-unit preference — new workouts default to it (per-workout choice
  // still wins on edit).
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const unit = d?.settings?.distance_unit;
        if (unit === 'mi' || unit === 'km') setDistanceUnitPref(unit);
      })
      .catch(() => {});
  }, []);

  // Deep link: /calendar?workout=<id> opens the workout detail once loaded.
  // Tracks the last id opened this way so navigating to a different workout
  // on the already-mounted calendar re-opens the panel, while closing the
  // panel doesn't immediately re-trigger for the same id.
  useEffect(() => {
    if (!router.isReady) return;
    const target = typeof router.query.workout === 'string' ? router.query.workout : '';
    if (target && target !== lastOpenedFromQuery.current && workouts.some((w) => w.id === target)) {
      lastOpenedFromQuery.current = target;
      setDetailId(target);
    }
  }, [router.isReady, router.query.workout, workouts]);

  // Initial position: scroll the container so this week sits at the top.
  useLayoutEffect(() => {
    if (didInitialScroll.current || loading) return;
    const container = scrollRef.current;
    const row = todayRowRef.current;
    if (container && row) {
      const delta = row.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTop = Math.max(0, container.scrollTop + delta - 44);
      didInitialScroll.current = true;
    }
  });

  // After prepending weeks, restore the visual scroll position.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (container && prependHeightRef.current != null) {
      container.scrollTop += container.scrollHeight - prependHeightRef.current;
      prependHeightRef.current = null;
    }
  }, [pastWeeks]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container || extendingRef.current || !didInitialScroll.current) return;
    if (container.scrollTop < 240 && pastWeeks < MAX_PAST_WEEKS) {
      extendingRef.current = true;
      prependHeightRef.current = container.scrollHeight;
      setLoadingEarlier(true);
      setPastWeeks((p) => Math.min(MAX_PAST_WEEKS, p + EXTEND_BY_WEEKS));
      return;
    }
    if (
      container.scrollTop > container.scrollHeight - container.clientHeight - 640 &&
      futureWeeks < MAX_FUTURE_WEEKS
    ) {
      extendingRef.current = true;
      setFutureWeeks((f) => Math.min(MAX_FUTURE_WEEKS, f + EXTEND_BY_WEEKS));
    }
  }, [pastWeeks, futureWeeks]);

  const loadEarlierWeeks = useCallback(() => {
    const container = scrollRef.current;
    if (pastWeeks >= MAX_PAST_WEEKS || extendingRef.current) return;
    extendingRef.current = true;
    if (container) prependHeightRef.current = container.scrollHeight;
    setLoadingEarlier(true);
    setPastWeeks((weeks) => Math.min(MAX_PAST_WEEKS, weeks + EXTEND_BY_WEEKS));
  }, [pastWeeks]);

  const scrollToToday = useCallback(() => {
    const container = scrollRef.current;
    const row = todayRowRef.current;
    if (container && row) {
      const delta = row.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTo({ top: Math.max(0, container.scrollTop + delta - 44), behavior: 'smooth' });
    }
  }, []);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveWorkout = useCallback(async (form) => {
    const isUpdate = Boolean(form.id);
    let res;
    try {
      res = await fetch('/api/planned-workouts', {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, athlete_id: athleteId || undefined }),
      });
    } catch {
      return { ok: false, error: 'Network error — check your connection and try again.' };
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || `Save failed (${res.status}). Please try again.` };
    }
    await reload();
    return { ok: true };
  }, [athleteId, reload]);

  const updateWorkout = useCallback(async (id, updates) => {
    const res = await fetch('/api/planned-workouts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) await reload();
  }, [reload]);

  const deleteWorkout = useCallback(async (id) => {
    const res = await fetch(`/api/planned-workouts?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDetailId(null);
      await reload();
    }
  }, [reload]);

  const saveNote = useCallback(async (form) => {
    const isUpdate = Boolean(form.id);
    const res = await fetch('/api/calendar-notes', {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, athlete_id: athleteId || undefined }),
    });
    if (!res.ok) return false;
    await reload();
    return true;
  }, [athleteId, reload]);

  const deleteNote = useCallback(async (id) => {
    const res = await fetch(`/api/calendar-notes?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setNoteEditor(null);
      await reload();
    }
  }, [reload]);

  const saveEvent = useCallback(async (payload) => {
    const res = await fetch('/api/race-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    await reload();
    return true;
  }, [reload]);

  const saveToLibrary = useCallback(async (form) => {
    const res = await fetch('/api/workout-library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.title,
        sport: form.sport,
        description: form.description,
        structure: form.structure,
        planned_duration_min: form.planned_duration_min === '' ? null : form.planned_duration_min,
        planned_distance_km: form.planned_distance_km === '' ? null : form.planned_distance_km,
        planned_distance_unit: form.planned_distance_unit || 'mi',
      }),
    });
    if (!res.ok) return false;
    const d = await res.json();
    setLibrary((prev) => [d.workout, ...prev]);
    return true;
  }, []);

  const applyLibraryWorkout = useCallback(async (libraryWorkoutId, date) => {
    const res = await fetch('/api/planned-workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        athlete_id: athleteId || undefined,
        library_workout_id: libraryWorkoutId,
        workout_date: date,
      }),
    });
    if (res.ok) await reload();
  }, [athleteId, reload]);

  const copyWeekForward = useCallback(async (fromWeekStartKey) => {
    const toWeekStart = toDateKey(addDays(new Date(`${fromWeekStartKey}T00:00:00`), 7));
    const res = await fetch('/api/planned-workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'copy_week',
        athlete_id: athleteId || undefined,
        from_week_start: fromWeekStartKey,
        to_week_start: toWeekStart,
      }),
    });
    if (res.ok) await reload();
    else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Could not copy week.');
    }
  }, [athleteId, reload]);

  // ── Derived rows ───────────────────────────────────────────────────────────

  const workoutsByDate = useMemo(() => {
    const map = new Map();
    workouts.forEach((w) => {
      // Show a completed workout on the day it actually happened (from a
      // matched activity) rather than the day it was planned for.
      const key = w.display_date || w.workout_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(w);
    });
    return map;
  }, [workouts]);

  const activitiesByDate = useMemo(() => {
    const map = new Map();
    activities.forEach((a) => {
      const key = a.activity_date || (a.start_date ? toDateKey(a.start_date) : null);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return map;
  }, [activities]);

  const notesByDate = useMemo(() => {
    const map = new Map();
    notes.forEach((n) => {
      if (!map.has(n.note_date)) map.set(n.note_date, []);
      map.get(n.note_date).push(n);
    });
    return map;
  }, [notes]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    events.forEach((e) => {
      const key = e.event_date ? String(e.event_date).slice(0, 10) : null;
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return map;
  }, [events]);

  const weeks = useMemo(() => {
    return Array.from({ length: pastWeeks + futureWeeks }).map((_, idx) => {
      const weekStart = addDays(anchorMonday, (idx - pastWeeks) * 7);
      const days = Array.from({ length: 7 }).map((_, i) => {
        const date = addDays(weekStart, i);
        const key = toDateKey(date);
        return {
          date,
          key,
          workouts: workoutsByDate.get(key) || [],
          notes: notesByDate.get(key) || [],
          events: eventsByDate.get(key) || [],
          activities: activitiesByDate.get(key) || [],
        };
      });
      const firstOfMonth = days.find((d) => d.date.getDate() === 1);
      return {
        key: toDateKey(weekStart),
        isCurrentWeek: toDateKey(weekStart) === toDateKey(anchorMonday),
        monthLabel: firstOfMonth
          ? firstOfMonth.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : null,
        days,
        summary: summarizeCalendarWeek(days),
      };
    });
  }, [anchorMonday, pastWeeks, futureWeeks, workoutsByDate, notesByDate, eventsByDate, activitiesByDate]);

  const detailWorkout = detailId ? workouts.find((w) => w.id === detailId) || null : null;
  const dayMenuDate = dayMenuKey ? new Date(`${dayMenuKey}T00:00:00`) : null;

  function openWorkoutEditor(dateKey, sport = 'run') {
    setDayMenuKey(null);
    setEditorInitial({ ...emptyForm, workout_date: dateKey, sport });
  }

  async function addDayOff(dateKey) {
    setDayMenuKey(null);
    await saveNote({ note_date: dateKey, title: 'Day off', body: '', note_type: 'day_off' });
  }

  function noteEditable(note) {
    if (role === 'coach') return Boolean(note.coach_id);
    return !note.coach_id;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {editorInitial && (
        <WorkoutEditor
          initial={editorInitial}
          canEditPlan
          defaultDistanceUnit={distanceUnitPref}
          onSave={saveWorkout}
          onSaveToLibrary={role === 'coach' ? saveToLibrary : null}
          onClose={() => setEditorInitial(null)}
        />
      )}
      {detailWorkout && (
        <WorkoutDetail
          workout={detailWorkout}
          role={role}
          onUpdate={updateWorkout}
          onEdit={(w) => {
            setDetailId(null);
            setEditorInitial({
              id: w.id,
              title: w.title,
              sport: w.sport,
              workout_date: w.workout_date,
              description: w.description || '',
              objective: w.objective || '',
              coach_instructions: w.coach_instructions || '',
              target_metric: w.target_metric || 'duration',
              planned_if: w.planned_if ?? '',
              visibility: w.visibility || 'athlete_visible',
              planned_duration_min: w.planned_duration_min ?? '',
              planned_distance_km: w.planned_distance_km ?? '',
              planned_distance_unit: w.planned_distance_unit || null,
              structure: Array.isArray(w.structure) ? w.structure : [],
            });
          }}
          onDelete={deleteWorkout}
          onClose={() => setDetailId(null)}
        />
      )}
      {dayMenuDate && (
        <DayMenu
          date={dayMenuDate}
          role={role}
          onAddWorkout={(sport) => openWorkoutEditor(dayMenuKey, sport)}
          onAddDayOff={() => addDayOff(dayMenuKey)}
          onAddNote={(type) => {
            const dateKey = dayMenuKey;
            setDayMenuKey(null);
            setNoteEditor({ note_date: dateKey, note_type: typeof type === 'string' ? type : 'general' });
          }}
          onAddEvent={() => {
            const dateKey = dayMenuKey;
            setDayMenuKey(null);
            setEventEditorDate(dateKey);
          }}
          onClose={() => setDayMenuKey(null)}
        />
      )}
      {noteEditor && (
        <NoteEditor
          initial={noteEditor}
          role={role}
          canEdit={noteEditor.id ? noteEditable(noteEditor) : true}
          onSave={saveNote}
          onDelete={deleteNote}
          onClose={() => setNoteEditor(null)}
        />
      )}
      {eventEditorDate && (
        <EventEditor date={eventEditorDate} onSave={saveEvent} onClose={() => setEventEditorDate(null)} />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-ink/10 bg-white p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="min-w-[190px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">Calendar range</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{formatCalendarRange(rangeStart, rangeEnd)}</p>
          </div>
          <div className="flex items-center gap-2 border-l border-ink/10 pl-3">
            <button
              onClick={loadEarlierWeeks}
              disabled={pastWeeks >= MAX_PAST_WEEKS || loadingEarlier}
              className="rounded-full border border-ink/10 px-3 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-45"
              title="Load eight more weeks of previous workouts"
            >
              {loadingEarlier ? 'Loading history…' : pastWeeks >= MAX_PAST_WEEKS ? 'History limit reached' : '← Earlier workouts'}
            </button>
            <button onClick={scrollToToday} className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink/80 hover:bg-ink/5">Today</button>
          </div>
          <span className="w-full text-xs text-ink/55 sm:w-auto">
            Completed sessions are green; imported activity is blue. Click a day to plan or add context.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {role === 'coach' && (
            <button onClick={() => setLibraryOpen((v) => !v)} className={`rounded-full px-4 py-2 text-sm font-semibold ${libraryOpen ? 'bg-panel text-paper' : 'border border-ink/10 text-ink/70 hover:bg-ink/5'}`}>
              Library ({library.length})
            </button>
          )}
          <button
            onClick={() => setEditorInitial({ ...emptyForm, workout_date: todayKey })}
            className="rounded-full bg-panel px-4 py-2 text-sm font-semibold text-paper"
          >
            + Plan workout
          </button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {/* Library panel */}
      {role === 'coach' && libraryOpen && (
        <div className="mt-4 rounded-[24px] border border-ink/10 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-accent">Workout library</p>
          {!library.length ? (
            <p className="mt-3 text-sm text-ink/55">No saved workouts yet. Open a workout and use “Save to library”.</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {library.map((item) => (
                <LibraryCard
                  key={item.id}
                  item={item}
                  onApply={(date) => applyLibraryWorkout(item.id, date)}
                  onDelete={async () => {
                    const res = await fetch(`/api/workout-library?id=${item.id}`, { method: 'DELETE' });
                    if (res.ok) setLibrary((prev) => prev.filter((x) => x.id !== item.id));
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Continuous calendar */}
      {loading ? (
        <div className="mt-4 rounded-[24px] border border-ink/10 bg-white p-8 text-center text-sm text-ink/55">Loading calendar…</div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative mt-4 h-[72vh] min-h-[520px] overflow-y-auto overscroll-contain rounded-[24px] border border-ink/10 bg-paper/70 p-3"
        >
          <div className="-mx-1 mb-2 flex items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2 text-xs text-ink/60">
            <span>
              {pastWeeks >= MAX_PAST_WEEKS
                ? 'The calendar history limit has been reached.'
                : `Showing ${pastWeeks} weeks before today. Load earlier workouts whenever you need them.`}
            </span>
            {pastWeeks < MAX_PAST_WEEKS && (
              <button
                onClick={loadEarlierWeeks}
                disabled={loadingEarlier}
                className="shrink-0 font-semibold text-accent hover:underline disabled:opacity-50"
              >
                {loadingEarlier ? 'Loading…' : 'Load 8 more weeks'}
              </button>
            )}
          </div>
          {/* Weekday header (sticky) */}
          <div className="sticky top-0 z-20 -mx-3 -mt-3 mb-2 grid grid-cols-7 gap-2 border-b border-ink/8 bg-paper/95 px-3 pb-2 pt-3 backdrop-blur lg:grid-cols-[repeat(7,1fr)_150px]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <p key={d} className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45">{d}</p>
            ))}
            <p className="hidden text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45 lg:block">Week totals</p>
          </div>

          {weeks.map((week) => (
            <div key={week.key} data-week-key={week.key} ref={week.isCurrentWeek ? todayRowRef : null}>
              {week.monthLabel && (
                <div className="my-3 flex items-center gap-3">
                  <span className="rounded-full bg-panel px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-paper">{week.monthLabel}</span>
                  <span className="h-px flex-1 bg-ink/10" />
                </div>
              )}
              <div className="mb-2 grid grid-cols-7 gap-2 lg:grid-cols-[repeat(7,1fr)_150px]">
                {week.days.map((day) => {
                  const isToday = day.key === todayKey;
                  const isPast = day.key < todayKey;
                  return (
                    <div
                      key={day.key}
                      onClick={() => setDayMenuKey(day.key)}
                      className={`group min-h-[132px] cursor-pointer rounded-2xl border p-2 transition ${
                        isToday
                          ? 'border-accent/50 bg-accent/5 ring-1 ring-accent/30'
                          : isPast
                            ? 'border-ink/8 bg-white/70 hover:border-ink/20'
                            : 'border-ink/10 bg-white hover:border-ink/25'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isToday ? 'rounded-full bg-accent px-1.5 py-0.5 text-white' : 'text-ink/45'}`}>
                          {day.date.getDate() === 1
                            ? day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : day.date.getDate()}
                        </span>
                        <span className="hidden text-sm text-ink/25 transition group-hover:inline">+</span>
                      </div>
                      <div className="mt-1.5 space-y-1.5">
                        {day.events.map((event) => (
                          <a
                            key={`event-${event.id}`}
                            href="/races"
                            onClick={(e) => e.stopPropagation()}
                            className="block rounded-xl border border-amber-300/60 bg-amber-50 px-2 py-1.5 text-left"
                          >
                            <p className="truncate text-xs font-semibold text-amber-900">🏁 {event.name}</p>
                            {event.priority && <p className="text-[10px] text-amber-800/70">{event.priority} race{event.race_type ? ` · ${event.race_type}` : ''}</p>}
                          </a>
                        ))}
                        {day.workouts.map((w) => (
                          <button
                            key={w.id}
                            onClick={(e) => { e.stopPropagation(); setDetailId(w.id); }}
                            className={`block w-full rounded-xl border px-2 py-1.5 text-left transition hover:border-ink/30 ${
                              w.status === 'completed'
                                ? 'border-emerald-200 bg-emerald-50/75'
                                : w.status === 'skipped'
                                  ? 'border-rose-100 bg-rose-50/50'
                                  : 'border-ink/8 bg-paper'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${COMPLIANCE_DOT[w.compliance_status] || COMPLIANCE_DOT.none}`} />
                              <span className="truncate text-xs font-semibold text-ink">
                                {w.status === 'completed' ? '✓ ' : ''}{SPORT_EMOJI[w.sport] || '⚡'} {w.title}
                              </span>
                            </div>
                            {w.status === 'completed' ? (
                              <>
                                <p className="mt-0.5 truncate font-mono text-[11px] font-semibold text-emerald-800">
                                  {[
                                    fmtDuration(w.completed_duration_min),
                                    formatDistance(w.completed_distance_km, w.planned_distance_unit),
                                    w.compliance_pct != null ? `${w.compliance_pct}%` : null,
                                  ].filter(Boolean).join(' · ')}
                                </p>
                                {/* Planned reference, so the actual above always has something to be judged against. */}
                                {(w.planned_duration_min || w.planned_distance_km) && (
                                  <p className="truncate text-[10px] text-ink/40">
                                    P: {[
                                      fmtDuration(w.planned_duration_min),
                                      formatDistance(w.planned_distance_km, w.planned_distance_unit),
                                    ].filter(Boolean).join(' · ')}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="mt-0.5 truncate text-[11px] text-ink/55">
                                {[
                                  fmtDuration(w.planned_duration_min),
                                  formatDistance(w.planned_distance_km, w.planned_distance_unit),
                                  w.planned_tss ? `TSS ${Math.round(w.planned_tss)}` : null,
                                  w.status === 'skipped' ? 'Skipped' : null,
                                ].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            {(w.athlete_rpe != null || w.comment_count > 0) && (
                              <p className="mt-0.5 flex items-center gap-2 text-[10px] text-ink/45">
                                {w.athlete_rpe != null && <span title={`Perceived effort ${w.athlete_rpe}/10`}>RPE {w.athlete_rpe}</span>}
                                {w.comment_count > 0 && <span title={`${w.comment_count} comment${w.comment_count === 1 ? '' : 's'}`}>💬 {w.comment_count}</span>}
                              </p>
                            )}
                          </button>
                        ))}
                        {day.activities.map((activity) => (
                          <div
                            key={`activity-${activity.id}`}
                            onClick={(e) => e.stopPropagation()}
                            title="Imported activity with no planned workout"
                            className="rounded-xl border border-sky-200 bg-sky-50/70 px-2 py-1.5"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-semibold text-ink">{SPORT_EMOJI[activity.sport] || '⚡'} {activity.name}</span>
                            </div>
                            <p className="mt-0.5 truncate font-mono text-[11px] font-semibold text-sky-900">
                              {[
                                fmtDuration(activity.duration_min),
                                formatDistance(activity.distance_km, distanceUnitPref),
                                activity.tss ? `${activity.tss} TSS` : null,
                              ].filter(Boolean).join(' · ')}
                            </p>
                            <p className="truncate text-[10px] text-sky-800/60">
                              {[
                                fmtElevation(activity.elevation_gain_m, distanceUnitPref),
                                activity.average_heartrate ? `${activity.average_heartrate} bpm` : null,
                              ].filter(Boolean).join(' · ') || 'Unplanned'}
                            </p>
                          </div>
                        ))}
                        {day.notes.map((note) => {
                          const meta = NOTE_META[note.note_type] || NOTE_META.general;
                          return (
                            <button
                              key={`note-${note.id}`}
                              onClick={(e) => { e.stopPropagation(); setNoteEditor(note); }}
                              className={`block w-full rounded-xl border px-2 py-1.5 text-left ${meta.card}`}
                            >
                              <p className="truncate text-xs font-semibold text-ink/75">{meta.icon} {note.title}</p>
                              {note.visibility === 'coach_private' && <p className="text-[10px] text-ink/40">Private draft</p>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Week summary (TrainingPeaks-style right rail) */}
                <div className="hidden flex-col justify-between rounded-2xl border border-ink/10 bg-white/80 p-2.5 lg:flex">
                  <div className="space-y-2 text-[11px] leading-4 text-ink/65">
                    <p className="font-semibold text-ink/45">
                      {week.days[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {week.days[6].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>

                    <ProgressMeter
                      label="Duration"
                      actual={week.summary.actualDurationMin}
                      planned={week.summary.plannedDurationMin}
                      formatValue={(v) => fmtDuration(v) || '0m'}
                    />
                    <ProgressMeter
                      label="Distance"
                      actual={week.summary.actualDistanceKm}
                      planned={week.summary.plannedDistanceKm}
                      formatValue={(v) => kmToUnit(v, distanceUnitPref) || 0}
                      unit={` ${distanceUnitPref}`}
                    />
                    <ProgressMeter
                      label="TSS"
                      actual={week.summary.actualTss}
                      planned={week.summary.plannedTss}
                      formatValue={(v) => Math.round(v)}
                    />

                    {(week.summary.elevationGainM > 0 || week.summary.kilojoules > 0) && (
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 border-t border-ink/8 pt-1.5 text-[10px] text-ink/55">
                        {week.summary.elevationGainM > 0 && (
                          <span>El. <span className="font-mono font-semibold text-ink">{fmtElevation(week.summary.elevationGainM, distanceUnitPref)}</span></span>
                        )}
                        {week.summary.kilojoules > 0 && (
                          <span>Work <span className="font-mono font-semibold text-ink">{Math.round(week.summary.kilojoules)}</span> kJ</span>
                        )}
                      </div>
                    )}

                    {week.summary.sports.length > 0 && (
                      <div className="space-y-0.5 border-t border-ink/8 pt-1.5 text-[10px]">
                        {week.summary.sports.map((sport) => (
                          <div key={sport.sport} className="flex items-baseline justify-between gap-1">
                            <span className="truncate text-ink/55">{SPORT_EMOJI[sport.sport] || '⚡'} {sport.count}</span>
                            <span className="font-mono text-ink/70">
                              {fmtDuration(sport.durationMin) || '0m'}
                              {sport.distanceKm > 0 ? ` · ${kmToUnit(sport.distanceKm, distanceUnitPref)}${distanceUnitPref}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="border-t border-ink/8 pt-1.5 text-[10px] text-ink/50">
                      <span className="font-mono font-semibold text-ink">{week.summary.completedSessionCount}</span> completed
                      {week.summary.totalCount > 0 ? ` of ${week.summary.totalCount} planned` : ''}
                      {week.summary.importedActivityCount ? ` · ${week.summary.importedActivityCount} imported` : ''}
                    </p>
                  </div>
                  {week.summary.totalCount > 0 && (
                    <button
                      onClick={() => copyWeekForward(week.key)}
                      className="mt-2 rounded-full border border-ink/10 px-2 py-1 text-[10px] font-semibold text-ink/60 hover:bg-ink/5"
                      title="Copy this week's workouts to next week"
                    >
                      Copy → next wk
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile week summary */}
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-white/60 px-3 py-1.5 text-[11px] text-ink/60 lg:hidden">
                <span className="font-semibold text-ink/45">{week.days[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} wk</span>
                <span>
                  Planned {fmtDuration(week.summary.plannedDurationMin) || '0m'} · {kmToUnit(week.summary.plannedDistanceKm, distanceUnitPref) || 0} {distanceUnitPref} · TSS {Math.round(week.summary.plannedTss)}
                </span>
                {week.summary.hasActuals && (
                  <span className="font-semibold text-ink/75">
                    Actual {fmtDuration(week.summary.actualDurationMin) || '0m'} · {kmToUnit(week.summary.actualDistanceKm, distanceUnitPref) || 0} {distanceUnitPref} · TSS {Math.round(week.summary.actualTss)}
                    {week.summary.elevationGainM > 0 ? ` · ${fmtElevation(week.summary.elevationGainM, distanceUnitPref)}` : ''}
                  </span>
                )}
                <span>{week.summary.completedSessionCount} completed{week.summary.importedActivityCount ? ` · ${week.summary.importedActivityCount} imported` : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryCard({ item, onApply, onDelete }) {
  const [date, setDate] = useState(toDateKey(new Date()));
  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{SPORT_EMOJI[item.sport] || '⚡'} {item.name}</p>
        <button onClick={onDelete} className="rounded-full px-1.5 text-xs text-ink/40 hover:text-rose-600">✕</button>
      </div>
      <p className="mt-1 text-[11px] text-ink/55">
        {[
          fmtDuration(item.planned_duration_min),
          formatDistance(item.planned_distance_km, item.planned_distance_unit),
          item.planned_tss ? `TSS ${Math.round(item.planned_tss)}` : null,
        ].filter(Boolean).join(' · ') || 'No targets'}
      </p>
      <div className="mt-2 flex gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 rounded-lg border border-ink/10 bg-white px-2 py-1 text-xs text-ink" />
        <button onClick={() => onApply(date)} className="rounded-lg bg-panel px-3 py-1 text-xs font-semibold text-paper">Add</button>
      </div>
    </div>
  );
}
