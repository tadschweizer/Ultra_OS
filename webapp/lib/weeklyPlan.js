import { validateWorkoutFields, validWorkoutRequestId } from './workoutValidation.js';

export const prescriptionFields = ['sport', 'title', 'description', 'structure', 'planned_duration_min',
  'planned_distance_km', 'planned_distance_unit', 'planned_tss', 'order_index', 'objective',
  'coach_instructions', 'target_metric', 'planned_if'];
export const dateAfter = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export function prescription(source) {
  return Object.fromEntries(prescriptionFields.filter(k => source[k] !== undefined).map(k => [k, source[k]]));
}
export function validateWeek(body) {
  if (!validWorkoutRequestId(body.request_id) || !validWorkoutRequestId(body.athlete_id)) return 'Invalid planning request.';
  if (!body.week_start || validateWorkoutFields({ workout_date: body.week_start })) return 'Choose a valid destination week.';
  if (!Array.isArray(body.entries) || !body.entries.length || body.entries.length > 100) return 'Choose 1–100 workouts.';
  if (!Array.isArray(body.occupied_ids) || body.occupied_ids.length > 500 || !body.occupied_ids.every(validWorkoutRequestId)) return 'Refresh the destination preview.';
  if (body.targets_confirmed !== true) return 'Confirm the prescriptions and targets for this athlete.';
  for (const entry of body.entries) {
    if (!['workout', 'library'].includes(entry.source_type) || !validWorkoutRequestId(entry.source_id) || !entry.source_updated_at) return 'Refresh the source workouts.';
    const p = entry.prescription;
    if (!p || !p.title || !p.sport || !p.workout_date || !Array.isArray(p.structure)) return 'Each workout needs a title, sport, date and structure.';
    const error = validateWorkoutFields(p); if (error) return error;
    if (p.workout_date < body.week_start || p.workout_date > dateAfter(body.week_start, 6)) return 'Keep every workout within the selected week.';
    if (Object.keys(p).some(k => ![...prescriptionFields, 'workout_date'].includes(k))) return 'Only prescriptions can be copied.';
    if (p.structure.some(step=>!step||typeof step!=='object'||Array.isArray(step))) return 'Enter a valid workout structure.';
    if (p.structure.length > 100 || JSON.stringify(p).length > 50000) return 'This workout is too large.';
  }
  return null;
}
