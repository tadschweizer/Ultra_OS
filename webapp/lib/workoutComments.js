// Domain rules for session discussions.
//
// A comment hangs off exactly one subject — a planned workout or an imported
// activity. Keeping that rule, body validation, and author naming here means
// the API route stays a thin transport layer and each rule is testable on its
// own.

export const MAX_COMMENT_LENGTH = 4000;

/**
 * Normalizes the subject of a thread from a query string or JSON body.
 *
 * Accepts `workout_id` (or its `planned_workout_id` alias) and `activity_id`.
 * Exactly one must be present: naming both is ambiguous about which thread the
 * caller means, and the database rejects it anyway.
 *
 * @param {Record<string, unknown>} source req.query or req.body
 * @returns {{ workoutId: string|null, activityId: string|null, error: string|null }}
 */
export function parseSubject(source = {}) {
  const rawWorkout = source.workout_id ?? source.planned_workout_id ?? null;
  const rawActivity = source.activity_id ?? null;

  const workoutId = typeof rawWorkout === 'string' && rawWorkout.trim() ? rawWorkout.trim() : null;
  const activityId = typeof rawActivity === 'string' && rawActivity.trim() ? rawActivity.trim() : null;

  if (workoutId && activityId) {
    return { workoutId: null, activityId: null, error: 'Provide either workout_id or activity_id, not both.' };
  }
  if (!workoutId && !activityId) {
    return { workoutId: null, activityId: null, error: 'workout_id or activity_id is required.' };
  }
  return { workoutId, activityId, error: null };
}

/**
 * Validates and trims a comment body.
 *
 * @param {unknown} raw
 * @returns {{ body: string|null, error: string|null }}
 */
export function validateCommentBody(raw) {
  const body = typeof raw === 'string' ? raw.trim() : '';
  if (!body) return { body: null, error: 'Comment body is required.' };
  if (body.length > MAX_COMMENT_LENGTH) {
    return { body: null, error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.` };
  }
  return { body, error: null };
}

/**
 * Attaches a display name to each comment so a thread reads like a
 * conversation between people rather than between two roles.
 *
 * Rows written before author_athlete_id existed fall back to the coach profile
 * name, then to the bare role, so an old thread still renders.
 *
 * @param {Array<object>} comments
 * @param {{ athleteNames: Map<string,string>, coachNames: Map<string,string> }} names
 */
export function attachAuthorNames(comments, { athleteNames = new Map(), coachNames = new Map() } = {}) {
  return comments.map((comment) => {
    const authored = comment.author_athlete_id ? athleteNames.get(comment.author_athlete_id) : null;
    const fallback = comment.sender_role === 'coach' ? coachNames.get(comment.coach_id) : null;
    return {
      ...comment,
      author_name: authored || fallback || (comment.sender_role === 'coach' ? 'Coach' : 'Athlete'),
    };
  });
}

/** The distinct non-null ids under `key` across the given rows. */
export function collectIds(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))];
}
