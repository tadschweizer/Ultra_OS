// Production's current library schema accepts the common fields only. The
// isolated demo adapter can also preserve the full prescription and visibility.
export function libraryWorkoutPayload(form, { preservePlanMetadata = false } = {}) {
  const numberOrNull = (value) => value == null || value === '' ? null : Number(value);
  const payload = {
    name: form.title,
    sport: form.sport,
    description: form.description,
    structure: form.structure,
    planned_duration_min: numberOrNull(form.planned_duration_min),
    planned_distance_km: numberOrNull(form.planned_distance_km),
    planned_distance_unit: form.planned_distance_unit || 'mi',
  };
  if (preservePlanMetadata) Object.assign(payload, {
    objective: form.objective ?? '',
    coach_instructions: form.coach_instructions ?? '',
    planned_if: numberOrNull(form.planned_if),
    planned_tss: numberOrNull(form.planned_tss),
    target_metric: form.target_metric || 'duration',
    visibility: form.visibility || 'athlete_visible',
  });
  return payload;
}
