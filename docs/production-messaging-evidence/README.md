# UX-006 production messaging verification

Branch `feature/messages-native-ui`, separately based on PR #134 head `6f1d3f4f3633095a0aac9e83600b77b3ce2bb596`. This slice is independent of the production library PR #135. Online main was freshly verified as `fa8ebe2b377784007b4a40b4e982f92a11224075`. The accepted synthetic runtime `54f2ab` and its immutable preview remain frozen and unchanged; this new UI is not claimed accepted by that earlier demo QA.

## Implemented

The actual `/messages` page now uses a familiar conversation list, sender-relative incoming/outgoing bubbles, chronological scrollable history, a thread header/calendar link and a composer below the conversation. Desktop shows list and thread together; phones open the inbox list first, then show the selected thread with Back. URL selection survives refresh and browser Back. Message purpose and notification preferences remain available as secondary controls. Plain Enter inserts a newline; Ctrl/Cmd+Enter sends, and successful send returns focus to the composer. Message text keeps line breaks and wraps long tokens.

Existing persistent server drafts, conflicts, stable retry identities, exact message-ID read acknowledgments, older history and truthful email delivery states remain in use. No message backend/schema, authentication or relationship authorization was replaced. Hidden mobile inbox threads are not acknowledged; background updates preserve their unread counts. A late send result after browser Back cannot switch the newly selected thread or clear the other recipient's draft. The shell's floating inbox button is hidden on `/messages` so it cannot cover the phone Send control; other routes retain it.

## Verification, 2026-10-10

| Check | Result |
| --- | --- |
| `npm run test:auth:full` | 432/432 pass on this independent branch |
| `npm run build` | Final normal Next 16 Turbopack production bundle passes |
| Playwright messaging-critical + message-database + message-workspace + daily-loop | 48/48 pass, desktop and phone Chromium, 3.5m |
| New workspace scenarios | Actual signed handlers and PGlite SQL: only viewed recipient read, inbox polling stays unread, separate drafts/reload/Back, sender-relative bubbles, keyboard/newline/focus, calendar link, 320px layout, pending send + navigation |
| Accessibility | WCAG 2A/2AA checks of the new conversation list and thread, including contrast, pass |

Existing browser scenarios also pass two-way coach/athlete delivery, durable drafts, another-tab conflict protection, draft failure/retry, lost committed response retry (one message/outbox record), send lock/repeated clicks, notification preference failure/reload, older history retained after refresh, canonical contextual messaging links and daily workout regressions. Preferences/delivery tests use isolated fake identities and SQL outbox records; no actual email provider delivery is performed or implied.

Browser HTTP and `/api/me` are isolated. Database scenarios execute the actual signed message/draft/preferences/read handlers and existing migrations against local PGlite. They prove local handler/SQL behavior, not hosted PostgREST or real mailbox delivery. Other UI scenarios use an explicit mock store and make no server authorization claim. Screenshots contain invented `.test` identities/training text only.

## Reproduce

In `webapp`: `npm ci`; `npm run test:auth:full`; `npm run build`; `npx playwright install chromium`; then `npm run test:e2e:messages` and `npx playwright test e2e/daily-loop.spec.mjs --workers=1`. The new workspace spec is included in messages and critical CI scripts. Use Node 22 with the repository's locked Playwright 1.51.1: local Node 24 stalled at discovery. Local verification used an official checksummed temporary Node 22.14.0 runtime, installed Chromium 1217 and isolated port 3103 with `next dev --webpack`. CI uses the normal committed config; no dependency/lockfile upgrade or production setting change.

For concurrent local servers, create a config importing `./playwright.config.mjs`, override `use.baseURL`, `webServer.command`/`url` to an unused port, and set `reuseExistingServer:false`; optionally set `use.launchOptions.executablePath` to installed Chromium. Run `--config <local-file>`. This task never uses production credentials, production athlete data or real provider connections.

## Fixes and limits

Initial browser failures included a low-contrast calendar link, an alert assertion tied to the old composer ordering, the now-hidden empty mobile composer, a cold calendar compile timeout, and a pending label mismatch (`Sending…` versus `Sending.`). Contrast and assertions were corrected without dropping required behavior. The 48-scenario final run passes with no retries. The signed SQL/navigation suite also tests the late-response guard added during implementation.

Physical iPhone, virtual keyboard/safe-area behavior on hardware, Safari/Firefox, screen-reader users, hosted API/provider acceptance and consenting real-mailbox delivery remain not run. UX-006 remains open pending independent acceptance. The original synthetic preview was not rebuilt or redeployed; any future synthetic build incorporating this new UI needs its own routing/phone QA and fresh immutable identity. No production deploy, merge, real database migration, credential creation, paid resources or email/payment sends occurred. Library assignment metadata validation is the parallel backend owner's separate slice; this messaging PR does not edit its routes.

Final route-string compatibility retest: the six signed SQL/workspace scenarios pass again in 41.8s after the final build. Screenshots: [desktop thread](messages-thread-desktop-chromium.png), [phone inbox](messages-list-mobile-chromium.png), [phone thread](messages-thread-mobile-chromium.png), [320px](messages-thread-320.png).
