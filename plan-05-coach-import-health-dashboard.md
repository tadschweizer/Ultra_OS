# Plan 05 — Coach dashboard: multi-athlete import health cards

**Priority: 5 of 10. Second ❌ row in the TrainingPeaks parity matrix ("Multi-athlete import health"), and a stated 2026-04-30 architectural decision: migration transparency before broad athlete onboarding.**

## Goal

Coaches migrating a roster from TrainingPeaks need one place showing, per athlete: import status, how many items transferred, and how many need manual mapping. The data already exists in `public.trainingpeaks_import_jobs` (`athlete_id`, `coach_id`, `status`, `transferred_count`, `needs_manual_mapping_count`, `error_message`, `metadata`, timestamps) with an index on `(athlete_id, created_at DESC)`. Nothing surfaces it to coaches today.

## Files to touch (exact)

1. `webapp/pages/api/coach/dashboard.js` — extend the response with `importHealth` per roster athlete
2. `webapp/pages/coach-command-center.js` — render an "Import health" card/section
3. `webapp/pages/coach/athletes/[athleteId].js` — per-athlete import detail block (status history, error message, needs-mapping count with link to the athlete's migration completeness screen)
4. `webapp/pages/connections.js` — read-only reference: this is where the athlete-side import flow and migration completeness UI live; link to it correctly
5. `webapp/tests/coach-import-health.test.mjs` (new) — pure-function tests for the rollup

## Steps in order

1. Read `pages/api/coach/dashboard.js` fully. It already: resolves the coach profile (`ensureCoachProfile`), loads active `coach_athlete_relationships`, and batch-queries per-athlete data with `.in('athlete_id', athleteIds)`. Follow the same pattern.
2. Add a query: latest import job per roster athlete. Fetch `trainingpeaks_import_jobs` with `.in('athlete_id', athleteIds).order('created_at', { ascending: false })`, then reduce in JS to the newest job per athlete (Supabase JS can't do `DISTINCT ON`). Put the reducer in a small pure module `webapp/lib/importHealth.js`:
   ```js
   export function latestJobPerAthlete(jobs = []) { ... }
   export function summarizeImportHealth(jobsByAthlete) {
     // returns { migrated, inProgress, needsMapping, failed, notStarted, totalNeedsMappingItems }
   }
   ```
   Status buckets: `completed` with `needs_manual_mapping_count === 0` → migrated; `completed` with count > 0 → needsMapping; `queued`/`running` → inProgress; `failed`/`error` → failed (grep the codebase and `connections.js` for the actual status strings written when jobs are created — do not guess; if no writer exists yet, treat the CHECK-less `status` text column's default `'queued'` plus `completed`/`failed` as the set and note it in the code).
3. Include in the dashboard response: per-athlete `{ importStatus, transferredCount, needsManualMappingCount, lastImportAt, errorMessage }` and the aggregate summary.
4. UI on `coach-command-center.js`: a summary card row ("Roster import health: 4 migrated · 2 need mapping · 1 failed") plus a per-athlete list showing name, status pill, transferred/needs-mapping counts, and "last import 3d ago". Athletes with NO job ever: show "Not started" — this is the common case and must not render as an error. Follow the existing card styling on that page.
5. Per-athlete block on `coach/athletes/[athleteId].js`: latest job detail plus `error_message` when failed. Data comes through `pages/api/coach/athlete-detail.js` — add the query there with the same relationship check the route already does.
6. Tests: `latestJobPerAthlete` (multiple jobs per athlete picks newest; empty list), `summarizeImportHealth` (each bucket; athletes with no jobs counted as notStarted). Run `node --test tests/coach-import-health.test.mjs`.

## Edge cases a weaker model would miss

- **Most athletes will have zero import jobs.** The summary must treat missing rows as "not started", not crash on `undefined` or show 0% scary red.
- Multiple jobs per athlete (re-imports): always the LATEST job by `created_at`; a newer successful job supersedes an old failure.
- `status` is free text with no CHECK constraint — normalize case (`.toLowerCase()`) and route unknown statuses to an "unknown" bucket rather than throwing.
- The coach must only ever see jobs for athletes in their ACTIVE roster — filter by the relationship list already loaded, and never query jobs by `coach_id` alone (jobs can have `coach_id` null when athlete self-imported; those still belong on the dashboard if the athlete is on the roster).
- `metadata` is untrusted jsonb — don't render raw keys into the UI; only render known fields.
- Empty roster: section renders a friendly empty state, and the API must not call `.in('athlete_id', [])` (Supabase returns an error or everything depending on version — guard with `if (athleteIds.length)` like the existing code at line ~72 does).

## Acceptance criteria

1. `node --test tests/coach-import-health.test.mjs` passes.
2. Coach with a roster sees the import health card; each athlete shows one of: Not started / In progress / Needs mapping (with item count) / Migrated / Failed (with error message on the detail page).
3. Seeding a `trainingpeaks_import_jobs` row in Supabase for a roster athlete (e.g. `status='completed', transferred_count=120, needs_manual_mapping_count=7`) makes the dashboard show "Needs mapping · 7 items" for that athlete without code changes.
4. A coach cannot see import jobs of a non-roster athlete (verify via `athlete-detail` endpoint with a foreign athlete id → 403/404).
5. `npm run build` succeeds; `npm run test:auth:full` still passes.
6. Update `README-PLATFORM.md` parity matrix: "Multi-athlete import health" ❌ → ✅.

## Out of scope

- Building/fixing the import pipeline itself (job creation stays as-is).
- Outbound notifications about mapping gaps — that's plan-09.
