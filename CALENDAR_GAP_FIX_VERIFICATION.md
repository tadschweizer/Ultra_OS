# Calendar/private-draft/load verification

Both candidate gaps were **reproduced** on fresh online main
`fa8ebe2b377784007b4a40b4e982f92a11224075`. The subsequently authorized focused
fix passes local acceptance. Main and hosted services remain unchanged.

Review artifact: [draft PR136](https://github.com/tadschweizer/Ultra_OS/pull/136),
branch `fix/private-drafts-copy-load`, based directly on main. Implementation
commit: `d300153aff08142425fb8ed1ed4e2dbdb8e812bf`; evidence transcript cleanup:
`0eafca1e64496abb94da9f5aa7ce72fcf55283cb`. Committed text transcripts have trailing
whitespace removed; original workspace transcripts remain preserved separately.

The original [report](docs/calendar-gap-evidence/baseline/GAP_REPORT.md),
[results](docs/calendar-gap-evidence/baseline/results.json),
[manifest](docs/calendar-gap-evidence/baseline/manifest.json), source excerpts and
[rerun](docs/calendar-gap-evidence/baseline/reproduction-rerun.txt) preserve the
unmodified-main evidence. Eight passing baseline assertions establish the defects;
they are not product acceptance. That historical report describes the verification
phase before implementation authorization.

## Exact source and isolation

Base main, refreshed October 10: `fa8ebe2b377784007b4a40b4e982f92a11224075`.
Read-only PR134 head: `6f1d3f4f3633095a0aac9e83600b77b3ce2bb596`, draft/open,
unmerged. Candidate handlers/domain files have identical Git blobs to main.
Simulated demo behavior does not prove production fixes; no demo commits were
cherry-picked. PR135's published library contract checkpoint is
`f52d59546d4a8010b60a7b1b77557ccdcbc56e23`, draft/open and stacked on PR134.
Its endpoint/helper/UI implementation was pending at that checkpoint.

Work ran in the separate `Documents/Codex/2026-10-09/task-4/source` checkout.
Canonical desktop and active demo checkouts were not accessed. Original main was
archived before editing. Existing local work was preserved. Runtime: Windows
PowerShell, Node `v24.14.0`, locked Next `16.2.11`, Playwright `1.51.1`, PGlite from
the existing lockfile; tests explicitly set timezone UTC.

Real handler/domain code runs with signed synthetic cookies, real session-version,
role and relationship resolution, and an SQL-backed adapter to in-memory PGlite.
Provider boundaries are injected out. Browser API routing dispatches affected
requests into those handlers; unrelated APIs return empty synthetic fixtures.
Browser tests abort external requests and assert none occurred. Build values point
to localhost with synthetic keys. No secrets, production databases, participant
accounts, real providers, email or billing were used. Prepared SQL ran only in
synthetic PGlite. No merge or production rollout was performed. Repository
automation may build PR previews after a branch push.

## Expected and observed

| Scenario | Original observed | Required result and local fix acceptance |
| --- | --- | --- |
| Same copy twice/lost response after commit | Two row sets; both HTTP200 | PASS: one row set; same IDs on replay |
| Same key, different dates/authorized athlete | Key ignored | PASS: HTTP409; unauthorized target remains403 |
| New deliberate copy after confirmed success | Retry indistinguishable | PASS: new key, second row set |
| Full prescription copy | Five fields lost/defaulted | PASS: all metadata/structure/units retained; actuals reset |
| Private source and clone | Athlete GET returns source; clone defaults visible | PASS: hidden from athlete/another linked coach; assigning active coach sees |
| Recovery-only 30min/feel6 | Load30, ATL4.0, CTL0.7, form-3.3; described as synced | PASS: null metrics, no recorded training, neutral status |
| Manual60min completion | Accepted actuals; dashboard load0 | PASS: contributes duration/RPE estimate with manual provenance |
| Matched imported activity/plan | Import counted once | PASS: retained; duplicate imported IDs also once |
| Missing actual duration/intensity | Unrelated recovery could substitute | PASS: duration excluded/disclosed; intensity default disclosed |
| Library assignment | Five fields omitted | PASS with PR135 schema; absent schema gives503 |

Original copy preserved sport/title/description, full structure JSON, planned
duration/distance/unit/TSS, order, library reference and date offset. It set the
target/acting coach and appropriately reset completion/export state. Lost fields:
objective and instructions -> null; target_metric distance -> duration;
planned_if0.75 -> null; coach_private -> athlete_visible. The baseline report
records exact source paths, full outputs, minimal reproductions and all load cases.

These failures can duplicate a coach's prescriptions, remove execution instructions,
expose intended drafts and make recorded training disappear from load summaries.
The fixes prevent future occurrences; they do not infer or restore metadata lost
by historical copies. No live participant impact was asserted from fixture results.

## Fix contracts and regression acceptance

`pages/api/planned-workouts.js` requires UUIDv4 retry identity, valid distinct dates,
existing coach role and active relationship, then uses one service-only RPC.
`20261010030000_private_workouts_and_week_copy.sql` fences `(actor_id,request_id)`
with a primary key and retains athlete/from/to intent and created IDs. Copy rows
and retry record commit atomically. Same key replays; changed intent conflicts;
failed insert rolls back both. Replay rechecks access, returns current rows and
never resurrects deleted workouts. Authorization holds the relationship lock for
the transaction. No fallback insert exists when the RPC is absent.

`lib/copyWeekRequest.js` and `TrainingCalendar.js` retain uncertain requests across
retry/reload in session storage, scoped to actor and athlete/week pair. Confirmed
success releases the key before refreshing. Refresh failure does not discard
write success; the next deliberate copy gets a new key. Storage-unavailable
browsers retain in-memory retry protection but cannot persist it across reload.
Desktop and mobile coach controls use the same contract.

`lib/workoutVisibility.js` preserves private-draft semantics: the assigning coach
with an active relationship can read; athlete and another linked coach cannot.
Publication remains an explicit coach visibility update. Range and outside-range
linked plans are filtered before compliance/comment counts/linked-ID construction.
The same boundary protects comments, workout export, personal account archives,
edits/deletion and coach detail. Personal archives add the visibility predicate
before each SQL pagination request; active assigning-coach workout exports remain
authorized and the personal archive never broadens to coached athletes' records.
The restrictive RLS policy grants no new access. The second prepared migration,
`20261010030100_private_workout_inbox.sql`, filters subjects before inbox aggregation
and pagination, including unread counts. Export uses the existing revocation-aware
resolver; no authentication relaxation is introduced.

`lib/loadRollups.js` and `/api/me` use actual imported durations and visible manual
completions' recorded duration/RPE. Planned totals and recovery/intervention logs
never enter training load. Linked imported activities supersede their plan once.
An import lacking duration can use a linked completion's actual duration on its
recorded activity day. No usable duration yields null metrics and “No training
load data”. Provenance includes source, matched/duplicate counts, missing duration,
intensity assumptions and coverage. Query failure gives503, not empty-history
metrics. Calendar/dashboard show visible explanations and refreshed actuals.
`trainingLoad.js` is unchanged. No physiological validity claim is made.

## Explicit library dependency

The owner-scoped mapper preserves objective, instructions, target metric, IF,
visibility, full structure including repeats/ranges/target_units/notes, canonical
distance and unit, and reference. Validated overrides preserve null/zero. Nullable
text has a10,000-character limit; enums reject explicit null; planned_if is finite
nonnegative or null. Explicit null totals stay unknown; only omitted POST totals
may derive. PATCH omission retains stored fields.

For planned-workout PATCH specifically, supplying a replacement `structure`
recomputes omitted totals from that new structure. Explicit null/zero totals
remain unchanged as provided; PATCH without structure retains omitted totals.
Dimensions absent from a replacement structure become unknown instead of
retaining stale totals.

### Review follow-up: structure-only PATCH regression

Independent review of PR136 head `0a25f1eeb821d09786f3508ec71e4a1c1c4f6d52`
identified a mismatch introduced by explicit-null preservation. The real signed
handler reproduced it: PATCH `{id, structure:[{type:'work',repeat:2,duration_min:20,
distance_km:3,intensity:'z2'}]}` returned HTTP200 with all three planned totals
null, instead of duration40/distance6/TSS33. See
`verification/patch-structure-before.txt`: the desired assertion fails before
the fix on that exact app source.

The PATCH caller now passes omitted values as undefined into the derivation
helper, preserving explicit null and zero. After derivation it writes unknown
dimensions as null, preventing stale totals when a replacement structure lacks
duration/distance. A ninth real-handler/SQL test covers structure-only PATCH,
explicit null, explicit zero, mixed omission/null/zero, unrelated title-only
PATCH, omitted metadata/actuals/units, duration-only structure and empty structure.
All nine acceptance groups pass after the correction; full regression is441.
The new pre-fix/after/full/build evidence accompanies the original logs.

### Review follow-up: personal archive and linked activity window

Two more source findings were reproduced with signed real handlers and synthetic
SQL before fixing their unchanged paths from reviewed head `0a25f1e`:

- `/api/account-export` returned HTTP200 and included private title “Trail climbs”,
  objective “Efficient uphill movement” and instructions “Keep descents easy;
  use poles on steep climbs”. `collectAccountExport` now adds athlete-visible
  filtering before every SQL page. The signed archive test checks one-row pages,
  all later visible rows, private-field absence, session revocation, unchanged
  coach-private workout export and unchanged personal-archive ownership.
- `/api/me` with an August30 plan linked to an August28 import (41 vs43 days
  before the October10 fixture run) reported source `manual_completions`, count1,
  chronic0.6 and `has_data:true`. It had not loaded the activity outside its query
  window and substituted the plan date. Missing confirmed links are now resolved
  independently of that window in athlete-scoped batches of100. Rollups use the
  activity date, exclude out-of-window links and report unavailable links/dates
  explicitly. Legacy non-UUID/provider IDs stay unresolved rather than causing
  SQL casts or inventing manual provenance. Lookup failure gives503. Tests cover
  window start/day before, missing date/record, foreign-owner links, legacy IDs,
  true manual completion and duplicate imported/matched sessions counted once.

`verification/privacy-boundary-before.txt` captures both failed pre-fix assertions
and exact synthetic outputs. Read-only reviewed Git blobs: accountExport
`3a8adef99b55f9203d20b46dc6f4437c911f0672`, loadRollups
`e30f47b37d913cce1f1123b43cb51dc177deaa9c`, me
`ad819018b7589a0774ab9f76ad91112ac1c71b7e`. These follow-ups add two groups:
latest acceptance is11 groups and full regression443, superseding the interim441.
The same PR carries all three confirmed review repairs; no additional migration
or production action is needed for these application changes.

The additive library migration remains owned by
[PR135](https://github.com/tadschweizer/Ultra_OS/pull/135),
`20261010025811_workout_library_plan_metadata.sql`. The unchanged snapshot in
`webapp/tests/helpers/contracts/` executes only in PGlite. Tests use its exact
published schema, not the pending endpoint/save UI. Absent metadata columns
return503 instead of silently losing fields. Coordinate the mapper and library
API/helper/UI release after both tasks' acceptance. Green CI on the published
contract checkpoint does not establish completed library parity. No unrelated
demo history is required by this branch.

## Commands/results

From `webapp`, after locked `npm ci --ignore-scripts --no-audit --no-fund`:

```powershell
$env:TZ = 'UTC'
npm run test:calendar-gaps
npm run test:auth:full
$env:CALENDAR_GAP_REGRESSION = '1'
npm run test:e2e:calendar-gaps
npm run build
```

Baseline:8/8 assertions establish defects;38/38 existing focused tests pass.
`docs/calendar-gap-evidence/baseline/reproduce.ps1` archives exact main into a
fresh temporary directory and uses a network-denying loader. New acceptance:
11 groups PASS, included in full regression. **443/443 regression PASS**, zero
skipped. **30/30 desktop/mobile Chromium PASS**: six new real-handler/local-SQL
scenarios and24 existing daily-loop scenarios. No external requests/page errors
in the six new scenarios. **Next build PASS; git diff --check PASS.** No standalone
lint/typecheck scripts exist; none is claimed.

The repository CI now includes these eleven SQL/API acceptance groups and the
dedicated six-scenario browser run. Local results above do not imply GitHub CI
has completed; check the current PR head before considering release.

The browser wrapper disables only Playwright's optional TS ESM transformer for
this native-JavaScript suite because it stalls on Node24 Windows. Config starts
a fresh localhost server on3147, never reusing another task's server. Successful
build used synthetic localhost Supabase URL/anon/service keys and synthetic
session key, with telemetry disabled. No environment file was created. An initial
sandboxed build had a CSS-worker connection failure; the same build succeeded
outside that process sandbox. Final logs: [verification](docs/calendar-gap-evidence/verification/).
Screenshots: [desktop copy](docs/calendar-gap-evidence/screenshots/copy-desktop-chromium.png),
[mobile copy](docs/calendar-gap-evidence/screenshots/copy-mobile-chromium.png),
[unknown](docs/calendar-gap-evidence/screenshots/no-data-mobile-chromium.png),
[manual](docs/calendar-gap-evidence/screenshots/manual-mobile-chromium.png).

Confidence is high for exercised contracts. PGlite executes real PostgreSQL SQL
but serializes queued requests in one engine; Promise.all does not prove races
across independent hosted connections. Hosted PostgREST mapping, deployed schema
drift, independent-connection concurrency, physical phones and actual participant
acceptance remain unverified. Mobile is browser emulation.

## Rollout gate/rollback

After separate release authorization, review/apply the two prepared migrations
in order **before** dependent app deployment; install PR135 library schema before
library/assignment deployment. Run catalog-only
`webapp/scripts/calendar-gap-schema-preflight.sql`. It checks both RPCs, invoker
rights/empty search paths, client-denied function grants, retry-table RLS/grants,
restrictive privacy policy and inbox guard. Missing copy RPC gives503; existence
of an old inbox RPC alone is insufficient. Preflight passes locally after the
prepared migrations and fails after rollback.

Staging acceptance must repeat signed coach/athlete/other-coach/revocation checks,
private range/outside-range links and unread counts, independent-connection copy
races/lost-response retries, direct/library/copy metadata/null/zero/units, and
manual/imported/matched load provenance. Keep M0 mailbox, fresh-account,
physical-phone and participant checkboxes open.

`webapp/scripts/rollback-private-workouts-week-copy.sql` is a prepared, separately
reviewed fallback. Coordinate app reversion first. It drops retry RPC/table/policy
and restores the old inbox function while retaining workouts; only PGlite was
used to test it. It restores less-private legacy behavior and removes retry
history. Do not apply it automatically or redeploy dependent copying without
reviewed restoration. Prefer retaining privacy schema when reverting app code;
the release owner must review these consequences.
