import { estimateTss, summarizeStructure } from './workoutCompliance.js';
import { validateWorkoutFields } from './workoutValidation.js';

const TARGETS = new Set(['duration', 'distance', 'tss', 'pace', 'heart_rate', 'power', 'rpe']);
const VISIBILITY = new Set(['athlete_visible', 'coach_private']);
function invalid(message) { throw Object.assign(new Error(message), { status: 400 }); }
export function normalizeLibraryPayload(body, { create = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Enter a valid library workout.');
  const payload = {};
  for (const field of ['name', 'sport', 'description', 'objective', 'coach_instructions']) {
    if (body[field] === undefined) continue;
    const nullable = !['name', 'sport'].includes(field);
    if (!(nullable && body[field] === null) && (typeof body[field] !== 'string'
      || body[field].length > (field === 'name' ? 200 : field === 'sport' ? 50 : 10000))) invalid(`Invalid ${field}.`);
    if (!nullable && !body[field].trim()) invalid(`${field} is required.`);
    payload[field] = ['name', 'sport'].includes(field) ? body[field].trim() : body[field];
  }
  if (create && !payload.name) invalid('name is required.');
  if (body.planned_distance_unit !== undefined) {
    if (!['mi', 'km'].includes(body.planned_distance_unit)) invalid('Choose miles or kilometers.');
    payload.planned_distance_unit = body.planned_distance_unit;
  }
  for (const field of ['planned_duration_min', 'planned_distance_km', 'planned_tss', 'planned_if']) {
    if (body[field] !== undefined) payload[field] = body[field] === '' ? null : body[field];
  }
  const validation = validateWorkoutFields(payload);
  if (validation) invalid(validation);
  if (body.structure !== undefined) {
    if (!Array.isArray(body.structure) || body.structure.length > 100
      || body.structure.some(step => !step || typeof step !== 'object' || Array.isArray(step))) invalid('Enter a valid workout structure.');
    payload.structure = body.structure;
  }
  if (body.target_metric !== undefined) {
    if (!TARGETS.has(body.target_metric)) invalid('Choose a valid primary target.');
    payload.target_metric = body.target_metric;
  }
  if (body.visibility !== undefined) {
    if (!VISIBILITY.has(body.visibility)) invalid('Choose a valid workout visibility.');
    payload.visibility = body.visibility;
  }
  if (body.tags !== undefined) {
    if (body.tags !== null && (!Array.isArray(body.tags) || body.tags.length > 50
      || body.tags.some(tag => typeof tag !== 'string' || tag.length > 100))) invalid('Enter valid tags.');
    payload.tags = body.tags?.map(tag => tag.trim()).filter(Boolean) ?? null;
  }
  // Derive an omitted new value, never replace explicit null/zero or PATCH omission.
  if (create && payload.structure?.length) {
    const totals = summarizeStructure(payload.structure);
    if (!Object.hasOwn(payload, 'planned_duration_min') && totals.durationMin > 0) payload.planned_duration_min = totals.durationMin;
    if (!Object.hasOwn(payload, 'planned_distance_km') && totals.distanceKm > 0) payload.planned_distance_km = totals.distanceKm;
    if (!Object.hasOwn(payload, 'planned_tss')) payload.planned_tss = estimateTss(payload.structure, payload.planned_duration_min);
    const derivedValidation = validateWorkoutFields(payload);
    if (derivedValidation) invalid(derivedValidation);
  }
  return payload;
}
