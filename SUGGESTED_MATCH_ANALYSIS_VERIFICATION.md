# Suggested-match analysis verification

October 21, 2026. Implementation `1b3b87d`; base main `e3c50db`.

The calendar decorates automatically suggested activities as completed for display, while the stored plan can remain planned. Previously opening its detail mounted completed-workout analysis and showed the API's completion error with an ineffective retry. The detail now explains confirmation and avoids that request. Only a saved completion opens analysis. Existing athlete confirmation loads analysis after its successful update; coach access is unchanged. The completion summary labels suggestions explicitly.

Verification from `webapp/`, Node 22.23.3:

- New regression failed before the fix: missing confirmation guidance.
- `node node_modules/@playwright/test/cli.js test e2e/session-analysis.spec.mjs --workers=1`: 10 passed across desktop/390px mobile using the same repository configuration on isolated port 3137. Covered suggested athlete/coach states, refresh, zero analysis requests before confirmation, existing confirmation transition, confirmed assigned charts, manual results and unassigned recording/retry.
- Final four suggested-state browser cases passed again with overflow assertions and screenshots; desktop/mobile screenshots visually inspected. Local images in `webapp/output/session-analysis/suggested-*.png`.
- `npm run test:auth:full`: 505 passed, zero failures/skips.
- `npm run build`: passed with loopback public Supabase placeholders. No production credentials used.
- `git diff --check`: passed. Impeccable detector on TrainingCalendar returned `[]`.

Sanitized local logs: `red-browser.log`, `green-browser.log`, `visual-browser.log`, `regression.log`, `build.log` at the task worktree root. The temporary port configuration was removed. Tests use synthetic fixtures and do not establish real participant recordings, linked-coach acceptance, physical-phone behavior or a production fix. No deployment, migration, provider enablement or production writes. Review/merge/release remain separate.
