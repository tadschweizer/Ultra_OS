# Threshold isolated verification — October 10, 2026

**Outcome: both candidate gaps reproduced on fresh online main.** Copy-week retry/field preservation **FAIL**; recovery-load provenance and manual-completion inclusion **FAIL**. Linked coach access control and matched plan/activity nonduplication **PASS**. These are current-main source/runtime fixture findings, not observations from production accounts or a deployed database.

Main: `fa8ebe2b377784007b4a40b4e982f92a11224075` (fresh fetch, refreshed again before reporting). PR134: `6f1d3f4f3633095a0aac9e83600b77b3ce2bb596`, draft/open/unmerged when inspected. Exact source hashes, Git blob IDs and collection timestamp are in [manifest.json](manifest.json). Runtime: Windows PowerShell, Node `v24.14.0`, process timezone explicitly `UTC`; fixture clock `2026-10-10T12:00:00Z`. No Next application build or browser acceptance is claimed.

## Isolation and evidence

Separate checkout: `C:\Users\BAS\Documents\Codex\2026-10-09\task-4\source`. Its tracked and untracked status is clean. Canonical desktop and active demo checkouts were not accessed. No app files changed, dependencies installed, commits, pushes, PRs, deployment, migrations, production database/user actions, real providers, secrets, mail or billing were performed.

Read `AGENTS.md`, `PRODUCT_EXECUTION_ROADMAP.md`, `COACH_TEST_PLAN.md`, package scripts and relevant existing tests. The manual plan requires accounts and provider-backed pages; this bounded task uses synthetic fixtures instead. The roadmap remains unchanged because the delegated scope explicitly authorizes a report/harness, not app changes. Current milestone remains M0; no parent acceptance is marked complete.

The harness imports the actual unmodified `createPlannedWorkoutsHandler`, `/api/me` handler, calendar transport, role/relationship helpers, validation, compliance, TRIMP and EWMA code. Node module hooks replace only session/cookie, Supabase client, provider-sync and unrelated entitlement service boundaries. The fixture implements PostgREST projections/filters/inserts, source-declared defaults, PK collision and nonnull activity-link collision behavior. All unexpected HTTP calls throw. The lost-response case substitutes a local fetch that executes the real handler, then throws **after the insert**. No network can reach a real service through that test.

**Limits:** this is an in-memory fixture store, not PostgreSQL or hosted Supabase. Defaults/index/policy conclusions are backed by read-only source inspection; deployed schema drift, triggers added outside the repository, RLS execution, real signed sessions and real browser rendering are not verified. User-visible strings are traced to JSX bindings and executed API output, not screenshot-tested. Confidence is high for the executed handler/domain behavior and current source contracts; no claim is made that a live account was observed to exhibit it.

Deliverables:

- [gap-reproduction.test.mjs](gap-reproduction.test.mjs): eight tests, including eleven `/api/me` fixture cases.
- [fixture-store.mjs](fixture-store.mjs), [isolation-loader.mjs](isolation-loader.mjs): local store and boundary isolation.
- [results.json](results.json): exact outputs, copied row/raw insert, counts, fields, metrics and query provenance.
- [test-output.txt](test-output.txt): **8 passed, 0 failed**. Passing assertions establish the defects; they do not mean product acceptance passed.
- [existing-tests-output.txt](existing-tests-output.txt): **38 passed, 0 failed** across source compliance, training-calculation and daily-loop tests.
- [source-evidence.txt](source-evidence.txt): numbered source excerpts and all relevant migration references; SQL was only read.
- [pr134-source-evidence.txt](pr134-source-evidence.txt), [pr134-metadata.json](pr134-metadata.json): read-only comparison and GitHub metadata.
- [reproduce.ps1](reproduce.ps1): repeatable local execution.

## Acquisition and reproduction commands

Executed inside this task workspace:

```powershell
git clone --no-checkout --filter=blob:none https://github.com/tadschweizer/Ultra_OS.git source
# Complete the checkout after the restricted shell could not fetch missing blobs:
git -C source -c remote.origin.promisor=false fetch --no-filter origin main refs/pull/134/head:refs/remotes/origin/pr134
git -C source checkout --detach origin/main
# Final refresh, which advanced the inspected PR134 head but left main unchanged:
git -C source fetch origin main refs/pull/134/head:refs/remotes/origin/pr134
git -C source rev-parse HEAD origin/main origin/pr134

$env:TZ = 'UTC'
node --import ./isolation-loader.mjs --test gap-reproduction.test.mjs
Push-Location source/webapp
node --import ../../isolation-loader.mjs --test tests/workout-compliance.test.mjs tests/training-calculations.test.mjs tests/daily-loop.test.mjs
Pop-Location
node collect-source-evidence.mjs
```

Or rerun `./reproduce.ps1` with the existing checkout. It performs local tests and evidence collection only. Git fetches needed reviewed network access; they succeeded. Early setup failures (loader not preloaded, a path error, host timezone, and a private-create fixture retaining a library ID) were corrected in the harness. An attempted optional `workout-match.test.mjs` run stopped at missing `@electric-sql/pglite` before executing that test; it was not part of the successful 38-test run. No dependencies were installed or SQL run to work around that. Repository files were left unchanged.

## Candidate 1: copy week

**FAIL — repeat/lost-response retries duplicate the destination workouts.**

Minimal request: coach with a source workout on October 5 and an active relationship sends:

```json
{
  "action": "copy_week",
  "athlete_id": "11111111-1111-4111-8111-111111111111",
  "from_week_start": "2026-10-05",
  "to_week_start": "2026-10-12"
}
```

Expected reliability contract: retrying the same operation after an uncertain response returns its original destination records without an additional set. Observed: first POST `200`, second identical POST `200`, **two destination records with different UUIDs** from one source record. A valid identical `client_request_id` on both requests also produces two records. With the actual `calendarMutation` helper, the first insert commits locally but the response is dropped; the UI-facing result is `{ok:false,error:"Connection lost. Your changes are still here. Check your connection and retry."}`. Retrying succeeds and yields two destination records. Exact records and raw insert keys are preserved in `results.json`.

Trace:

- `webapp/components/TrainingCalendar.js:1669`: pending-request map suppresses only identical requests while pending; its `finally` removes the entry on both success and failure.
- `TrainingCalendar.js:1698`: copy sends action/athlete/source/destination only, with no stable operation key.
- `webapp/lib/calendarMutation.js:2`: transport failure explicitly invites retry.
- `webapp/pages/api/planned-workouts.js:313`: copy branch reads source then bulk inserts new rows; it returns before the single-workout retry handling at lines 426–438.
- `planned-workouts.js:298`: validates a supplied retry key, but the copy branch never consumes it.
- `20260611120000_add_training_calendar.sql:87`: athlete/date is a nonunique index. Generated UUID PKs do not conflict. `20261007162647_workout_match_decisions.sql:10` uniquely constrains nonnull completed activity links, which clones clear. No copy-operation guard, destination uniqueness or relevant insert trigger was found in the repository schema sources.

**PASS control:** without an active relationship, the same coach request returns `403` and makes zero fixture inserts. This authorization guard does not prevent retry duplication by an authorized coach.

**FAIL — full prescription is not preserved.** The fixture is a plausible trail-climb session with uphill objective, separate pole/descent instructions, distance target and IF, plus structured step notes. Its first clone is:

| Field/group | Source → observed clone | Verdict |
| --- | --- | --- |
| `sport`, `title`, `description` | Values preserved | PASS |
| `structure`, including nested step notes | Entire JSON preserved | PASS |
| `planned_duration_min`, `planned_distance_km`, `planned_distance_unit`, `planned_tss` | 60, 8, km, 65 preserved | PASS |
| `order_index`, `library_workout_id` | 2 and library reference preserved | PASS |
| `workout_date` | October 5 → October 12 | PASS |
| `athlete_id`, `coach_id` | Target athlete and acting linked coach assigned | PASS for this scenario |
| `objective` | Uphill objective → null | FAIL |
| `coach_instructions` | Separate pole/descent instructions → null | FAIL |
| `target_metric` | distance → duration default | FAIL |
| `planned_if` | 0.75 → null | FAIL |
| `visibility` | coach_private → athlete_visible default | FAIL |
| `status`, completion/link/RPE/comment/feedback | Completed source → planned; actuals and feedback cleared | Appropriate planning-copy behavior |
| `export_status`, `sync_provider` | exported/provider → not_exported/null | Appropriate fresh-copy reset, not a proven prescription-loss defect |
| IDs/timestamps | Fresh defaults | Appropriate fresh-copy behavior |

The raw real-handler insert omits all five suspected prescription/visibility fields. Fixture output applies their defaults from `20260617120000_trainingpeaks_parity_foundation.sql:4`. This is field loss, not loss of the preserved description or step-level notes. The detail panel renders objective/instructions/target/IF from these separate fields at `TrainingCalendar.js:828`; copied workouts therefore lose that displayed prescription context. If objective, description and instructions are all absent, the enclosing panel also hides the target line.

**Private semantics checked, not assumed:** the editor explicitly offers “Coach private draft” (`TrainingCalendar.js:474–482`). A real coach POST accepts that value. A subsequent real athlete GET returns the private row and its separate coach instructions **before any copy occurs**. GET after copying returns both the original `coach_private` row and its default-visible clone. `planned-workouts.js:215–293` performs ownership/relationship checks but no visibility filter; the calendar renders the returned workout list without a private-workout filter. The source's athlete-read policy also permits all own-calendar rows (`20260611120000_add_training_calendar.sql:109`). Thus copying loses the visibility marker, but this must **not** be presented as the first moment private information becomes accessible: main already violates the UI's private-draft contract in this handler path. Calendar notes have a separate visibility contract; their private option does not establish workout privacy.

Impact: a coach can unknowingly schedule duplicated sessions after a lost response, and the athlete's copied workout can retain broad duration/structure while losing separate instructions and target context. Private-draft handling is an adjacent verified source gap that merits separate review before demonstrating draft/publish behavior to a coach.

Smallest fix recommendations, not implemented:

1. Add stable copy-operation retry identity with atomic replay/conflict handling across the bulk copy; send that identity from the UI and preserve it through uncertain responses. Do not make athlete/date globally unique, since legitimate same-day sessions exist.
2. Copy the five listed fields explicitly, preserving the full planning prescription while intentionally resetting completion, export and sync state.
3. Review the existing workout-private contract as its own scoped fix. Preserve visibility during copy and enforce athlete read exclusion wherever those rows reach athlete views; avoid suggesting copying alone repairs the pre-existing disclosure.

Regression acceptance: same operation twice, concurrent replay, lost response after successful insert and failed reload each leave exactly one destination set; same key with changed intent is a conflict; distinct authorized operations behave deliberately. Full prescription/structure/unit/private marker round-trip. Actuals/comments/link/export state remain cleared. Unlinked coach remains denied. Coach sees private source/copy; athlete GET and athlete view do not expose either private row or its metadata. Verify schema enforcement in an isolated DB and real browser behavior before closing implementation acceptance.

## Candidate 2: dashboard load

**FAIL — recovery fallback provenance is mislabeled; manual actuals are omitted.**

The actual `/api/me` handler reads recent interventions and `strava_activities` (`me.js:94–110`); it does not query `planned_workouts`. Every fixture uses that handler. Recovery fixture: 30-minute Foam Rolling, numeric subjective feel 6, October 10. Imported fixture: 60-minute, 10 km run at average HR 140. Manual fixture: completed 60-minute, 10 km trail run, RPE 6. All other 41 daily points are zero.

| Case | Day load | Acute | Chronic | Form | Observed assessment |
| --- | ---: | ---: | ---: | ---: | --- |
| No activity, no logs | 0 | 0 | 0 | 0 | PASS zero baseline; still displays Balanced |
| Manual planned-workout completion only | 0 | 0 | 0 | 0 | FAIL inclusion: calendar has one completion/60 min/10 km, rollup unchanged |
| Recovery only, 30 min / feel 6 | 30 | 4.0 | 0.7 | -3.3 | FAIL provenance: positive recovery-derived load described as synced activities |
| One synced run + recovery | 77.0 | 10.3 | 1.8 | -8.4 | PASS: imported run only; recovery fallback suppressed |
| Matched plan + its synced run | 77.0 | 10.3 | 1.8 | -8.4 | PASS: no plan/activity double-count |
| Separate manual run + synced run | 77.0 | 10.3 | 1.8 | -8.4 | FAIL inclusion: separate manual actuals do not contribute |
| Recovery with missing duration and feel | 0 | 0 | 0 | 0 | PASS finite zero handling; does not establish adequate evidence |
| Recovery 30 min / missing feel | 25 | 3.3 | 0.6 | -2.7 | FAIL provenance persists; default feel 5 used |
| Recovery 30 min / string feel "9" | 25 | 3.3 | 0.6 | -2.7 | Diagnostic robustness case: numeric string defaults to 5; schema feel is integer, so not claimed as a normal DB output |
| Activity without moving time + recovery | 30 | 4.0 | 0.7 | -3.3 | FAIL provenance: activity row exists but does not disable recovery fallback |
| Synced run without HR | 50.1 | 6.7 | 1.2 | -5.5 | PASS finite estimate using the code's default intensity |

Every row returns status label **Balanced**. Every row also returns exactly:

> Exponentially-weighted training load from synced activities (7-day fatigue vs 42-day fitness).

Calculation provenance:

- `loadRollups.js:29–32`: recovery/intervention fallback is `parseFloat(dose_duration) × max(1, numeric subjective_feel or 5) / 6`. It does not inspect intervention type. `/api/me` does not even select type in this load query. Thus `30 min × 6 / 6 = 30`; missing feel gives 25. Non-duration intervention dose text that happens to begin with a number is also interpreted as minutes, but that additional case is not a separately claimed product defect here.
- `loadRollups.js:54`: any supplied activity with `Number(moving_time) > 0` disables **all** intervention fallback. An activity row with missing/zero moving time does not.
- Activities run through `computeActivityTrimp` (`trainingLoad.js:38–60`) with default resting HR 60/max HR 190 because this rollup passes no settings. At HR 140, reserve is 80/130, giving roughly 77 load. Missing HR and RPE use reserve 0.5, giving 50.1. These are descriptions of implementation, not claims of physiological validity.
- `loadRollups.js:86–95`: daily loads feed EWMA with 7/42-day time constants, then acute/chronic/form are rounded independently to one decimal. Independently rounded displayed chronic minus acute need not equal displayed form exactly.
- `loadRollups.js:105`: explanation is unconditional, including recovery-derived and absent-data results.
- `me.js:162`: response exposes `load_metrics` and `load_status`. Dashboard binds Acute/Chronic/Form and label, with the explanation in the `?` title tooltip (`dashboard.js:816–830`). Calendar header binds the same response to Fitness (CTL), Fatigue (ATL), Form (TSB), Status (`calendar.js:40–60`). There is no data-source indicator in these panels.

An end-to-end handler fixture also creates the manual completion through the real workout POST (200), reads it through real calendar GET (one completion; 60 min and 10 km by the real `summarizeWeek` helper), then calls `/api/me` (200; acute/chronic/form all zero). This proves accepted manual logging is omitted from this dashboard rollup, not merely that the pure load helper has no manual parameter. No synthetic intervention was added to accompany the manual workout: that is not required by the workout API contract.

Matched duplicates: confirmed/saved activity link is represented with the source-supported `activity_match_mode: manual` and `completed_activity_id`. `/api/me` reads the activity once and never reads the linked plan, so this case counts once. Supplying the same activity twice directly to the domain helper gives 154, but **normal-path duplicate loading was not reproduced**: stored activity IDs are unique and `/api/me` has no join that duplicates them. Different provider IDs representing one physical session are not tested. A stale positive-duration activity disables fallback in a direct helper call, but `/api/me`'s 42-day start-date query normally excludes it; this is a diagnostic edge, not a proven normal-path bug.

Impact: an athlete who logs only manual sessions sees zero dashboard load despite completed calendar work; a recovery-only athlete sees nonzero training-load numbers with an incorrect source explanation. The first qualifying import switches calculation provenance without disclosing that switch. A coach presentation should not claim reliable manual/synced training continuity from these panels yet. This report evaluates source consistency and completeness only, not safety, training quality or validity of the mathematical model.

Smallest fix recommendations, not implemented:

1. Remove recovery/intervention duration from training-load fallback and return explicit no-training-data/provenance coverage instead. If retained as a separate score, name and expose its actual input source.
2. Include completed manual workouts using **actual** duration and recorded RPE (or explicitly disclosed missing-intensity assumption), under the shared existing calculation contract. Exclude planned duration/TSS as actual evidence. Deduplicate manual/linked plans against imported activities by persisted link; preserve unknown/missing measurements rather than silently borrowing plan fields.
3. Return provenance and coverage with metrics; update tooltip and no-data display. If synced-only inclusion is a deliberate interim scope, say manual sessions are excluded and treat broader manual continuity acceptance as still open.

Regression acceptance: empty inputs visibly indicate no evidence; recovery-only logs cannot create training-load values mislabeled as synced; actual manual 60-minute completion is included/disclosed; planning-only rows never contribute; mixed distinct manual/imported sessions both contribute; saved matched plan/imported session contributes once; missing duration/RPE/HR remain finite and are disclosed; fallback/source changes are explicit. Dashboard/calendar use the same fixture-backed contract and source label. Validate relevant storage constraints in an isolated DB plus actual UI behavior before coach acceptance.

## PR134 comparison and disposition

Read-only Git comparison against current PR134 head confirms **identical Git blobs on main and PR134** for `planned-workouts.js`, `me.js`, `loadRollups.js`, and `trainingLoad.js` (manifest contains exact IDs). Neither candidate endpoint/domain behavior is fixed in that PR.

PR134's `coach-demo/adapter.js` does something different: `PLAN` includes the full prescription/private marker; copy uses a source/target/action fingerprint in `next.requests`, replays the prior IDs, and clones `pick(w, PLAN)` with cleared actuals. Its `rows`/`summary` filters exclude `coach_private` for athlete mode. These are synthetic adapter behaviors, not production-handler guards. The PR does update shared calendar/transport helpers, and its shared actual-TSS summary avoids substituting planned TSS for missing actual TSS; that separate calendar improvement does not change `/api/me` or its intervention fallback. `DEMO_PARITY_MATRIX.md` explicitly excludes training-load/progress analytics beyond calendar totals and states the deliberate copy/library differences.

PR metadata now records scoped independent acceptance of its fixed-date synthetic demo at runtime `54f2ab181848baf022c2fc59ce0c5c492f00da1d`. That metadata is a report by the PR authors/reviewer, not verification newly run here. It remains draft/unmerged. No hosted demo was exercised in this task.

Disposition: **FAIL/reproduced** for copy retries, five-field loss, private workout read semantics, load-source labeling and manual rollup omission. **PASS** for active-relationship denial and matched-plan/import counting once. **NOT REPRODUCED** for a normal `/api/me` duplicate-activity path. **BLOCKED/not performed** for deployed-schema parity, full application/browser acceptance, and optional PGlite workout-match regression (dependency absent; that suite also executes migration SQL, outside this task's no-migrations constraint). No dependency installation was needed for the selected reproductions. These limitations do not block the two requested fixture reproductions.

Suggested follow-up queue for the parent: record these verified gaps without closing M0 acceptance; prioritize private-draft contract review, then atomic copy/full-prescription retention and explicit manual/synced load provenance. Implement only under a separate authorized app-change scope; this session provides reviewable evidence and acceptance criteria only.
