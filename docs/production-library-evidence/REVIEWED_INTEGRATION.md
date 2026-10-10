# Reviewed frontend integration into PR #135

Ordinary follow-up to `56a62e8e9bea4e5cf2e6b56d9c7fa2ae9822c514`, on the existing
`feature/production-library-messages` branch. No combined branch, merge into
main, manual deployment, remote migration or frozen preview change.

Independent QA accepted combined checkpoint
`b10c309cf1a73563847658da0ffb7f3ad03ebac4`, tree
`51273829eb76448dcdceecae5565584c743d06f6`, on 2026-10-10 between
07:36:34 and 07:51:12 UTC. The task-4 four-file handoff patch SHA256 is
`e97ce2a65e9c0afc3bf9b29c9db41e4a41a7e3081e948268ba6bef442345ebdd`;
task-3 accepted bundle SHA256 is
`68f26adf038c48add0100d26c75b8aac9731e6b3e6ceb0017e30e6ca023711b5`.
Both were read only; the bundle was imported into this workspace's local Git
objects for comparison. Other task checkouts were not modified.

## Exact runtime port

| Application file | Git blob, identical to accepted checkpoint |
| --- | --- |
| `webapp/components/TrainingCalendar.js` | `2af2e617b0ecd82deaf85559801c6a45c9746f0c` |
| `webapp/lib/WorkspaceTransport.js` | `52fd6e905fd6233846eafd3a3bda59990297cfdc` |
| `coach-demo/main.jsx` | `159d102273cdb9eb03bbb0c04af378166b19ac62` |
| `webapp/lib/copyWeekRequest.js` | `760fbc357dfeaef788f08dc3a0d8810ab0cde392` |

Native calendar completion refreshes the shared `/api/me` account/load cache.
Copy retry keys survive uncertain responses and reload, are scoped to the actor,
and are released on confirmed write before the following GET. Synthetic providers
receive only their injected callbacks; they cannot inherit native cache refresh.
Synthetic coach and athlete scopes are explicit; the coach library owner remains
stable while switching athletes. Existing prescription, private-plan, pointer
guard and retry implementations are retained.

The copy helper's validation import already exists in PR #135. It is the exact
frontend helper published in PR #136, not an alternative backend. No API handler,
auth enforcement, schema, dependency, lockfile, CI workflow or hosting settings
were changed by this port. Production authentication is preserved.

## Backend and test-script dependencies

PR #136 (`a8b9329f4ffaf7f34efdb7bafd9b32ee161c4ef2`) supplies atomic copy receipts,
private assignment visibility, complete library mapping, load rollups and Me.
PR #137 (`d1d329e65955bbf3a0c51b8f0e8ffe3ad65f7774`) supplies inbox cache/error/retry
behavior. The standalone PR #135 backend is not the accepted combined backend.

The accepted combined package contains calendar-gap suites/runner from PR #136
and message-workspace browser tests from PR #137. Copying those script references
alone would leave dangling files. This slice instead appends its new portable
`tests/workspace-transport-integration.test.mjs` to existing `test:auth:full` and
adds native callback/copy cases to the already-included `e2e/daily-loop.spec.mjs`.
The disposable combined-tree comparison retains the accepted package's complete
script union plus the new portable unit suite and checks every referenced file.
Build/dependency/deployment package fields must remain identical to b10c309.

Authorized future migration order, all currently unapplied remotely:

1. PR #135 `20261010025811_workout_library_plan_metadata.sql`.
2. PR #136 `20261010030000_private_workouts_and_week_copy.sql`.
3. PR #136 `20261010030100_private_workout_inbox.sql`.
4. PR #135 `20261010042931_workout_library_create_idempotency.sql`.

## Verification scopes

Portable unit tests exercise native forced cache refresh, durable actor-scoped
copy keys, and synthetic transport isolation with a native-cache bait and a fetch
trap. Browser native callback tests use protocol fixtures for this bounded port;
they do not independently establish PR #136 SQL atomicity. Existing library browser
tests execute real signed handlers and disposable PGlite SQL. Independent b10c309
QA covered the combined real-handler/SQL F6-F9/O1/P3 loop, including double clicks,
private boundaries, retries and desktop/390px/320px synthetic isolation.

Synthetic browser tests preload a native account/cache bait, exercise a failed
save and refresh, switch coach/athlete and roster recipients, then retry under the
coach scope. The native cache stays unchanged and no API/provider traffic escapes
the isolated demo. Only invented identities and local fixture data are used.

An initial new native protocol test expected generic GET error text even though
the fixture returned a specific error. The assertion was corrected to the actual
specific error; runtime files and coverage were unchanged. Final evidence follows.

Reproduce in `webapp`: `npm ci`, `npm run test:auth:full`,
`npm run test:integrations`, `npm run build`, and
`npx playwright test e2e/daily-loop.spec.mjs e2e/workout-library.spec.mjs --workers=1`.
The committed critical browser script includes both files. Windows local browser
run used Node 22.14.0, locked Playwright 1.51.1, Chromium 147.0.7727.15 and a local
config overriding the port to 3102 and Next dev to webpack; CI uses normal config.
In `coach-demo`: `npm ci`, `npm test`, `npm run build`, `npm run test:browser`.
No standalone lint/type script exists in this slice; compilation is covered by
Next build and Vite build. Logs and screenshots are in this evidence directory.

| Final local check | Result |
| --- | --- |
| `npm run test:auth:full` | 446/446 pass, including the 3 portable integration tests |
| `npm run test:integrations` | 4/4 pass |
| Native daily-loop + signed SQL library browser suites | 46/46 pass, desktop and mobile; new callback/copy cases use 320px |
| `coach-demo` unit suite | 18/18 pass |
| `coach-demo` full browser suite | 28/28 pass across 1440px, 390px and 320px, including 2 new scoped retry/cache isolation cases |
| Next native build / Vite static build | Both pass; standalone slice only |
| `git diff --check` | Pass |

Screenshots: [native load desktop](review-transfer-native-load-desktop-chromium.png),
[native load 320px](review-transfer-native-load-mobile-chromium.png),
[native scoped copy desktop](review-transfer-native-copy-desktop-chromium.png),
[native scoped copy 320px](review-transfer-native-copy-mobile-chromium.png),
[synthetic scope desktop](review-transfer-synthetic-scope-1440.png),
[synthetic scope 320px](review-transfer-synthetic-scope-320.png).
Exact commit/CI and disposable combined-tree proof are supplied in the final
handoff; a passing local slice build does not publish the combined application.

## Remaining gates

Physical phone/Safari, hosted PostgREST, independent database-connection races,
fresh-account/real-provider/mailbox delivery and participant acceptance remain
open. No simulation is evidence of external delivery. The frozen preview remains
`https://ultra-os-tb77-fbct852gc-tadschweizers-projects.vercel.app`, deployment
`dpl_EtjWEJQQ4gY6xA7UW7aFvf8SeB2B`, accepted limited runtime `54f2ab1`.
The accepted combined assets are distinct from this standalone slice's local build.
