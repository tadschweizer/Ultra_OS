# Weekly coaching workflow — implementation and release record

October 16, 2026. Deployed with owner authorization in PR #141. See WEEKLY_COACHING_RELEASE_2026-10-16.md for the production migration, verification, and remaining owner-access setup. The implementation evidence below records the original local checkpoint; existing M0 physical-phone, mailbox, participant, and elapsed-use gates remain open.

## What was built

The coach training calendar now offers **Plan week**: choose active athletes, select saved workouts or the assigning coach's source week, preview every athlete, edit individual prescriptions, confirm targets and occupied-day additions, and publish. A separate result appears for each athlete. Confirmed assignments survive a failed result for another athlete. Reloading restores an unconfirmed publication so retry uses the original identifiers.

Publishing is atomic for each athlete's week. It preserves independent prescription snapshots, weekday offsets, workout ordering, explicit targets and original units. It never copies completion, feedback, conversations, activity matches, or review state. It does not rescale targets automatically. Existing destination sessions are retained. Source changes, destination changes, lost permissions, or altered retry payloads are rejected rather than silently accepted.

The calendar and command center have a **Workouts to review** list, using completed assigned sessions and explicit response requests. Coach-note age is no longer presented as a communication SLA; protocol-log age is not described as missing training data. Counts that cannot be loaded are unavailable, not measured zeroes.

Within a published assigned session, the coach can send a reply and record review, choose **Reviewed — no change**, or open the next scheduled session for a separate adjustment. Reading a discussion does not finish review. Reviewing without a reply does not resolve an outstanding response request. New athlete comments or completion corrections reopen review. They do not revive an already answered request unless the athlete explicitly asks again.

Athletes can save feedback without marking a session complete or disconnecting an imported activity. Unfinished completion feedback, discussion text, and review replies survive a same-browser reload. Restored completion drafts retain their original version so they cannot silently overwrite newer server data. A response request asks the athlete to save unfinished feedback first.

Athlete/week/workout context is retained in calendar and message links. Roster errors offer retry. Missing actual duration/distance is explicit, and weekly totals identify missing inputs. Unverified actual training-load comparisons were removed from the calendar presentation; stored historical calculations were not rewritten. Library planning metadata remains intact.

## How to try it after the release is approved

1. Sign in as the approved coach and open **Training Calendar**.
2. Select **Plan week**. Choose a destination start date and the athletes.
3. Select **Choose library workouts**, or choose a source athlete/week and select **Load source week**.
4. Check the workouts to reuse, then select **Preview each athlete**.
5. Use each athlete's **Edit** button to adjust dates, instructions, duration, distance, or structured steps. Review their existing sessions and confirm individual targets. Check the occupied-day option only if you intend to add alongside existing work.
6. Select **Publish week**. If one athlete fails, retry unconfirmed athletes; the confirmed athletes are not republished.
7. As the athlete, open the assigned session, record completion and feedback, and save. **Save feedback only** keeps the completion and activity match unchanged. Use **Ask coach to respond** for an explicit request.
8. As the coach, open **Workouts to review**, inspect the result, then reply or mark reviewed without change. Use **Adjust upcoming session** to edit the next session; its save is separate and must succeed.
9. As the athlete, reopen the session to see its review acknowledgement and discussion, and inspect the updated upcoming prescription.

This guide describes the implemented flow. It does not imply the live site has received this release.

## Server and database contract

- `/api/coach/weekly-plan`: GET returns authorized source/destination planning; POST publishes one athlete's week. The multi-athlete interface orchestrates independent atomic calls, avoiding an all-or-nothing roster failure.
- `/api/workout-review`: GET returns the assigning coach's paginated queue or one session's review state; POST records a response request, review acknowledgement, or reply. Replies and acknowledgements have durable retry receipts.
- New records: `workout_week_publications`, `workout_coach_reviews`, `workout_review_actions`. New workout fields: `completion_revision`, `response_requested`.
- Database triggers increment completion revision for meaningful result changes and athlete discussion comments. Review acknowledgements store the exact reviewed revision.
- Server calls check identity, role, coach paid/pilot access where applicable, assigning-coach ownership, visibility, and active relationships. Database functions recheck relationship status, removal, expiry and source ownership. New tables have RLS and no direct anon/authenticated privileges; privileged calls use security-invoker functions restricted to the service role.
- Migration: `webapp/supabase/migrations/20261017003222_weekly_coaching_workflow.sql`, generated by the installed Supabase CLI. It is additive and has only been applied to disposable synthetic PostgreSQL test databases.
- Read-only catalog check: `webapp/scripts/weekly-workflow-preflight.sql`. Expected result: both columns true; all three tables present with RLS/client-denied/service-access true; all four public RPCs present with invoker/client-denied/service-access true; two enabled triggers.

## Verification and evidence

Functional baseline: existing source already supported single-athlete planning, structured workout editing, library assignment, manual completion, persisted match corrections, and session discussions. It lacked the new multi-athlete week preview and independent review lifecycle. No real coach timing baseline or time-savings result is claimed.

Evidence is under `webapp/output/weekly-workflow/`:

- `pre-existing.patch` and `pre-existing-status.txt` record the checkout before implementation. They are local preservation evidence, not a release patch.
- `regression-final.log`: final broader existing regression suite, 481 passed.
- `final-focused.log`: calendar, activity matching, library, daily-loop and new workflow checks, 45 passed at that checkpoint.
- `database-final.log`: six new workflow scenarios passed, including seven-day publication for five athletes, independent snapshots, retries, atomic rollback, source conflicts, review/reply transitions, client-denied access, expired relationships, entitlement enforcement, unavailable migration, and catalog checks.
- `browser-release.log`: 64 browser checks passed across desktop and emulated phone, covering the new workflow plus existing daily-loop, messaging workspace, and library journeys. An earlier run had a locator ambiguity after missing-data labels were added; the test was scoped to its dialog. A later mobile copy-week timing failure occurred during live edits; the unchanged repeat passed all 64.
- `browser-final-workflow.log`: after the final adjustment-return improvement, all 10 new workflow browser checks passed again. The coach returns to the original result after saving an upcoming adjustment, with a separate success notice and review acknowledgement still explicit.
- `build-final.log`: final production build passed. Existing React 18/Next middleware and Sentry deprecation warnings remain; this release does not upgrade those dependencies.
- `review-desktop-chromium.png` and `review-mobile-chromium.png`: synthetic review screenshots; desktop and phone presentation inspected during verification.
- `change-manifest.json`: SHA-256 hashes of the 16 implementation/test/preflight files. Scoped Git whitespace checks passed. Next's development server also generated `webapp/AGENTS.md`; its local routing/API documentation guidance was read.

Tests use fictional browser fixtures and disposable local PostgreSQL, not participant accounts. Browser tests verify desktop and emulated phone layouts; they do not replace a physical-phone or real-device test. No subscriber demand, measured time savings, provider delivery, or mailbox acceptance is inferred.

## Release procedure and remaining gates

1. Review the focused code and migration against the intended current release branch. This checkout began on `codex/m0-reliability-billing-persistence` at `a8117d1`, with unrelated existing changes; do not publish the entire dirty checkout or treat its older base as the production branch.
2. Reconcile current migration history and confirm all prerequisite calendar/library/message schema exists. Do not replay historical migrations, including the separately recorded security and owner-review migrations.
3. After explicit production authorization, apply only the reviewed new migration, run the read-only catalog check, then deploy the matching application revision. Without the migration, new actions return an unavailable state; they do not fall back to insecure or simulated persistence.
4. Verify normal coach/athlete access, a five-athlete week publication, request/reply/no-change behavior, and the next-session adjustment in the authorized environment. Check logs for repeated 403/409/503 responses and incomplete publications; do not log private message bodies.
5. Complete the real one-coach/up-to-five-athlete pilot, physical-phone and communication checks. Record observed planning/review time separately from automated task success.

If a release must be rolled back, restore the previous application revision and retain the additive tables and receipts. Do not drop participant history or replay confirmed operations. Review schema rollback separately if it is ever needed.

The first release remains one-week planning and assigned-workout review. Multi-week plans, broad analytics corrections/backfills, device integrations, public pricing, AI, and race preparation were not added. Strava/COROS/Suunto remain in progress; Garmin remains next. Browser-local drafts do not promise cross-device draft synchronization.
