# Production library metadata verification

Latest repair: [F9/P3 target-unit preservation and synthetic source provenance](F9_PRESCRIPTION.md).
Independent `4a9cdec` QA passed F8/O1 and blocked full transfer on F9; the new
delta preserves assigned prescriptions through unrelated edits and supports
deliberate per-step pace conversion. Combined acceptance remains open.

PR #135, branch `feature/production-library-messages`, base PR #134 `6f1d3f4f3633095a0aac9e83600b77b3ce2bb596`. Online main was verified as `fa8ebe2b377784007b4a40b4e982f92a11224075`. The frozen synthetic preview/runtime is unchanged. This evidence concerns actual production library code, not a demo-only adapter.

## Implemented

The shared editor payload sends objective, separate coach instructions, planned IF, primary target and assignment visibility in production. The real authenticated coach-owned endpoint selects/stores/patches them. Additive migration `20261010025811_workout_library_plan_metadata.sql` preserves legacy rows/defaults, ownership RLS, existing grants and IDs. Explicit nullable values and zero are retained; PATCH omission does not derive or overwrite stored totals. Invalid types/enums/units are rejected; cross-origin JSON mutations, revoked sessions, noncoaches and foreign ownership are denied.

Exact contract and backend mapper dependency: [PRODUCTION_LIBRARY_CONTRACT.md](../../PRODUCTION_LIBRARY_CONTRACT.md).

Independent QA at `4eadc767` found F6 (GET outage falsely rendered empty) and F7 (uncertain create retry duplicated a template). Both now have bounded repairs and failed-before/pass-after regressions. See [F6/F7 repair evidence](F6_F7_REPAIR.md) for the new migration, exact retry protocol, test output and remaining acceptance gate. The older results below describe the initial metadata slice; they do not accept the revised implementation or the combined runtime.

The parent subsequently requested porting the combined checkpoint's fast-response pointer double-click guard. [Exact port/evidence](DOUBLECLICK_PORT.md) records its matching WorkoutEditor runtime and regression; intentional subsequent and keyboard saves remain distinct. No combined conflict resolution or synthetic namespace is published through this PR.

## Checks on 2026-10-10

| Check | Result |
| --- | --- |
| `node --test tests/workout-library.test.mjs` | 6/6 pass: shared payload, validation, exact migration twice/legacy/RLS/constraints, signed CRUD/ownership/null/zero/PATCH, unavailable-schema response, test-origin import ordering |
| `npm run test:auth:full` | 438/438 pass, includes the 6 library tests |
| `node --test ../coach-demo/tests/adapter.test.mjs` | 17/17 pass; production shared payload expectation updated |
| `npm run build` | Pass outside Windows sandbox child-process restriction; normal Next 16 Turbopack build |
| Playwright `e2e/workout-library.spec.mjs` | 2/2 pass, desktop Chromium and 390px phone viewport: real production editor, signed handler + PGlite SQL, save, reload, full metadata verification, delete, no horizontal overflow |
| `git diff --check` | Pass |

Screenshots: [desktop](library-desktop-chromium.png), [phone](library-mobile-chromium.png). Only invented isolated test identities/data appear. Browser transport replaces outer HTTP routing and `/api/me`; library writes and reads execute the actual signed-session handler and exact local SQL migrations. These are not hosted PostgREST/provider tests.

The first browser expectation incorrectly assumed unrounded mile conversion; corrected to the existing editor's two-decimal canonical kilometer value (`6 mi → 9.66 km`). A subsequent desktop cold-compile/full-calendar screenshot scenario exceeded its 30s total timeout; its bounded scenario timeout is now 60s. Final run passed both projects in 45.1s, scenarios 8.0s/7.0s. No assertions were removed.

Implementation CI at `3959374` passed units/integrations/build and 129 other browser scenarios (3 intentional skips), but rejected both new library mutations because the pilot-access browser fixture changed the configured origin after module import. The hardcoded signed test origin was therefore correctly rejected by production CSRF enforcement. The fixture now uses the active isolated deployment origin and has a dedicated regression, with production origin checks unchanged. New-head CI must confirm this correction; the earlier run is not a passing implementation claim.

## Reproduce

In `webapp`, run `npm ci`, the commands above, then `npx playwright install chromium` and `npx playwright test e2e/workout-library.spec.mjs --workers=1`. Use Node 20/22 for the locked Playwright 1.51.1 runner: local Node 24.14/24.21 stalled at discovery. Local browser verification used an official checksummed temporary Node 22.14.0 runtime, installed Chromium 1217, port 3102 and `next dev --webpack`. No dependency/lockfile upgrade or production setting changed. CI runs the committed normal config. The signed fixture cookie secret and `.test` identities exist only in the isolated test process; no production credentials or database connection are used.

For an isolated port, create a local config importing `./playwright.config.mjs` and override `use.baseURL`, `webServer.command` (include `--hostname 127.0.0.1 --port 3102`), `webServer.url` and `reuseExistingServer:false`; optionally set `use.launchOptions.executablePath` to an installed Chromium. Run with `--config <local-file>`.

## Release prerequisites and limits

Do not deploy this expanded library API before applying both additive library migrations in the authorized release. This task prepared/tested migrations locally and did not execute any real database migration. Full assignment parity also requires the parallel backend owner's validated five-field library mapper; this PR deliberately does not edit planned-workouts, copy-week, load calculations, `/api/me` or calendarMutation. Physical iPhone/Safari, hosted Data API and production migration execution are not run. The original `4eadc767` POST lacked durable idempotency; independent F7 reproduced that risk. The revised endpoint uses an atomic coach-scoped receipt and stable browser retry key, detailed in the linked repair evidence. No new provider sends, payment actions, auth bypass, merge or manual deployment occurred.

Independent review/acceptance of this new implementation remains open; the earlier synthetic-runtime QA does not accept this production slice.

Cross-fixture retest: pilot-access + workout-library specs together, both projects, **14/14 pass** in 1.3m. Final full regression **438/438 pass**. CI/independent acceptance are evaluated against the correction commit, not 3959374.

## Current O1 follow-up

Independent combined QA found the saved template browser editor missing. See [O1 editor contract and verification](O1_EDITOR.md). PR #135 now edits existing template metadata through owner-scoped PATCH and the shared editor. Earlier pointer-port whole-editor hash is historical; the guarded create handler and durable create helper remain. Final combined edited-template assignment and independent/hardware acceptance remain open.
