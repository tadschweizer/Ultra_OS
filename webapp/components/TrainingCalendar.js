import { useCallback, useEffect, useMemo, useState } from 'react';
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

function fmtDay(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDuration(min) {
  if (min == null) return null;
  const m = Math.round(Number(min));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
}

const SPORT_EMOJI = {
  run: '🏃', bike: '🚴', swim: '🏊', strength: '🏋️', row: '🚣', ski: '⛷️', hike: '🥾', other: '⚡',
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
  structure: [],
};

// ─── Structured workout editor ───────────────────────────────────────────────

function StepRow({ step, onChange, onRemove }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-ink/10 bg-paper p-3 sm:grid-cols-[1fr_64px_88px_1fr_1fr_80px_auto]">
      <select
        value={step.type}
        onChange={(e) => onChange({ ...step, type: e.target.value })}
        className="rounded-xl border border-ink/10 bg-white px-2 py-1.5 text-xs text-ink"
      >
        {STEP_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <input
        type="number"
        min="1"
        value={step.repeat}
        onChange={(e) => onChange({ ...step, repeat: Number(e.target.value) || 1 })}
        title="Repeats"
        className="rounded-xl border border-ink/10 bg-white px-2 py-1.5 text-xs text-ink"
      />
      <input
        type="number"
        min="0"
        step="0.5"
        value={step.duration_min}
        onChange={(e) => onChange({ ...step, duration_min: e.target.value === '' ? '' : Number(e.target.value) })}
        title="Minutes per repeat"
        placeholder="min"
        className="rounded-xl border border-ink/10 bg-white px-2 py-1.5 text-xs text-ink"
      />
      <select
        value={step.intensity}
        onChange={(e) => onChange({ ...step, intensity: e.target.value })}
        className="rounded-xl border border-ink/10 bg-white px-2 py-1.5 text-xs text-ink"
      >
        {INTENSITY_ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
      </select>
      <select
        value={step.target_type || 'open'}
        onChange={(e) => onChange({ ...step, target_type: e.target.value })}
        className="rounded-xl border border-ink/10 bg-white px-2 py-1.5 text-xs text-ink"
      >
        <option value="open">Open target</option>
        <option value="pace">Pace</option>
        <option value="heart_rate">Heart rate</option>
        <option value="power">Power</option>
        <option value="rpe">RPE</option>
      </select>
      <input
        value={step.target_min || ''}
        onChange={(e) => onChange({ ...step, target_min: e.target.value })}
        placeholder="Min"
        className="rounded-xl border border-ink/10 bg-white px-2 py-1.5 text-xs text-ink"
      />
      <button
        type="button"
        onClick={onRemove}
        className="rounded-xl border border-ink/10 px-2 py-1.5 text-xs text-ink/50 hover:border-rose-200 hover:text-rose-600"
      >
        ✕
      </button>
      <input
        value={step.notes || ''}
        onChange={(e) => onChange({ ...step, notes: e.target.value })}
        placeholder="Step notes (e.g. 4×8min @ threshold, 2min jog recovery)"
        className="col-span-2 rounded-xl border border-ink/10 bg-white px-2 py-1.5 text-xs text-ink sm:col-span-7"
      />
    </div>
  );
}

function WorkoutEditor({ initial, canEditPlan, onSave, onSaveToLibrary, onClose }) {
  const [form, setForm] = useState({ ...emptyForm, ...initial });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const structureTotals = useMemo(() => summarizeStructure(form.structure), [form.structure]);
  const tssEstimate = useMemo(
    () => estimateTss(form.structure, Number(form.planned_duration_min) || structureTotals.durationMin || null),
    [form.structure, form.planned_duration_min, structureTotals.durationMin]
  );

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateStep(index, step) {
    setForm((f) => ({ ...f, structure: f.structure.map((s, i) => (i === index ? step : s)) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const ok = await onSave({
      ...form,
      planned_duration_min: form.planned_duration_min === '' ? null : Number(form.planned_duration_min),
      planned_distance_km: form.planned_distance_km === '' ? null : Number(form.planned_distance_km),
      planned_tss: tssEstimate,
      planned_if: form.planned_if === '' ? null : Number(form.planned_if),
    });
    setSaving(false);
    if (ok) onClose();
    else setMessage('Could not save workout. Please try again.');
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
              <label className="mb-1 block text-xs text-ink/55">Planned distance (km)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                disabled={!canEditPlan}
                value={form.planned_distance_km}
                placeholder={structureTotals.distanceKm ? String(structureTotals.distanceKm) : ''}
                onChange={(e) => setField('planned_distance_km', e.target.value)}
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
                  const ok = await onSaveToLibrary(form);
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
  const [completion, setCompletion] = useState({
    completed_duration_min: workout.completed_duration_min ?? workout.planned_duration_min ?? '',
    completed_distance_km: workout.completed_distance_km ?? workout.planned_distance_km ?? '',
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
                workout.planned_distance_km && `${workout.planned_distance_km} km`,
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
              {workout.completed_distance_km ? ` · ${workout.completed_distance_km} km` : ''}
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
                placeholder="Distance (km)"
                value={completion.completed_distance_km}
                onChange={(e) => setCompletion((c) => ({ ...c, completed_distance_km: e.target.value }))}
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
                  completed_distance_km: completion.completed_distance_km === '' ? null : Number(completion.completed_distance_km),
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
          <p className="text-xs uppercase tracking-[0.22em] text-ink/55">Workout discussion</p>
          <div className="mt-3 space-y-2">
            {!comments.length && <p className="text-sm text-ink/50">No comments yet.</p>}
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-xl bg-paper p-3 text-sm text-ink/75">
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink/45">{comment.sender_role}</p>
                <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a workout comment…"
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

// ─── Main calendar ───────────────────────────────────────────────────────────

export default function TrainingCalendar({ athleteId = null, role = 'athlete' }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [workouts, setWorkouts] = useState([]);
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorInitial, setEditorInitial] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  const rangeStart = toDateKey(weekStart);
  const rangeEnd = toDateKey(addDays(weekStart, 13));
  const todayKey = toDateKey(new Date());

  const athleteParam = athleteId ? `&athlete_id=${encodeURIComponent(athleteId)}` : '';

  const reload = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(`/api/planned-workouts?start=${rangeStart}&end=${rangeEnd}${athleteParam}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Could not load the training calendar.');
        return;
      }
      const data = await res.json();
      setWorkouts(data.workouts || []);
    } catch {
      setError('Could not load the training calendar.');
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd, athleteParam]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  useEffect(() => {
    if (role !== 'coach') return;
    fetch('/api/workout-library')
      .then((r) => (r.ok ? r.json() : { workouts: [] }))
      .then((d) => setLibrary(d.workouts || []))
      .catch(() => {});
  }, [role]);

  const saveWorkout = useCallback(async (form) => {
    const isUpdate = Boolean(form.id);
    const res = await fetch('/api/planned-workouts', {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, athlete_id: athleteId || undefined }),
    });
    if (!res.ok) return false;
    await reload();
    return true;
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

  const copyWeekForward = useCallback(async () => {
    setCopying(true);
    try {
      const res = await fetch('/api/planned-workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy_week',
          athlete_id: athleteId || undefined,
          from_week_start: rangeStart,
          to_week_start: toDateKey(addDays(weekStart, 7)),
        }),
      });
      if (res.ok) await reload();
      else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Could not copy week.');
      }
    } finally {
      setCopying(false);
    }
  }, [athleteId, rangeStart, weekStart, reload]);

  const weeks = useMemo(() => {
    return [0, 1].map((w) => {
      const days = Array.from({ length: 7 }).map((_, i) => {
        const date = addDays(weekStart, w * 7 + i);
        const key = toDateKey(date);
        return { date, key, workouts: workouts.filter((x) => x.workout_date === key) };
      });
      return { days, summary: summarizeWeek(days.flatMap((d) => d.workouts)) };
    });
  }, [weekStart, workouts]);

  const detailWorkout = detailId ? workouts.find((w) => w.id === detailId) || null : null;

  return (
    <div>
      {editorInitial && (
        <WorkoutEditor
          initial={editorInitial}
          canEditPlan
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
              structure: Array.isArray(w.structure) ? w.structure : [],
            });
          }}
          onDelete={deleteWorkout}
          onClose={() => setDetailId(null)}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-ink/10 bg-white p-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart((d) => addDays(d, -7))} className="rounded-full border border-ink/10 px-4 py-2 text-sm text-ink/70 hover:bg-ink/5">← Prev</button>
          <button onClick={() => setWeekStart(mondayOf(new Date()))} className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink/80 hover:bg-ink/5">Today</button>
          <button onClick={() => setWeekStart((d) => addDays(d, 7))} className="rounded-full border border-ink/10 px-4 py-2 text-sm text-ink/70 hover:bg-ink/5">Next →</button>
          <span className="ml-2 text-sm font-semibold text-ink">
            {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {addDays(weekStart, 13).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyWeekForward} disabled={copying} className="rounded-full border border-ink/10 px-4 py-2 text-sm text-ink/70 hover:bg-ink/5 disabled:opacity-60">
            {copying ? 'Copying…' : 'Copy week → next'}
          </button>
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

      {/* Calendar weeks */}
      {loading ? (
        <div className="mt-4 rounded-[24px] border border-ink/10 bg-white p-8 text-center text-sm text-ink/55">Loading calendar…</div>
      ) : (
        weeks.map((week, wi) => (
          <div key={wi} className="mt-4">
            <div className="grid gap-2 lg:grid-cols-7">
              {week.days.map((day) => (
                <div
                  key={day.key}
                  className={`min-h-[120px] rounded-2xl border p-2.5 ${day.key === todayKey ? 'border-accent/40 bg-accent/5' : 'border-ink/10 bg-white'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-semibold ${day.key === todayKey ? 'text-accent' : 'text-ink/55'}`}>{fmtDay(day.date)}</p>
                    <button
                      onClick={() => setEditorInitial({ ...emptyForm, workout_date: day.key })}
                      title="Plan workout"
                      className="rounded-full px-1.5 text-sm text-ink/35 hover:bg-ink/5 hover:text-ink/70"
                    >
                      +
                    </button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {day.workouts.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => setDetailId(w.id)}
                        className="block w-full rounded-xl border border-ink/8 bg-paper px-2.5 py-2 text-left transition hover:border-ink/25"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COMPLIANCE_DOT[w.compliance_status] || COMPLIANCE_DOT.none}`} />
                          <span className="truncate text-xs font-semibold text-ink">{SPORT_EMOJI[w.sport] || '⚡'} {w.title}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-ink/55">
                          {[
                            fmtDuration(w.planned_duration_min),
                            w.planned_distance_km ? `${w.planned_distance_km}km` : null,
                            w.planned_tss ? `TSS ${Math.round(w.planned_tss)}` : null,
                          ].filter(Boolean).join(' · ')}
                          {w.status === 'completed' && w.compliance_pct != null ? ` · ✓ ${w.compliance_pct}%` : w.status === 'skipped' ? ' · skipped' : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Week summary */}
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-2xl border border-ink/10 bg-paper px-4 py-2.5 text-xs text-ink/65">
              <span className="font-semibold uppercase tracking-[0.18em] text-ink/45">Week {wi === 0 ? 'A' : 'B'} totals</span>
              <span>Planned {fmtDuration(week.summary.plannedDurationMin) || '0m'} · {Math.round(week.summary.plannedDistanceKm * 10) / 10} km · TSS {Math.round(week.summary.plannedTss)}</span>
              <span>Completed {fmtDuration(week.summary.completedDurationMin) || '0m'} · {week.summary.completedCount}/{week.summary.totalCount} sessions</span>
              {week.summary.compliancePct != null && (
                <span className={`rounded-full px-2 py-0.5 font-semibold ${week.summary.compliancePct >= 80 ? 'bg-emerald-100 text-emerald-700' : week.summary.compliancePct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                  {week.summary.compliancePct}% compliance
                </span>
              )}
            </div>
          </div>
        ))
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
          item.planned_distance_km ? `${item.planned_distance_km}km` : null,
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
