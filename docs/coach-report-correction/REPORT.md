# Coach report correction: local verification

Base: released main `64a440eba60cc23d9d753879da0b79e97cd47f64`, tree `5a95c6bfa676086940884c52f2834d37568b0b1b`. This correction is separate from the demo-only PR134 simulation. Independent QA reproduced four failures on this base with real signed handlers and PGlite SQL. QA subsequently accepted exact patch `c65a00a107fa0fcef0cca30ed8f3db28748c9fd50958190ca3c52b7af6a39d53` (127 assertions,12 shared-outage cases); accepted commit `adc9b9c` and a test-only compatibility follow-up were published as PR#138 at `3499b8bf6591a0dc41002a1ffa2d2dc64cd88a9d`. CI38108268980 and that earlier head's automatic preview passed. Independent QA now also accepts boundary patch `c09d80bb1b5ba35d9ddf66b95780a08546509e09c62bdfd9ca2028029a955e82` on3499b8b. Only this report/roadmap acceptance wording changes after that exact acceptance; runtime and tests remain byte-identical. Existing PR#138 is authorized for the correction, with new final-head CI/automatic preview evidence tracked in its checks/description and task-root publication manifest. Merge, production deployment and schema/security changes remain outside authorization.

## Observed failures and correction

| Finding | Baseline | Correction / acceptance |
| --- | --- | --- |
| F1 protocol compliance provenance | Two Heat logs inflated both Heat and Nutrition to 29%; an unrelated Sleep log raised both to 43%. | Percentage unavailable. Schema-defined planned session counts remain 2 and 4; matching sampled logs are 2 and 0. Unrelated logs do not create compliance. Assignment date/type/race matching uses the existing helper. |
| F2 freshness | 2020 Sleep logs were described as recent / On track. | Explicit 28-calendar-day UTC window, date filtering before sample limits, factual log counts. Old/future/out-of-window logs excluded; logs establish no readiness/adherence conclusion. |
| F3 missing scores | Three NULL scores became average zero, high confidence and no missing data in a fully populated fixture. | Missing/blank/invalid/out-of-range scores remain unknown. Real zero remains a usable score. Average requires three usable values. Existing validated workout-check-in formula is retained. Presence of rows no longer produces readiness confidence. |
| F4 query failures | Real SQL 42P01/42703 failures became HTTP200 empty / not-found / zero-compliance results. | Any report query error or rejected read returns generic HTTP503 without SQL details or synthetic data. UI shows unavailable and Retry report; successful retry restores the report. Successful empty athlete lookup is HTTP404. Session/relationship guards remain unchanged. |

## Schema and calculation limits

`webapp/supabase/migrations/20260325103000_add_coach_protocols_and_race_type.sql` defines `planned_sessions` as a nonnegative integer count, plus assignment dates/type/race. It does not define a percentage target or an explicit completion-to-assignment link. The existing protocol route aliases this count to `compliance_target`; dividing a capped sample by an invented denominator cannot establish compliance. The fix deliberately reports unavailable rather than introducing a new formula.

Repository DDL does not supply a complete `daily_checkins.readiness_score` definition. Test fixtures explicitly scaffold that integer column and extra assignment display columns. Therefore production NULL-score feasibility is unverified; synthetic results prove defensive behavior, not that real accounts contain these values. `COACH_PILOT_READINESS.md` also documents the absence of a writer for `daily_checkins`.

UTC readiness window dates and timestamp filtering are advertised. Plan reconciliation uses its separate explicit28-day local calendar window and the calendar's existing recorded-local-day matching. Its fetch includes a two-UTC-day lower-bound buffer, filtered out by the local window before aggregation. Samples still show at most8 intervention logs,8 imported activities,8 daily check-ins and30 workout check-ins; readiness counts and usable averages are drawn from those samples, not exhaustive training histories. Report data coverage is a count of five input groups, not a confidence or physiological estimate.

## Reproduction and regression commands

From `webapp`:

```powershell
npm run test:coach-report
npm run test:auth:full
$env:PLAYWRIGHT_TEST='1'
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY='test'
npm run build -- --webpack
$env:PW_DISABLE_TS_ESM='1'
npx playwright test e2e/coach-report.spec.mjs --config=playwright.coach-report.local.mjs --workers=1
```

The local config is an external handoff artifact, not proposed application code. It starts the production build on loopback port3170 with `reuseExistingServer:false`. The checked-in normal browser config can also run the new test. Browser API transport invokes real signed handler factories with isolated PGlite. Ancillary API routes are explicit501 fixtures; external requests are blocked and counted. These tests do not exercise production accounts/providers.

Acceptance includes 320px,390px,1440px, explicit window/sample/unknown labels, no unsupported percentages/high-confidence/On track wording, real42P01 recovery via Retry, no horizontal overflow, no external requests or browser exceptions. SQL tests also rename eight report tables and an athlete column to trigger real42P01/42703, and retain unsigned401. No migration, security or provider change is required for this correction.

The handoff manifest outside the proposed patch records final test counts, exact patch SHA256, build ID, source/served-asset hashes and independent retest instructions. Independent QA remains a release gate.

## G1: shared profile-query outage recovery

Independent retest of patch7a95e440 passed F1-F3 and report-handler/isolated Retry, but failed full shared-fault recovery: real intervention-table42P01 or athlete-column42703 also made `/api/me` return500, which the shared client treated as unauthenticated and redirected to login. The original retest remains authoritative for that artifact; it is not an unconditional acceptance.

The local correction in `webapp/lib/meClient.js` extends its existing503 unavailable/retry payload to all HTTP5xx, disabling cached eligibility and usage claims until a successful recheck. It does not change server session verification, cookie issuance/expiry/revocation, route permissions, credentials, policies or schema. HTTP401/403 still return unauthenticated to callers, and both clear cached access claims. A5xx response establishes neither logout nor verified access; protected content remains behind the existing safe access guard.

New real-handler tests cover both shared SQL500 cases with/without prior cache, unchanged valid session and recovery, all5xx classification, real unsigned/expired/invalid/revoked401 and real athlete-role report403. Browser regressions use genuine synthetic signed cookie headers, repeat shared-fault recovery through the global guard's actual Try again link, and assert no new session is needed. Existing report-only Retry and F1-F3 cases remain in the suite. Cold sessions may show only the global guard: no claim is made that the report's own Retry control remains visible while `/api/me` is unavailable.

Original failed browser trace and client tests are retained outside publication scope. Independent QA subsequently accepted this G1 artifact as exact patchc65a00a1 with127 assertions and12 shared-outage cases; the separate boundary retest now also passes as recorded below. Production NULL-score feasibility remains unverified.

G1 results before the boundary review: `npm run test:coach-report`9/9 and full regression466/466; webpack production build PASS; six coach-report browser cases plus four existing pilot503-guard cases10/10. Shared faults cover both cold/cached sessions at320/390/1440, retain the identical signed cookie through actual Try again recovery, and do not render protected report content during failed access verification. Expired/invalid/revoked401 redirects and athlete-role restriction pass. F1-F3 helper/report API/report UI source was byte-for-byte unchanged at that time from the earlier independently retested artifact. These local results did not replace subsequent independent acceptance.

## Review correction: reconciliation timezone boundary

Review discussion4240129692 was reproduced against published3499b8b, rather than treated as a static finding. At `2026-10-11T01:00:00Z` (October10,19:00 in America/Denver), the page's local window is September13–October10 while the handler fetch started on September14 UTC. An athlete-visible September13 run plan with a matching September13-local activity starting September14,01:00 UTC produces HTTP200 with no planned workout, then UI `0 of 0 planned sessions completed` and `1 unplanned`; expected is `1 of 1` completed,100% duration compliance and no unplanned activity. Original browser trace and signed-handler response journal are retained under the task workspace's `output/playwright/coach-report-boundary-baseline/`.

The original signed handler and unchanged reconciliation domain helper also reproduce omissions in Los Angeles and UTC+14; UTC and the next-local-day UTC+14 case are controls. Source is read verbatim from3499b8b, with only relative import URLs adapted for the standalone baseline harness. Fixed-clock SQL fixtures are isolated PGlite, never production records.

The correction preserves the distinct measures: readiness keeps its28-day UTC timestamp/date window and sample limits. Plan reconciliation keeps coach-local bounds and activities' stored local dates. Shared helpers `reconciliationWindow` and `reconciliationFetchStart` make these rules explicit. The latter pads the fetch by two UTC days: the coach's date may be one day behind UTC, and an athlete in another timezone such as UTC+14 can begin that oldest local day on the preceding UTC date. The existing local-window summarizer excludes fetched padding and future rows. No global activity-matching, calendar calculation, authorization, schema or readiness formula changes. The UI now states actual plan bounds/timezone and recorded-local-day semantics. Calendar-day subtraction also avoids an elapsed-hours DST boundary error.

Bounded tests cover fixed Denver/Los Angeles/UTC/UTC+14 dates, a Denver coach with a UTC+14 athlete, local end-day rollover, UTC-12 and Denver's fall DST transition; oldest-day matching remains1/1 and100%, outside-local-window rows do not contribute, and readiness samples remain filtered by UTC independently. Browser fixtures use real signed cookies and handler factories, block all external requests, record statuses/text, and check1440px and320px. Commands: `npm run test:coach-report`; `npm run test:auth:full`; synthetic-loopback webpack build; `npx playwright test e2e/coach-report.spec.mjs e2e/coach-report-boundary.spec.mjs e2e/pilot-access.spec.mjs --config=playwright.coach-report.local.mjs --workers=1 --grep='signed coach report|G1:|expired, invalid|entitlement failure|local reconciliation'`. The original critical browser script union is preserved and includes the new boundary spec.

Review discussion4240129696 is addressed by updating the published roadmap's Status, Current milestone, Next item and progress evidence to reflect the already accepted c65 artifact/3499b8b checks, the now-accepted exact boundary retest, and the actual next review gate. The prior uncommitted roadmap journal is backed up outside publication scope. Earlier failure evidence and acceptance limits remain intact; hosted signed workflows, physical phones and production NULL-score feasibility remain unverified.

Boundary local result: PASS. Focused11/11; full regression468/468; webpack build `5O_lkUJuWpX9mTMbPnkRU`; twelve browser tests pass (six existing report, two boundary, four existing503 guard tests). The two boundary tests record twelve timezone observations at1440/320; each shows1/1 completed and100% duration compliance, explicit local bounds, unchanged UTC readiness window, no external request or browser exception. Nine production assets match served/build bytes in the existing report regression. Twelve shared-fault recovery observations and genuine expired/invalid/revoked/athlete-role denials remain passing. Independent acceptance of exact boundary patchc09d80bb now PASSES; previous CI/preview links describe3499b8b only.

Independent boundary result: PASS,304 assertions and42 boundary +60 nearby regression observations at1440/390/320. All12 source hashes matched; nine served assets matched QA's own webpack build `jFlpowcAE6JDwjkdT593h`, rather than the implementer's build. Fixed boundaries, differing coach/athlete zones, fall/spring DST, padding/future exclusions, manual/private/matched/confirmed corrections, UTC readiness samples, F1-F4, shared G1 failures and true session/role/relationship denials pass. QA also ran focused11/11 and full468/468. Report: task-3/output/playwright/protocol-boundary/QA_PR138_BOUNDARY_RETEST.md; archive threshold-pr138-boundary-independent-pass.zip SHA256 `32625F8FBDFEB56FBFF56AAA7F84A4818CCB3CEF96B854FB0A0BDA2872FB2993`. One initial320px confirmed-link navigation timeout passed a fresh instrumented retry; its cause remains unconfirmed and the original output is retained. Acceptance covers this isolated source/runtime, not physical hardware or hosted authenticated/provider workflows. The post-QA change is limited to these two acceptance documents; current publication/check identities are recorded separately.
