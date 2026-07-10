# Plan 04 — Planned-vs-completed reconciliation views

**Priority: 4 of 10. This is a ❌ row in the TrainingPeaks parity matrix (README-PLATFORM.md), and the matrix is your declared release gate: "any ❌ is prioritized before advanced differentiation work."**

> **Status: IMPLEMENTED in this PR.** `summarizeReconciliationWindow` added to `lib/workoutCompliance.js` (composed from the existing matcher/decorator, +4 tests incl. the evening-timezone case); new `components/WeeklyReconciliation.js` renders the current week on `/calendar`; the coach athlete-detail API now returns 28 days of planned workouts + activities and the coach page shows the rollup. Persistence uses the pre-existing `PATCH /api/planned-workouts` (athlete completion fields) — no auto-write of matches from the read path, by design.

## Goal

Athletes and coaches need a daily/weekly view answering "what was planned vs what actually happened." The building blocks already exist: `planned_workouts` has completion columns (`status`, `completed_activity_id`, `completed_duration_min`, `completed_distance_km`), and `webapp/lib/workoutCompliance.js` already exports `matchActivitiesToWorkouts`, `decorateWorkoutsWithCompliance`, `compliancePct`, `complianceStatus`, and `summarizeWeek`. What's missing is (a) a reconciliation summary surface for the athlete week, (b) the same rollup on the coach's athlete detail page, and (c) persisting a match once it's made so it isn't recomputed differently later.

## Files to touch (exact)

1. `webapp/components/TrainingCalendar.js` — read first (1,475 lines); it likely already decorates workouts with compliance. Add/extend a week-summary strip.
2. `webapp/components/WeeklyReconciliation.js` (new) — presentational component: per-day rows, planned vs completed, status chips.
3. `webapp/pages/calendar.js` — mount the weekly reconciliation summary above/beside the calendar.
4. `webapp/pages/coach/athletes/[athleteId].js` — add a "Plan compliance (last 7 / 28 days)" section using the same component.
5. `webapp/pages/api/planned-workouts.js` — add a `PATCH` (or extend existing update path — read the file first; it already has athlete-editable completion fields listed at top) to persist `completed_activity_id`, `completed_duration_min`, `completed_distance_km`, `status`.
6. `webapp/pages/api/coach/athlete-detail.js` — include planned workouts + matched activities for the compliance window in its response if not already present.
7. `webapp/tests/workout-compliance.test.mjs` — extend with tests for the new aggregation helper.
8. `webapp/lib/workoutCompliance.js` — add one function `summarizeReconciliationWindow(workouts, activities, { start, end })` returning `{ plannedCount, completedCount, skippedCount, unplannedActivities, avgCompliancePct, days: [{ date, planned: [...], matched: [...], status }] }`.

## Steps in order

1. Read `TrainingCalendar.js` and `pages/calendar.js` end to end. Note how activities are fetched (`/api/activities`) and how `decorateWorkoutsWithCompliance` is already used. Reuse those exact data sources — do not add new fetches if the page already has both datasets.
2. Implement `summarizeReconciliationWindow` in `lib/workoutCompliance.js` as a pure function composed from the existing helpers. Unplanned activities = activities in the window that `matchActivitiesToWorkouts` did not pair with any planned workout.
3. Write tests for it in `tests/workout-compliance.test.mjs` (pure function — test: empty inputs; a planned workout with a matching activity same day/sport; a skipped past workout; an unplanned activity; a rest day). Run `node --test tests/workout-compliance.test.mjs`.
4. Build `WeeklyReconciliation.js`: takes the summary object, renders one row per day (planned title + planned duration/distance vs completed values, compliance % chip using `complianceStatus` colors), plus a header line: "5 of 6 planned sessions completed · 92% avg compliance · 1 unplanned activity". Match the existing Tailwind style used in `TrainingCalendar.js` (same card/border/token classes).
5. Mount it on `pages/calendar.js` for the currently viewed week.
6. Add the coach view: in `pages/api/coach/athlete-detail.js`, verify the coach-athlete relationship check already present, then include the athlete's planned workouts and synced activities for the last 28 days in the payload; render `WeeklyReconciliation` (or a 4-week rollup table of `summarizeWeek` outputs) in `pages/coach/athletes/[athleteId].js`.
7. Persistence: when the athlete confirms a match (or the auto-match is unambiguous), `PATCH /api/planned-workouts` with `status: 'completed'`, `completed_activity_id`, and completed metrics. Read the file's existing athlete-permission list (`ATHLETE_EDITABLE_FIELDS` or similar near the top) and route the update through the same validation.
8. Run the full check: `npm run test:auth:full && node --test tests/workout-compliance.test.mjs` and `npm run build` in `webapp/`.

## Edge cases a weaker model would miss

- **Timezones**: `workout_date` is a `date` (no time). Match activities by the athlete's local calendar day using `toDateKey` from `workoutCompliance.js` — never `new Date(activity.start_date).toISOString().slice(0,10)`, which shifts days for evening workouts west of UTC.
- Two planned workouts on the same day (`order_index`): match the activity to the workout with the same sport first, then closest planned duration — `matchActivitiesToWorkouts` already encodes a strategy; extend it rather than writing a second matcher that disagrees.
- Sport mapping: Strava `sport_type` values (`Run`, `TrailRun`, `Ride`, `VirtualRide`...) vs `WORKOUT_SPORTS` ids (`run`, `bike`...). Check for an existing mapping in `workoutCompliance.js` or `activityInsights.js` and reuse it.
- A planned workout in the future must show as "upcoming", not "skipped" — `complianceStatus` already takes `{ today }`; pass a stable date and use the same logic server/client to avoid hydration mismatch (compute status client-side only, or pass `today` down as a prop from a single `new Date()` call).
- Coach view must go through the relationship check — never fetch `/api/planned-workouts?athlete_id=X` from the coach page unless that route verifies the coach relationship (it does, ~lines 50–65; confirm).
- Manual completions with no linked activity (`completed_activity_id` null but `completed_duration_min` set) count as completed.
- Don't double-count: an activity already persisted as `completed_activity_id` on one workout must be excluded from matching against other workouts.

## Acceptance criteria

1. `node --test tests/workout-compliance.test.mjs` passes with the new cases.
2. Athlete calendar week shows a reconciliation strip: every planned workout displays planned vs completed values and a status chip; an activity with no plan shows under "unplanned".
3. Marking a workout complete persists: reload the page and the match survives (row in `planned_workouts` has `status='completed'` and `completed_activity_id` set).
4. Coach athlete-detail page shows the last-28-day compliance rollup for a roster athlete, and returns 403/404 for a non-roster athlete id.
5. An evening run (8pm local) logged to Strava matches the plan for that same local date.
6. `npm run build` succeeds.
7. Update `README-PLATFORM.md` parity matrix: "Planned vs completed reconciliation" ❌ → ✅ (or 🟡 with a note if coach export is deferred).

## Out of scope

- Adherence CSV exports (part of the "Compliance and adherence rollups" 🟡 row — do after this lands).
- COROS/Garmin workout push reconciliation (`export_status`, `sync_provider` columns) — display only what's synced.
