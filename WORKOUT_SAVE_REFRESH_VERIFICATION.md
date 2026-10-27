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