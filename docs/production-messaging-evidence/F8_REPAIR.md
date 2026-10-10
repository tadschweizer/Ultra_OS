# F8 inbox availability repair

Repair delta on PR #137, from `7e390a46cf44c33e34e719f57a6864cc1bf5f92c`.
Independent combined checkpoint `d13ec51` found that an actual inbox GET 503
displayed an empty conversation state. The local regression first reproduced
the exact incorrect “No active coach conversation found.” text by renaming
`message_inbox_summary(uuid,text)` in disposable PGlite SQL. See `f8-before.log`.

The controller now distinguishes a successful inbox read from a load failure.
Unverified counts say Unavailable; only a successful GET can assert empty.
Failed refresh retains known conversations with an explicit last-loaded notice.
Retry reloads the actual inbox. A role/transport change clears cached identity;
401/403 clears cached conversations rather than retaining unauthorized data.
Inbox load errors remain separate from send/draft/read-acknowledgement failures.
Thread empty text uses the same verified-read condition.

## Reproduce and verify

From `webapp`, with Node 22 and installed Playwright Chromium:

```sh
npx playwright test e2e/message-workspace.spec.mjs --workers=1
npm run test:auth:full
npm run build
```

Windows local execution used the untracked `playwright.local.config.mjs`
override at `127.0.0.1:3103` and installed Chromium 1217. Repository CI uses
the committed normal configuration. Only synthetic identities and signed
handlers with disposable SQL were involved; no provider/email call occurred.

- Workspace browser regressions: 8/8 pass (desktop/390/320), including actual
  SQL outage, initial unknown count, recovery, cached refresh failure, unread
  preservation in the phone inbox, verified empty, URL/back/drafts, pending
  send navigation, keyboard/focus and accessibility.
- Final F8 disclosure retest: 2/2 pass at desktop and 320px.
- Production/auth regression: 432/432 pass.
- Final production build: pass. The repository has no separate lint/type script.
- Screenshots: `messages-f8-unavailable-*.png`, `messages-f8-retained-*.png`.

Logs copied here have only trailing whitespace/EOF normalization; original
local outputs remain under `output/`. Independent final combined QA remains
open. This repair does not alter the frozen hosted synthetic preview, message
API/schema, auth, provider setup, production config or deployment.
