export const CHECK_IN_TYPE = 'Workout Check-in';
export const CHECK_IN_SCORE_FIELDS = ['legs_feel', 'energy_feel', 'perceived_effort'];

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isScore(value) {
  const number = Number(value);
  return value !== '' && value !== null && value !== undefined && Number.isInteger(number) && number >= 1 && number <= 10;
}

/**
 * Validate the 1-10 check-in scores. Scores that are present must be integers
 * from 1 to 10. With `requireAll`, legs, energy, and RPE must all be present
 * (the fast-path check-in the coach triage and correlations rely on).
 */
export function validateCheckInScores(payload = {}, { requireAll = false } = {}) {
  for (const key of CHECK_IN_SCORE_FIELDS) {
    const value = payload?.[key];
    const missing = value === '' || value === null || value === undefined;
    if (missing) {
      if (requireAll) return { ok: false, field: key };
      continue;
    }
    if (!isScore(value)) return { ok: false, field: key };
  }
  return { ok: true };
}

export function hasCheckedInOn(lastCheckInDate, today) {
  return Boolean(lastCheckInDate) && String(lastCheckInDate).slice(0, 10) === today;
}

/** A fast-path check-in carries all three scores; lightweight session logs do not. */
export function isFastCheckIn(row) {
  if (row?.intervention_type && row.intervention_type !== CHECK_IN_TYPE) return false;
  return validateCheckInScores(row?.protocol_payload || {}, { requireAll: true }).ok;
}

/**
 * Readiness on the same 0-100 scale coach triage uses (red < 45, yellow < 70).
 * Legs and energy count as-is; effort is inverted so a harder day lowers readiness.
 */
export function checkInReadinessScore(payload = {}) {
  if (!validateCheckInScores(payload, { requireAll: true }).ok) return null;
  const legs = Number(payload.legs_feel);
  const energy = Number(payload.energy_feel);
  const effort = Number(payload.perceived_effort);
  return Math.round(((legs + energy + (11 - effort)) / 3) * 10);
}

/** Newest fast check-in from rows in any order; null when there is none. */
export function latestFastCheckIn(rows = []) {
  return rows
    .filter(isFastCheckIn)
    .sort((a, b) => String(b.inserted_at || b.date || '').localeCompare(String(a.inserted_at || a.date || '')))[0] || null;
}
