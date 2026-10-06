export function validWorkoutRequestId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function sameWorkoutRequest(stored, payload) {
  if (!stored) return false;
  return Object.entries(payload).every(([key, value]) => JSON.stringify(canonical(stored[key])) === JSON.stringify(canonical(value)));
}

export function validateWorkoutFields(body) {
  if ('workout_date' in body) {
    const value = body.workout_date;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
      return 'Choose a valid workout date.';
    }
  }
  if ('title' in body && (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200)) {
    return 'Enter a workout title of 1–200 characters.';
  }
  for (const field of ['planned_duration_min', 'planned_distance_km', 'planned_tss', 'planned_if', 'completed_duration_min', 'completed_distance_km']) {
    if (body[field] != null && (typeof body[field] !== 'number' || !Number.isFinite(body[field]) || body[field] < 0)) {
      return 'Duration, distance and training targets must be non-negative numbers.';
    }
  }
  if (body.athlete_rpe != null && (!Number.isInteger(body.athlete_rpe) || body.athlete_rpe < 1 || body.athlete_rpe > 10)) {
    return 'Choose an RPE from 1 to 10.';
  }
  if ('status' in body && !['planned', 'completed', 'skipped'].includes(body.status)) return 'Choose a valid completion status.';
  return null;
}
