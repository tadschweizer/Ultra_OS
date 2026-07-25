// Display helpers for imported activity stats.

const KM_PER_MILE = 1.60934;

// Sports read as speed; everything else reads as pace. A cyclist thinks in mph,
// a runner in min/mi, and showing the wrong one makes a session hard to judge.
export const SPEED_SPORTS = new Set(['ride', 'bike', 'cycling', 'ebike', 'handcycle', 'velomobile']);

export function isSpeedSport(sport) {
  return SPEED_SPORTS.has(String(sport || '').toLowerCase());
}

function toPositiveNumbers(distanceKm, durationMin) {
  const km = Number(distanceKm);
  const min = Number(durationMin);
  if (!Number.isFinite(km) || !Number.isFinite(min) || km <= 0 || min <= 0) return null;
  return { km, min };
}

/**
 * Pace as min/mi or min/km, e.g. "8:16 /mi".
 *
 * @param {number|null} distanceKm canonical distance in kilometres
 * @param {number|null} durationMin moving time in minutes
 * @param {'mi'|'km'} unit the athlete's distance preference
 * @returns {string|null} null when either input is missing or non-positive
 */
export function formatPace(distanceKm, durationMin, unit = 'mi') {
  const values = toPositiveNumbers(distanceKm, durationMin);
  if (!values) return null;

  const perUnit = values.min / (unit === 'km' ? values.km : values.km / KM_PER_MILE);
  if (!Number.isFinite(perUnit) || perUnit <= 0) return null;

  const minutes = Math.floor(perUnit);
  const seconds = Math.round((perUnit - minutes) * 60);
  // 7:60 is not a pace — carry the rounded second into the minute.
  const [mm, ss] = seconds === 60 ? [minutes + 1, 0] : [minutes, seconds];
  return `${mm}:${String(ss).padStart(2, '0')} /${unit === 'km' ? 'km' : 'mi'}`;
}

/**
 * Speed as mph or km/h, e.g. "17.4 mph".
 *
 * @param {number|null} distanceKm canonical distance in kilometres
 * @param {number|null} durationMin moving time in minutes
 * @param {'mi'|'km'} unit the athlete's distance preference
 * @returns {string|null} null when either input is missing or non-positive
 */
export function formatSpeed(distanceKm, durationMin, unit = 'mi') {
  const values = toPositiveNumbers(distanceKm, durationMin);
  if (!values) return null;

  const distance = unit === 'km' ? values.km : values.km / KM_PER_MILE;
  const value = distance / (values.min / 60);
  if (!Number.isFinite(value)) return null;
  return `${Math.round(value * 10) / 10} ${unit === 'km' ? 'km/h' : 'mph'}`;
}

/** Whichever of pace or speed suits the sport. */
export function formatTempo(sport, distanceKm, durationMin, unit = 'mi') {
  return isSpeedSport(sport)
    ? formatSpeed(distanceKm, durationMin, unit)
    : formatPace(distanceKm, durationMin, unit);
}
