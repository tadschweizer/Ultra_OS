// PATCH only intentionally edited fields. Keep exact canonical distance,
// nullable metadata, tags and opaque step attributes from the saved template.
export function libraryCanonicalDistance(value, unit) {
  return value == null || value === '' ? null : Number(value) * (unit === 'km' ? 1 : 1.609344);
}
export function libraryDisplayDistance(km, unit) {
  return km == null || km === '' ? '' : String(Number(km) / (unit === 'km' ? 1 : 1.609344));
}
export function libraryEditPayload(form, dirty) {
  const payload = { id: form.id };
  const numeric = new Set(['planned_duration_min', 'planned_if', 'planned_tss']);
  const text = new Set(['description', 'objective', 'coach_instructions']);
  for (const field of ['title','sport','description','objective','coach_instructions',
    'planned_duration_min','planned_if','planned_tss','planned_distance_unit','target_metric','visibility','structure','tags']) {
    if (!dirty.has(field)) continue;
    let value = form[field];
    if (numeric.has(field)) value = value == null || value === '' ? null : Number(value);
    if (text.has(field) && value === '') value = null;
    payload[field === 'title' ? 'name' : field] = value;
  }
  if (dirty.has('planned_distance')) payload.planned_distance_km = libraryCanonicalDistance(form.planned_distance, form.planned_distance_unit);
  return payload;
}
