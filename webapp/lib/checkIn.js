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
