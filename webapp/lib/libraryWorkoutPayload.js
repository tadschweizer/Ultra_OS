// Complete shared prescription; production deployment requires the additive
// workout_library_plan_metadata migration first.
export function libraryWorkoutPayload(form) {
  const numberOrNull = (value) => value == null || value === '' ? null : Number(value);
  const payload = {
    name: form.title,
    sport: form.sport,
    description: form.description,
    structure: form.structure,
    planned_duration_min: numberOrNull(form.planned_duration_min),
    planned_distance_km: numberOrNull(form.planned_distance_km),
    planned_distance_unit: form.planned_distance_unit || 'mi',
    objective: form.objective ?? null,
    coach_instructions: form.coach_instructions ?? null,
    planned_if: numberOrNull(form.planned_if),
    planned_tss: numberOrNull(form.planned_tss),
    target_metric: form.target_metric || 'duration',
    visibility: form.visibility || 'athlete_visible',
  };
  return payload;
}
