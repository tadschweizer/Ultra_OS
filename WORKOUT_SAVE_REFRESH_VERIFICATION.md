# Workout save and calendar refresh verification

Date: 2026-10-27
State: locally verified; awaiting review and release authorization
Implementation: `6c0b6ea` on `codex/workout-save-refresh`, based on main `e3c50db`.

When a workout write succeeded, the editor previously waited for calendar, notes and event reads before leaving Saving. A delayed read therefore looked like a pending save. The editor now uses the acknowledged workout response immediately and refreshes the calendar in the background. A failed read clearly says the workout was saved and offers Refresh saved calendar, which never repeats the write. Failed writes keep the editor inputs. Older reads cannot overwrite newer calendar state.

## Validation

- Old source: both new coach and athlete delayed-refresh cases failed at editor closure, reproducing the dependency.
- Node 22.23.4: `npm run test:auth:full` — 505 passed.
- `e2e/daily-loop.spec.mjs` — 32 passed across desktop and mobile Chromium, covering completion, correction, matching, messaging, copy recovery and save acknowledgement.
- Final focused tests — six passed across desktop/mobile: failed-write input retention, acknowledged save while GET is held, failed-read recovery without another write, and late-response ordering across successive saves.
- `npm run build` passed with loopback public Supabase placeholders. No hosted service used for writes.
- Desktop/mobile synthetic screenshots inspected; no horizontal overflow in the focused cases. `git diff --check` and Impeccable detector passed.

Local logs and captures remain in the isolated worktree, outside this commit. Browser fixtures establish frontend behavior, not real provider, mailbox, participant or physical-phone acceptance. No backend latency reduction is claimed. No production deployment, merge, migration, configuration change or communication was performed. The live workflow still requires verification after a separately authorized release.
## October 27 — P2 calendar-enrichment repair

PR #151's raw mutation response replaced the decorated calendar entry, temporarily losing its recorded-day placement, linked activity, suggested actuals, compliance and comment count. The focused repair applies saved fields and recomputes decoration using only that workout's already-known activity. It retains comment counts, recalculates compliance after plan edits, and discards suggestions invalidated by date/sport/matching changes. A successful refresh remains authoritative.

Validation on Node 22.23.4:

- Both new confirmed/suggested browser regressions failed against the original component at the lost comment-count assertion.
- Full regression: 508/508 passed, including three new unit tests covering confirmed links, suggestions, invalidated matches, explicit unlinking and new manual completions.
- Integration availability: 4/4 passed.
- Full daily-flow suite: 38/38 passed across desktop/mobile Chromium. The new four cases hold the refresh, release it as a failure, then retry the read; recorded day, actuals, recomputed compliance, match guidance and comment count persist without another write.
- Production build with loopback public placeholders passed; git diff --check passed.

Local logs: webapp/review-151-before.log, review-151-unit.log, review-151-regression.log, review-151-integrations.log, review-151-focused.log, review-151-browser.log and review-151-build.log. Initial test-locator and asynchronous calendar-selection synchronization issues were corrected before the final passing suite. No production deployment, PR merge, API, database, provider or credential change occurred. Hosted exact-head CI follows the branch push; real participant and physical-device acceptance remain separate.

### Verification after main advanced

Reconciled main d10d95b after PR #146 merged by another action. Only the roadmap conflicted; application changes merged cleanly. On the combined tree, 508 regression tests, 50 desktop/mobile daily-flow/public-interface checks, and the production build passed. Logs: webapp/review-151-combined-regression.log, review-151-combined-browser.log and review-151-combined-build.log. Exact-head CI follows this normal merge push.

### Verification after suggested-match work merged

Reconciled main c42aab6 after PR #148 merged by another action. Only the roadmap conflicted. Updated the focused regression to verify suggested-completion wording alongside preserved actuals and compliance. Combined tree passed 508 regression tests, 60 desktop/mobile daily-flow, session-analysis and public-interface checks, and the production build. Logs: webapp/review-151-c42-regression.log, review-151-c42-browser.log and review-151-c42-build.log. Exact-head CI follows the normal merge push.
