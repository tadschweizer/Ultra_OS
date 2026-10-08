# P0-014 — Saved workout-match correction

Date: 2026-10-07. Base: remote main `a9d83c2` (merged PR #129).
Branch: `feature/p0-workout-match-correction`.
Review: [draft PR #130](https://github.com/tadschweizer/Ultra_OS/pull/130), implementation `efed738`.

This batch implements and locally verifies match correction. P0-014 stays open
until release and controlled real-athlete/physical-phone acceptance. No production
write, deployment, service configuration change or paid resource was performed.

## Delivered behavior

- An athlete can confirm the suggested imported activity, choose a different
  session within seven days of the plan, reject a suggestion, unlink a confirmed
  activity, or explicitly restore automatic matching. An already linked activity
  outside that interval remains inspectable and can be unlinked.
- Confirmation saves the imported duration/distance and reserves the activity
  for one workout on that athlete's calendar. Replacing the match releases the
  previous activity. Zero stays zero; unavailable values stay unknown.
- Rejection/unlinking clears imported actuals, leaves the plan intact and disables
  automatic matching for that workout. Refresh and subsequent imports cannot
  restore the rejected match. Athlete notes/RPE and coach feedback are retained.
- A manually logged completion can be explicitly linked when its import arrives.
  Editing manual actuals, skipping or undoing completion releases a confirmed
  link and keeps automatic matching off. Automatic merging of separate manual
  and imported records is not claimed.
- Identical match retries return the saved decision without rewriting its actuals.
  Stale changes fail with a review instruction. The signed athlete session supplies
  ownership; coaches and unrelated accounts cannot decide another athlete's match.
  The RPC is service-role-only, SECURITY INVOKER, with a fixed empty search path.
- Confirmed workouts render on the imported activity's local date. A plan outside
  the visible range is loaded when its linked activity is in range. Link lookups
  use batches of 100 instead of truncating all historical links. Deleted provider
  activities retain saved actuals and expose an unavailable-link state.
- Match controls retain a failed selection, prevent repeat submission while
  saving, preserve calendar context and reflect refreshed actuals after restoring
  suggestions. Coaches can inspect suggestions without athlete-only controls.

## Verification

- Node.js **22.23.3** full regression: **403/403 passed**.
- Full desktop/390 px Chromium critical suite: **103 passed, 3 intentional skips**.
- Expanded daily-loop browser suite: **24/24 passed**. Covers failure/retry,
  lost-response retry, replacement, rejection/reload, unlink/reload, explicit
  automatic restore, coach controls and existing workout/message/Today journeys.
- Node 22 production build: passed. `git diff --check`: passed.
- Nine new regression tests include seven isolated PGlite/PostgreSQL groups, actual
  signed-session application handlers and real SQL execution through a test
  PostgREST-shaped adapter. Checks cover persistence, replay, ownership, revocation,
  raw-field bypasses, stale conflicts, duplicate links, missing/deleted activities,
  cross-range loading, 105 historical links, RPC client denial and transactional
  refusal of duplicate legacy links. This is not a hosted Supabase/PostgREST or
  multi-connection concurrency test. The existing local Docker stack was stopped.
- Workout-detail axe checks pass WCAG 2 A/AA rules with contrast excluded. Desktop
  and 390 px screenshots are under `output/p0-workout-match-*.png`.

Run these from `webapp/` with Node.js 22:

```powershell
npm run test:auth:full
npm run test:e2e:critical
npm run build
```

The added tests are included in the existing Auth Smoke workflow's full regression
and critical-browser commands. Local logs are in `output/p0-workout-match-*.log`.

## Read-only production findings and release order

October 7 checks confirmed:

- PR #129 merged; GitHub Auth Smoke and Vercel checks passed.
- `mythreshold.co` resolves to READY production deployment
  `dpl_7j7ZMFL2Gcz6cNK1RFyRkFRYqDML` on `a9d83c2`, with both public domains attached.
- Production has `planned_workouts` and `strava_activities`. It lacks this batch's
  `activity_match_mode` column/RPC and still lacks `coach_messages`.
- Existing confirmed links: **0**. Duplicate activity-link groups: **0**.
  Recheck immediately before any authorized release; these counts can change.

Before deploying this batch, apply only the explicitly approved source
`webapp/supabase/migrations/20261007162647_workout_match_decisions.sql`. The migration
must precede application deployment because the workout query selects the new
column. Do not use a broad database push to repair historical migration drift.
`webapp/scripts/workout-match-schema-preflight.sql` provides read-only before/after
checks. Duplicate legacy links must stop the release for review; the migration
never chooses a record to delete or rewrite.

Remaining gates: explicitly authorized production migration/release, hosted
Supabase/PostgREST and independent-connection acceptance, a normal real-athlete
import/correction journey, physical-phone timing, and broader reconciliation/report
boundary acceptance. Existing coach-message/shared-document schema repair is a
separate release gate. Notification preferences/delivery lifecycle, durable inbox
drafts and all-history unread aggregation remain the next P0-015 implementation
batch. No parent acceptance checkbox is advanced.
