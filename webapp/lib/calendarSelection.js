// Selection replaces the current calendar URL rather than adding a history
// entry per modal click. Keep role/athlete/filter context and consume log links.
export function calendarSelectionUrl(pathname, query = {}, { workout = null, activity = null } = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (['workout', 'activity', 'log'].includes(key) || value == null) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
  }
  if (workout != null) params.set('workout', String(workout));
  else if (activity != null) params.set('activity', String(activity));
  return `${pathname || '/calendar'}${params.size ? `?${params}` : ''}`;
}
