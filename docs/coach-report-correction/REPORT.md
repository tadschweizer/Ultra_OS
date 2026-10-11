# Coach report correction: local verification

Base: released main `64a440eba60cc23d9d753879da0b79e97cd47f64`, tree `5a95c6bfa676086940884c52f2834d37568b0b1b`. This correction is separate from the demo-only PR134 simulation. Independent QA reproduced four failures on this base with real signed handlers and PGlite SQL. The correction is local and awaits independent retest before the approved new PR may be published. Merge, deployment and schema/security changes are outside this authorization.

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

UTC window dates and timestamp filtering are advertised. The calendar's separate reconciliation uses its existing local-day workflow. Samples show at most 8 intervention logs, 8 imported activities, 8 daily check-ins and 30 workout check-ins; counts and usable averages are drawn from those samples, not exhaustive training histories. Report data coverage is a count of five input groups, not a confidence or physiological estimate.

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

Original failed browser trace and client tests are retained outside publication scope. The revised exact artifact requires a new independent retest; production NULL-score feasibility remains unverified.

Revised local results: `npm run test:coach-report`9/9 and full regression466/466; webpack production build PASS; six coach-report browser cases plus four existing pilot503-guard cases10/10. Shared faults cover both cold/cached sessions at320/390/1440, retain the identical signed cookie through actual Try again recovery, and do not render protected report content during failed access verification. Expired/invalid/revoked401 redirects and athlete-role restriction pass. F1-F3 helper/report API/report UI source remains byte-for-byte unchanged from the independently retested artifact. These local results do not replace independent acceptance.
