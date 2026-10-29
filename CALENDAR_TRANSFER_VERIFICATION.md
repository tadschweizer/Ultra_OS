# Calendar date movement and activity matching

Updated: 2026-10-29. Prepared locally; production migration and release are not performed.

## Behavior

- Drag an unfinished planned workout onto another day to change its date. Other sessions on that day remain in place. To exchange two days, move the first session and then move the second back to the first day.
- Recorded completions, skipped sessions and imported activities cannot be moved between dates through this control. Athletes can move their visible plans, including assigned plans. An active assigning coach can move their prescriptions; another coach cannot rewrite that plan.
- Drag an unfinished plan onto an unassigned imported activity, or drag the activity onto a workout, then confirm the named pair. Cancellation and failed requests leave the selection available. The recorded activity's date is unchanged.
- The athlete and active coaches who can read the workout can confirm, replace or unlink activity matches. A coach uses their own signed identity. Matching never impersonates the athlete, links another athlete's activity or bypasses private-draft visibility.
- Phones and keyboards: open a workout and choose **Move workout to another day**, select a date, then **Move workout**. The existing imported-activity selector and **Confirm activity match** work for both roles.
- Duplicate matches are refused. Atomic PostgreSQL decisions retain the existing unique-link constraint, notes, prescription and feedback. Version conflicts return HTTP 409. Identical retries after a lost response do not rewrite the saved result.
- Automatic matching remains a conservative suggestion until explicitly confirmed. This change does not broaden automatic matching to unrelated sessions.
- Unconfirmed suggested plans are still movable. A deliberate date move turns automatic matching off for that plan, clearing its tentative association so it stays on the chosen day. A later explicit match or **Use automatic matching** can restore that behavior.

## Local verification

Commands run from the isolated checkout's `webapp` folder with Node 22.23.4. No real training records or provider services are used.

```powershell
node --test tests/calendar-transfer.test.mjs tests/workout-match.test.mjs
npm run test:auth:full
npx playwright test e2e/daily-loop.spec.mjs e2e/session-analysis.spec.mjs
npm run build -- --webpack
```

The focused SQL tests execute actual PostgreSQL semantics through PGlite behind the signed API handler. They cover date movement, coach matching, stale/replayed requests, private drafts, foreign activities, removed/expired relationships and public-role function denial. Browser tests use synthetic intercepted records, actual desktop mouse gestures and phone-sized date/match controls, including reload and failure recovery.

Final results and commit/PR evidence are recorded in the implementation branch roadmap. Local and preview results do not establish hosted schema readiness, real participant acceptance or physical-phone acceptance.

Local results on October 29: 531 authentication/critical regressions passed; 14 focused matching/movement checks passed, including signed SQL fixtures. Daily-loop/session-analysis browser run passed 60 cases with two deliberate native-drag skips on phones. After allowing unconfirmed suggested cards to be dragged to a different recording, the final focused run passed all 12 applicable cases, with four phone-native-drag skips (the phone date picker and selector are covered). Webpack production build, whitespace check and Impeccable detector passed. Desktop and phone screenshots were inspected. Initial fixture-schema expectations and instant automated drag sequencing failures were repaired; no failure was waived.

Independent review identified that an unconfirmed automatic suggestion must also remain eligible for a date move. That case is corrected, including clearing tentative automatic association on an explicit move. After the correction: 531 regressions and 14 focused cases pass; the expanded desktop/mobile transfer suite passes all 16 applicable cases with four deliberate phone-native-drag skips. Dedicated reload assertions prove that a rescheduled suggestion stays on the chosen day. Matching correction covers valid replacement, zero distance and duplicate-link rejection under the updated function.

## Production gate

The daily maintenance authorization excludes production database migrations and permission changes. Obtain specific owner approval before applying `webapp/supabase/migrations/20261029150644_calendar_move_and_coach_matches.sql` and releasing this PR.

Before application, inspect hosted schema and migration history, verify the exact reviewed SQL, and apply only this new migration. `FEEDBACK_HISTORY_PERMISSIONS.md` documents mismatched historical local/hosted versions; never replay those or run a broad database push. The migration adds two server-only functions and updates the existing match function, without changing stored training rows or granting browser roles access. It checks active/unexpired/nonremoved coaching relationships within the transaction.

After approved schema application and exact-head CI/review, merge normally, verify the production deployment's commit, and check live controls without creating fake records or moving genuine training data for testing. Real completion/matching acceptance requires an owner-directed genuine action. Do not mark feedback completed automatically.
