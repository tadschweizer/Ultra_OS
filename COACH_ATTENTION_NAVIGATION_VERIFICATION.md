# Coach attention navigation verification

October 23, 2026. Implementation `1e140b9`, base main `e3c50db`.

Athlete choices in the daily coaching-question board previously opened the protocol-focused drawer. Attention-card and roster background clicks did the same. The primary athlete selections now link to the existing athlete review page. Attention-card names and Review athlete links, plus full-roster athlete names, use the correct athlete ID. Background clicks are inert; Assign protocol explicitly opens the unchanged assignment drawer. Messaging/removal controls retain their existing handlers.

Verification from `webapp/`, Node 22.23.4:

- New navigation regression failed before implementation because the attention link was absent.
- Pilot UX suite: **16 passed**, desktop and 390px mobile.
- Final four focused navigation cases passed after adding full-roster assertions. Tests check href/keyboard destination, no implicit drawer reads, flag-explanation clicks, and explicit protocol action. The destination document is a synthetic interception; tests do not claim to validate actual review-page data or authorization.
- `npm run test:auth:full`: **505 passed**, no failures/skips.
- `npm run build`: passed with loopback-only public Supabase placeholders.
- `git diff --check`: passed. Impeccable detector returned `[]`.
- Desktop/mobile triage-card screenshots visually inspected: `webapp/output/coach-attention/`.

Browser command: `node node_modules/@playwright/test/cli.js test e2e/pilot-ux.spec.mjs --workers=1`, with a temporary repository-derived configuration on isolated port 3139. The temporary port configuration was removed. Local sanitized logs: red-browser.log, green-browser.log, final-browser.log, regression.log, build.log.

No production account, training record, note, protocol, relationship or provider changed. No migration, service configuration, merge or deployment. Local fixture verification does not establish physical-phone, hosted review-page or participant acceptance. Review and release remain separate.
