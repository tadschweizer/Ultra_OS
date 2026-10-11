# Combined latest-main acceptance — 2026-10-10

Prepared under the user's authorization to correct and merge PR135–137. PR137 is now main `5554087624bd48bba2e5bd42ee364655c0101fc6`, deployed READY on both public domains. PR136's corrected branch is `eb96e7063a49749c6e2d8ace2358d1499e9bad83`; its production merge remains held for separate schema approval.

This PR135 preparation combines its reviewed `99e9e94` runtime with PR136's latest-main `b62ab28` runtime and evidence-only `eb96e70`. TrainingCalendar retains the exact reviewed blob `2af2e617b0ecd82deaf85559801c6a45c9746f0c`. All application source in webapp/components, webapp/lib, webapp/pages and coach-demo matches independent accepted QA `b10c309cf1a73563847658da0ffb7f3ad03ebac4` byte-for-byte. The accepted combined demo browser regression file was also retained; its task-specific local Playwright configuration is excluded from publication. Package scripts keep both the library/transport tests and calendar gap/message-workspace tests.

## Results

All execution used this task's isolated checkout, synthetic signed-handler fixtures and local PGlite databases. No production participants, secrets, real providers, email/billing or database mutations were used.

- Locked `npm ci --ignore-scripts --no-audit --no-fund`: PASS.
- `npm run test:auth:full`: 457/457 PASS.
- `npm run test:integrations`: 4/4 PASS.
- `npm run build`: PASS.
- `PW_DISABLE_TS_ESM=1 npx playwright test --config playwright.release.local.mjs e2e/workout-library.spec.mjs e2e/calendar-gaps.spec.mjs e2e/daily-loop.spec.mjs e2e/message-workspace.spec.mjs --workers=1`: 60/60 PASS, desktop and mobile, isolated production server port 3165 with reuse disabled.
- Synthetic demo `npm test`: 18/18 PASS.
- Synthetic demo `npm run build`: PASS.
- Accepted combined demo `npx playwright test --config playwright.release.local.js`: 28/28 PASS, fresh preview port 4185 with reuse disabled. Includes response-loss/reload retries, native-cache isolation, independent prescription targets, role switching, private drafts, matching, corrected actuals and complete coaching/message loop at desktop/390px/320px widths.

All local execution sessions completed. Logs are retained under verification/release-* in this evidence directory. PW_DISABLE_TS_ESM addresses Playwright 1.51's optional test-loader stall on this Node24 Windows host; application authentication and browser security remain intact. The demo uses its locked Playwright1.56 version.

## Release hold and remaining checks

Production catalog reads at 2026-10-10T17:58:53Z confirm the five new library metadata columns, both receipt tables/new RPCs, restrictive private policy and inbox visibility filter are still absent. Apply only the four separately approved reviewed sources, in chronological order, and verify catalog constraints, definitions, policies and grants before the PR136/135 main merges. Older pilot sources have already been applied under different timestamps; do not blanket-push migrations.

This prepared local combination is not a schema rollout or a participant acceptance result. Physical-phone, fresh-account, mailbox/provider, hosted Data API writes and independent-connection concurrency acceptance remain open. Publish the corrected PR135 branch normally and verify its new exact-head CI before merge; prior CI on 99e9e94 does not validate the new commit. Do not force-push or bypass checks.
