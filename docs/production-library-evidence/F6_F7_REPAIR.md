# Library outage and uncertain-create repairs

Same approved draft PR #135, branch `feature/production-library-messages`; delta from `4eadc7674e9a78fea252aac3cf786b9b885ff3cf`. PR #137 and frozen demo runtime `54f2ab` are unchanged. This is a production library repair, not independent acceptance of the combined application.

## Failed before

Independent signed-runtime QA pinned `4eadc767` and reproduced F6/F7 in `task-3/output/playwright/production-slices/QA_PRODUCTION_SLICES.md`. Five saved templates plus a genuine library GET 503 rendered `Library (0)` and the empty assertion. A POST committed before its response was replaced with 503; retry created a second template UUID.

New browser regressions failed on the old implementation: unavailable/retry control absent; lost-response retry returned **two rows where one was required**; refresh lost the unconfirmed operation. The new signed API test also failed because retry returned a different ID. Original failure output is retained in [browser-before.txt](f6f7-browser-before.txt) and [unit-before.txt](f7-unit-before.txt). These are bounded local reproductions supporting the independently pinned baseline, not a second independent audit.

## Resulting behavior

F6: loading, unavailable and verified-empty states are distinct. A failed GET never replaces known templates or asserts an empty library. Initial failure shows `Library (unavailable)` and an explicit retry. A failed refresh keeps the known count/cards and says they are last loaded data. Successful retry clears the outage message; a successful empty response may show the empty state.

F7: the real coach calendar saves a UUID operation key and immutable prescription snapshot **before** POST, in sessionStorage scoped by signed coach profile and browser tab. Uncertain transport/5xx/malformed responses retain both. Retrying in the editor, closing/navigating, or reloading the same tab uses that original operation. Changed editor input cannot silently replace an uncertain intent; the recovery action submits its original snapshot. Confirmed success clears the operation, and a deliberate next create uses a fresh key. Definitive validation/access rejection permits correction; a deleted-result response does not resurrect a template. Browser storage failure blocks a new POST.

The API still resolves the coach from the signed session, rejects noncoaches/revoked sessions/cross-origin mutations, and requires owner scope on reads/patch/deletes. POST requires `client_request_id`; no unsafe unkeyed fallback exists. A service-role-only SECURITY INVOKER function inserts receipt and template in one transaction. The receipt's `(coach_id, request_id)` primary key serializes overlapping attempts. A canonical JSONB SHA-256 fingerprint rejects changed prescriptions with 409 without retaining another copy of instructions. PATCH preserves original intent; DELETE preserves a minimal receipt, so its old operation returns 410. Another coach with the same key receives only their own independent result.

## Verification

Only invented signed accounts and disposable PGlite SQL were used. Library browser calls execute the actual handler and migrations; `/api/me` and unrelated HTTP endpoints are fixture envelopes. No credentials, real database writes, providers, email, payments or production deployment.

| Check | Outcome |
| --- | --- |
| Library unit/signed SQL suite | 9/9 PASS: original metadata/ownership/CSRF checks, replay/fresh intent/mismatch/coach scope, edit/deletion, missing key, repeatable exact receipt migration, denied anon/authenticated table/function access, SECURITY INVOKER, rollback on failed insert, overlapping calls, browser storage recovery/isolation/failure |
| Full regressions | 441/441 PASS |
| Integration availability | 4/4 PASS |
| Frozen demo fixture contracts | 17/17 PASS; original runtime is not rebuilt |
| Library + daily loop + pilot access | 46/46 PASS desktop/mobile, including 320px F6/F7 and 390px original metadata workflow |
| Final receipt SQL/browser retest | 9/9 unit/signed SQL and 10/10 browser PASS on final fingerprint migration |
| Normal Next production build | PASS, no deployment |
| Revised exact-head Auth Smoke CI | Use PR #135's exact-head check and final handoff run/commit identity; previous-head green checks do not accept these repairs |

The final receipt-only refinement stores a fingerprint rather than payload text. Its focused unit/browser retest supplements the earlier full-regression and surrounding-flow run; revised-head CI must exercise the complete committed version. PostgreSQL fixture calls overlap on one PGlite connection; this does not claim hosted concurrent-connection acceptance.

Screenshots: [initial unavailable at 320px](f6-unavailable-320.png), [retained five templates and retry at 320px](f6-retained-320.png), [confirmed retry in editor](f7-editor-320.png), [confirmed retry after refresh](f7-refresh-320.png). Raw output: [final unit/SQL](f6f7-unit-final.txt), [final browser](f6f7-browser-final.txt), [surrounding 46 scenarios](f6f7-surrounding-browser.txt), [production build](f6f7-build.txt). Baseline assertions remain intact; no automatic retries or removed assertions turn a failed case into a pass.

## Reproduce and integrate

Use Node 22 and the committed lockfile. From `webapp`:

```sh
npm ci
node --test tests/workout-library.test.mjs
npm run test:auth:full
npm run test:integrations
npm run build
npx playwright install chromium
npx playwright test e2e/workout-library.spec.mjs e2e/daily-loop.spec.mjs e2e/pilot-access.spec.mjs --workers=1
npm run test:e2e:critical
```

Local browser runs use the documented isolated port 3102 config and installed Chromium. F6 renames `objective` in the disposable SQL database, exercises the actual 503, restores it and retries; then repeats after a successful load to prove cached cards survive. F7 calls the real POST handler, confirms its commit, replaces only the HTTP response with 503, retries/reloads and checks IDs/row counts/keys. A subsequent intentional click must produce a new key and second row. A separate case rejects an invalid name, permits correction, holds a pre-commit 503, blocks changed uncertain intent and recovers the original snapshot after closing.

Apply `20261010042931_workout_library_create_idempotency.sql` after `20261010025811_workout_library_plan_metadata.sql`, before deploying the revised library POST. No remote migration was applied. The new receipt table/function explicitly grant service_role only, following [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database function guidance](https://supabase.com/docs/guides/database/functions). Built-in hashing requires no pgcrypto extension; see [PostgreSQL binary functions](https://www.postgresql.org/docs/15/functions-binarystring.html). Current Supabase changelog and applicable minor-version/Data API breaking notes were reviewed.

For the parent's unpublished `f26adf60` combined checkpoint, bring this delta from old #135 `4eadc767` alongside the new migration and three library helpers. TrainingCalendar changes concern only library imports/state/load/save/status plus `libraryOwnerId`; the real coach page supplies that storage namespace. Calendar mutation alias, copy helper/mobile button, `/api/me` refresh, planned-workouts and training-load code remain the backend owner's work. The integration comparison uses a read-only imported bundle; task-4's checkout is unchanged.

Remaining gates: independent F6/F7 and combined full-loop retest; physical iPhone/virtual keyboard/Safari; hosted PostgREST and real concurrent DB connections. Browser recovery is scoped to the same tab, not a cross-device editor draft. No merge, migration application or launch is authorized by these passing local checks.
