# Message notification availability verification

October 22, 2026. Implementation `fb842e5`, based on main `e3c50db`.

When the preference endpoint reports email delivery unavailable, the UI already correctly prevents enabling email alerts. It previously offered only a short unavailable message and no way to recheck without reloading. The settings now explain the disabled control and retained badge/opt-out choices, expose a read-only availability refresh, preserve unsaved edits on refresh/failure and update availability from save responses. Refresh never submits the form or changes server preferences. No email provider is enabled by this change.

Verification in `webapp/`, Node 22.23.4:

- New expectation for actionable availability/recovery failed before implementation.
- Critical messaging browser suite: **18 passed** on desktop and 390px mobile, including existing conversation/draft/retry/persistence cases.
- Final four availability browser cases passed again with settings screenshots inspected: failed refresh retains unsaved badge choice, recovered availability enables the email option, refresh leaves stored preferences unchanged, successful save survives reload, and opt-out remains available during delivery unavailability.
- `npm run test:auth:full`: **505 passed**, no failures/skips.
- `npm run build`: passed with loopback-only public Supabase placeholders.
- `git diff --check`: passed; Impeccable detector returned `[]` for the changed component.

Browser command: `node node_modules/@playwright/test/cli.js test e2e/messaging-critical.spec.mjs --workers=1`, using a temporary copy of the repository configuration pointed at isolated loopback port 3138. Temporary port configuration removed after verification. Local logs: red-browser.log, green-browser.log, visual-browser.log, regression.log and build.log. Synthetic screenshots: `webapp/output/message-preferences/`.

No live mailbox, provider configuration or production preference was tested or changed. Fixture responses simulate availability; this does not diagnose current hosted delivery configuration. No deployment/migration/API authorization change; review/release and real email acceptance remain separate.
