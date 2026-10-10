# PR137 post-merge review: reproduced and corrected locally

Review: https://github.com/tadschweizer/Ultra_OS/pull/137#pullrequestreview-5480190881 (submitted 2026-10-10T17:53:00Z on d1d329e). Fresh online main at verification start: `5554087624bd48bba2e5bd42ee364655c0101fc6`. No later production schema or account changes were made by this task.

Runtime/test correction commit: `042a9497c4ea5856fa1d12d9b3e931e1cd5d3a1c`, local branch `local/pr137-review-fixes`. Baseline runtime blobs: MessageWorkspace `28b2204291be53dfaffd63d869b6b9be9ba841f0`, messages page `1913b5b6e15a2a9661e1f02063ebe9e43e082f9f`, messageClient `657e4388f355ecc585d97957f122b230bbb6671b`. messageClient, handlers, migrations, authentication, RLS and dependency lockfiles are unchanged by the fix.

## Finding 1: initial desktop recovery does not load a selected thread

**CONFIRMED FAIL on unchanged main; local fix PASS. High confidence for reproduced paths.**

Minimal reproduction: seed one incoming athlete message in isolated PGlite; rename its local inbox RPC so the real signed inbox GET fails; open desktop `/messages?mode=coach`; restore the local function; click visible Retry loading. The same defect reproduces when recovery is triggered by window focus/background refresh.

Expected: successful desktop recovery selects the first athlete, loads its history, produces a calendar link carrying that athlete and permits sending a valid draft without manual recipient selection.

Observed: the conversation list and first-recipient heading return, but history says "No messages yet", calendar href is `/coach/training-calendar?athlete=`, and Send remains disabled despite a saved nonempty draft. `baseline/observed.json` contains these measured values from retained trace attachments. The desktop retry and focus cases both failed the required history assertion. Mobile retry/focus correctly leave the list open and messages unread until explicit selection; both mobile cases passed before the fix.

Cause: the thread retry always requested keepSelection=true even with an empty athleteId; background refresh also preserved an empty selection. `pages/messages.js:load` therefore skipped its normal first-recipient/history branch.

Smallest correction: the visible retry preserves selection only when an athlete exists; load normalizes keepSelection against an actual target so background recovery follows the same rule. The existing mobile visibility condition remains in force. Regression acceptance verifies loaded history, correct link, enabled Send and exactly one successful synthetic reply; mobile stays unread until selected.

## Finding 2: rejected read acknowledgement mislabels a successful inbox GET

**CONFIRMED FAIL on unchanged main; local fix PASS. High confidence for reproduced paths.**

Minimal reproduction: seed one incoming message; open its explicit recipient thread; let signed inbox GET succeed, then abort only the browser's mark_read POST to `/api/message-center`. Run at desktop and mobile widths.

Expected: retain the fresh inbox/history and show the existing read-status-specific warning, preserve the recipient draft and unread count, then acknowledge on a later successful refresh.

Observed: history contains the loaded message, while the UI reports "Unable to load messages right now" and "Showing the last loaded conversations". Trace snapshots show stale=1 and an actual loaded history. The rejected-write cases failed on both desktop and mobile. HTTP 503 acknowledgement responses already produced the correct read-status warning and passed before the fix. No message loss was observed in these fixtures.

Cause: acknowledgeMessages rejects when fetch rejects; that exception escaped into load's outer GET failure catch after fresh state was installed.

Smallest correction: convert only an acknowledgement rejection to the existing false acknowledgement result. The version guard and existing warning/retry path handle it; actual inbox GET failures retain their existing unavailable/stale behavior. Regression acceptance verifies fresh history, no false stale/load warning, unread=1 while acknowledgement fails, unread=0 after restoration/focus refresh, one history row and unchanged recipient draft.

## Commands and results

Windows Node 24.14.0, locked Next 16.2.11, Playwright 1.51.1. The isolated production server uses port 3168, reuseExistingServer=false and synthetic Supabase placeholders. PW_DISABLE_TS_ESM=1 disables the optional test-only transformer that stalls on this Windows/Node runtime; app authentication and browser security are unchanged.

1. `npm ci --ignore-scripts --no-audit --no-fund`: PASS.
2. `npm run build` on unchanged main: PASS; retained baseline-build.txt.
3. `PW_DISABLE_TS_ESM=1 REVIEW137_STAGE=baseline npx playwright test --config playwright.review.local.mjs e2e/message-review-faults.spec.mjs --workers=1 --output ../output/review137/baseline`: **4 FAIL, 4 PASS**, expected negative reproduction. Original failure log, screenshots, observed JSON and all four trace.zip files are retained under baseline/ and baseline-browser.txt.
4. `npm run test:auth:full` after correction: **432/432 PASS**.
5. `npm run build` after correction: PASS.
6. `PW_DISABLE_TS_ESM=1 REVIEW137_STAGE=fixed npx playwright test --config playwright.review.local.mjs e2e/message-review-faults.spec.mjs e2e/message-workspace.spec.mjs e2e/message-database.spec.mjs e2e/messaging-critical.spec.mjs e2e/daily-loop.spec.mjs --workers=1 --output ../output/review137/fixed`: **58/58 PASS** (eight new fault cases plus fifty existing cases). Covers true inbox outage and recovery, selected-thread read acknowledgement, recipient drafts/switching/Back/reload, pending-send navigation, lost-response sends, mobile unread behavior, keyboard/focus, accessibility and daily coaching flows. Logs and fixed screenshots retained.

All tests used local PGlite and synthetic signed handler/route fixtures. Function rename affected only the fixture's in-process database. The route abort affected only the synthetic read-status request. No production database/RLS/authentication changes, participant messages, real providers, credentials, email/billing or migrations were used. All commands completed and servers were closed by Playwright.

## Publication recommendation and dependency impact

Keep merged PR137 and its remote branch unchanged. The separate runtime/test patch applies cleanly, verified read-only, to both prepared PR135 `d8c1881` and PR136 `eb96e70`; neither prepared branch was modified by that check.

Recommend a reviewed follow-up within remaining PR135, with a title/description that explicitly includes messaging recovery. Its existing shared UI release makes it the better fit than PR136's privacy/copy/load backend scope. Preserve PR135's library/transport/copy tests and append `e2e/message-review-faults.spec.mjs` to both test:e2e:critical and test:e2e:messages; do not replace its package scripts with this main-based package file. The follow-up CI wiring is prepared separately in this local branch. Verify the resulting new exact-head CI before any merge.

This is a seven-line UI/control-flow correction, plus regression coverage. It adds no schema, API, auth/RLS, provider, npm dependency or migration requirement. PR135/136's four existing production schema prerequisites and separate approval hold remain unchanged. It can also ship as a schema-independent UI-only PR if the schema release is deferred, but that requires approval for a new PR scope; none was created or published here.

Physical-device and real-network acceptance remain outside this synthetic verification. No PR push, amendment, new PR, main merge or deployment occurred for this follow-up.
