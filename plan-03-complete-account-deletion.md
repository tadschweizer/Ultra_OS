# Plan 03 — Make account deletion actually delete everything

**Priority: 3 of 10. Required before external users (GDPR/privacy expectation already noted in NEXT_STEPS_AND_UX_REVIEW.md).**

> **Status: IMPLEMENTED in this PR.** Notable discoveries during implementation:
> - The old endpoint used the ANON Supabase client, so under RLS hardening its deletes were likely silent no-ops — it now uses the service-role admin client.
> - Nearly every athlete table already cascades (including `coach_profiles` and all coach-owned rows through it), so the explicit work is: Stripe cancel+delete, NULLing `invites.created_by/used_by` (no ON DELETE clause — would block the row deletion), deleting SET-NULL orphans (`attachments`, `coros_activities`, `integration_interest`, prod-only `activities`), then the athletes row, then the Supabase auth user.
> - Stripe/auth cleanup are best-effort and reported in the response (`stripe_cleanup`, `auth_cleanup`); data deletion never silently depends on them.

## Goal

`webapp/pages/api/delete-account.js` deletes from only 6 tables (`interventions`, `workout_check_ins`, `athlete_settings`, `races`, `race_outcomes`, `invites`). The schema now has many more athlete-owned tables, plus a Supabase auth user (`supabase_user_id`) and a Stripe customer/subscription — none of which are cleaned up. A "deleted" athlete today still exists in Supabase Auth, keeps getting billed by Stripe, and leaves data in a dozen tables.

## Files to touch (exact)

1. `webapp/pages/api/delete-account.js` — the whole change lives here
2. `webapp/supabase/schema.sql` + `webapp/supabase/migrations/*.sql` — read-only reference to enumerate tables
3. `webapp/lib/stripeServer.js` — read to find the existing Stripe client helper; reuse it
4. `webapp/tests/` — add `tests/delete-account.test.mjs`
5. New migration `webapp/supabase/migrations/<timestamp>_delete_account_cascades.sql` (optional hardening, step 6)

## Steps in order

1. Enumerate every table with an `athlete_id` (or equivalent) column. From the migrations, at minimum:
   - Direct `athlete_id` FK with `ON DELETE CASCADE` already: `planned_workouts`, `calendar_notes`, `workout_comments`, `coach_notifications`, `trainingpeaks_import_jobs`, `coach_athlete_relationships` (verify each in the migration files — grep `REFERENCES public.athletes` and note the `ON DELETE` clause).
   - Tables to check for missing/SET NULL behavior: `attachments` (`owner_athlete_id ... ON DELETE SET NULL` — rows survive as orphans), `coach_profiles` (`athlete_id`), `assigned_protocols`, `coach_invitations`, `coach_notes`, `protocol_templates` / `training_plans` / `training_plan_workouts` / `workout_library` (owned via `coach_id → coach_profiles`), plus older tables: `athlete_settings`, `athlete_supplements`, `race_events`, `integration_interest`, `messages`/`message_center` tables from `20260501110000_add_coach_groups_and_messages.sql`, group membership tables, `research_library` drafts if athlete-authored.
   Write the definitive list by grepping: `grep -n "athlete_id\|owner_athlete_id\|coach_id" webapp/supabase/schema.sql webapp/supabase/migrations/*.sql | grep -i "references\|uuid"`.
2. Rewrite the handler in this order:
   a. Auth via the shared guard (`requireAthleteId` from plan-02; if plan-02 isn't merged yet, use `getAthleteIdFromRequest`).
   b. Load the athlete row first (`select id, supabase_user_id, stripe_customer_id, email` — check actual column name for the Stripe id by grepping `stripe` in migrations and `lib/stripeServer.js`).
   c. **Stripe first**: if there's a Stripe customer id, cancel active subscriptions (`stripe.subscriptions.list({ customer })` then `stripe.subscriptions.cancel(id)`) and then `stripe.customers.del(customer)`. Wrap in try/catch: log failures and continue with deletion, but include `stripe_cleanup: 'failed'` in the response so it's visible.
   d. Delete rows from tables WITHOUT cascade, in dependency order (children before parents). For coach-owned data: if the athlete has a `coach_profiles` row, delete that profile's dependent rows (`training_plan_workouts` via `training_plans`, `workout_library`, `protocol_templates`, `coach_notes`, `coach_invitations`, `assigned_protocols`, `coach_athlete_relationships` as coach) before deleting the profile.
   e. Delete `attachments` where `owner_athlete_id = athleteId` (and their storage objects if `storage_path` points at Supabase Storage — check whether a storage bucket is actually used; if not, skip storage).
   f. Delete the `athletes` row (cascades take out the FK-cascade tables).
   g. **Supabase auth user**: `await admin.auth.admin.deleteUser(supabase_user_id)` if `supabase_user_id` is set. Use `getSupabaseAdminClient()` from `lib/authServer.js`.
   h. Clear the cookie with `clearAthleteCookie(res)`.
3. Keep the existing confirmation contract: body `{ confirm: 'DELETE MY ACCOUNT' }`, method `DELETE` — the settings page (`pages/settings.js` ~line 304) depends on both.
4. Keep the "relation does not exist" tolerance for optional tables (existing behavior, line 43), because prod and local schemas can drift.
5. Add `tests/delete-account.test.mjs` (node:test style like the others): unit-test the table list export. To make it testable, export the table list as a named constant `DELETION_TABLES` from the handler file and assert it contains every table found by a grep of the migrations fixture list you hardcode in the test. Also test the confirmation-text rejection path by invoking the handler with a mock `req`/`res` (follow the mock pattern in `tests/auth-regression.test.mjs`).
6. Optional hardening migration: change `attachments.owner_athlete_id` to `ON DELETE CASCADE` and add cascades for any athlete-FK found without one, so the DB backstops the API. Only include tables you verified in step 1.

## Edge cases a weaker model would miss

- **The order matters**: Stripe cancel before row deletion (you need the customer id from the row); auth-user deletion after the athletes row (the athletes row lookup needs to happen while it exists, and `supabase_user_id` must be captured before deleting).
- An athlete who is ALSO a coach: deleting them must not delete their athletes' data — only relationship rows, notes, and templates the coach authored. Never `delete().eq('athlete_id', ...)` on tables where `athlete_id` means "the other party" (e.g. `coach_athlete_relationships` needs deletion by BOTH `athlete_id = X` OR `coach_id = <their coach_profile id>`).
- `messages`/group tables may reference the athlete as sender OR recipient — delete both directions.
- `invites` table: current code deletes `eq('athlete_id')` but the invites schema in MULTIUSER_ROADMAP has no `athlete_id` column — check the real migration (`20260329090000_add_invite_system.sql`) and delete by `email` if that's the actual link.
- Don't fail the whole request if Stripe or auth-user cleanup errors — the user's data deletion should still complete; report partial failure in the response and `console.error` it.
- `workout_check_ins` may be a legacy table that no longer exists — the "does not exist" tolerance covers it; don't remove it from the list without checking prod.
- Re-running deletion for an already-deleted athlete should return 401 (cookie no longer maps to a row), not 500.

## Acceptance criteria

1. `node --test tests/delete-account.test.mjs` passes.
2. Manual e2e on a throwaway account: create account → log interventions, a planned workout, a calendar note → delete account in Settings → (a) redirected/logged out, (b) in Supabase table editor, zero rows remain in ANY table for that athlete id (spot-check `athletes`, `interventions`, `planned_workouts`, `calendar_notes`, `coach_athlete_relationships`), (c) the user is gone from Supabase Auth → Users, (d) if a Stripe test subscription existed, it shows `canceled` in the Stripe test dashboard.
3. Deleting an account that never had Stripe/coach data still succeeds (no crash on missing customer id / missing coach profile).
4. `npm run test:auth:full` still passes.

## Out of scope

- Data export before deletion (roadmap Phase 4 item 13 — separate feature).
- Soft-delete/grace-period semantics.
