# Plan 09 — Coach follow-up workflow for unmapped import items

**Priority: 9 of 10. Third ❌ row in the TrainingPeaks parity matrix ("Coach-athlete follow-up workflows … tied to missing mapping rows"). Do AFTER plan-05, which builds the import-health data path this reuses.**

## Goal

When an import finishes with `needs_manual_mapping_count > 0`, the coach should get a notification and a one-click follow-up: send the athlete a pre-filled message asking them to finish mapping, and track that the follow-up happened. Reuses three existing systems: `coach_notifications` table, the message center (`pages/api/coach/messages.js`, `components/MessageCenter.js`), and the import-health card from plan-05.

## Files to touch (exact)

1. `webapp/pages/api/coach/dashboard.js` (or wherever plan-05 put the rollup) — no schema change; identify athletes with `needsManualMappingCount > 0`
2. `webapp/pages/api/coach/import-followup.js` (new) — POST: creates the notification + message
3. `webapp/pages/coach-command-center.js` — "Follow up" button on import-health rows that need mapping
4. `webapp/pages/api/coach/messages.js` — read-only reference for the message insert shape (table name, columns, sender semantics); reuse its insert logic by extracting a helper if it's inline
5. `webapp/supabase/migrations/<timestamp>_import_followup_tracking.sql` (new) — add `followup_sent_at timestamptz` and `followup_message_id uuid` to `trainingpeaks_import_jobs`
6. `webapp/tests/coach-import-health.test.mjs` — extend with followup-eligibility logic tests

## Steps in order

1. Read `pages/api/coach/messages.js` end-to-end: note the exact table and columns used for coach→athlete messages and any read-receipt convention. Read `components/MessageCenter.js` enough to know how a new message surfaces to the athlete.
2. Migration: `ALTER TABLE public.trainingpeaks_import_jobs ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz, ADD COLUMN IF NOT EXISTS followup_message_id uuid;` (nullable, no backfill needed).
3. Build `POST /api/coach/import-followup` with body `{ jobId }`:
   a. Auth via shared guard; resolve coach profile.
   b. Load the job; verify `job.athlete_id` is in the coach's ACTIVE roster (`coach_athlete_relationships`) — 403 otherwise.
   c. Reject if `needs_manual_mapping_count === 0` (400) or `followup_sent_at` already set (409 with a friendly message).
   d. Insert the coach→athlete message using the message-center insert pattern, body template: "Your TrainingPeaks import has N workouts that need manual mapping. Open Connections → Migration status to finish them so your calendar and reports are complete." Include the athlete-facing route (confirm the actual path by checking `pages/connections.js` for the migration completeness section).
   e. Insert a `coach_notifications` row (`notification_type: 'import_followup_sent'`, `entity_type: 'trainingpeaks_import_job'`, `entity_id: jobId`) so the action is auditable.
   f. Update the job row with `followup_sent_at = now()` and `followup_message_id`.
4. UI: on the import-health card rows where `needsManualMappingCount > 0`, show "Send follow-up" (or "Followed up 3d ago ✓" when `followup_sent_at` set — plan-05's API must include these two new columns in its payload; add them). Button calls the endpoint, optimistically flips to the sent state, shows the API error message on failure.
5. Tests: pure eligibility function `canSendFollowup(job)` (needs mapping > 0, no prior followup, status completed) extracted into `lib/importHealth.js` and unit-tested for each rejection reason.
6. Run `npm run test:auth:full`, `node --test tests/coach-import-health.test.mjs`, `npm run build`.

## Edge cases a weaker model would miss

- **Idempotency**: double-clicking the button must not send two messages — the 409 guard on `followup_sent_at` plus disabling the button on first click. The DB update and message insert aren't transactional through supabase-js; write `followup_sent_at` optimistically BEFORE inserting the message is wrong (message may fail) — instead insert the message first, then update the job; if the update fails after message insert, log it and still return success (worst case: a duplicate is possible only if the update failed, which is rare and visible in logs).
- A re-import creates a NEW job row with null `followup_sent_at` — that's correct behavior (new mapping gaps deserve a new follow-up), but the UI must show the state of the LATEST job only (plan-05 already reduces to latest).
- Athlete self-imports have `coach_id = null` on the job — the roster check (step 3b) is what authorizes, not the job's `coach_id`. Don't filter by `job.coach_id === coachProfile.id`.
- The message must appear in the ATHLETE's message center — verify sender/recipient column semantics from the real messages table (grep the migration `20260501110000_add_coach_groups_and_messages.sql`); getting sender_role backwards makes the coach message themselves.
- If the messages system requires an existing conversation/thread row, create-or-find it the same way `coach/messages.js` does — don't insert a dangling message.
- RLS: the new columns are on a table athletes can read (their own jobs) — `followup_message_id` leaking to the athlete is harmless; no policy change needed, but confirm `trainingpeaks_import_jobs` RLS doesn't grant athletes UPDATE (they shouldn't be able to fake `followup_sent_at`). Check the policy block in `20260617120000_trainingpeaks_parity_foundation.sql`.

## Acceptance criteria

1. Coach clicks "Send follow-up" on an athlete with 7 unmapped items → athlete's message center shows the templated message; the button becomes "Followed up just now ✓"; a `coach_notifications` row exists.
2. Clicking again (or replaying the POST) returns 409 and no duplicate message.
3. A coach cannot trigger a follow-up for a job belonging to a non-roster athlete (403).
4. A job with 0 unmapped items shows no button.
5. All test scripts pass; `npm run build` succeeds.
6. Update `README-PLATFORM.md`: "Coach-athlete follow-up workflows" ❌ → ✅, and "Import issue prompts" 🟡 note updated.

## Out of scope

- Email/push delivery of the follow-up (in-app message only; notifications infra is a separate track).
- Automating follow-ups on a schedule.
