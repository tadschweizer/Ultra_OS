# Feedback repair — October 27, 2026

## Verified production diagnosis

PR #152 was merged by an external action at 19:25:11 UTC as `cb7b52f2e7f240fe2bdf84c9ec03d7be71441e39`. GitHub production deployment 7368255570 completed successfully. A read-only Vercel alias query confirmed `www.mythreshold.co` points to `dpl_HtDgYZV82JUAGrDVqGq6zehfAv1X` / `ultra-os-tb77-okdogh2i1-tadschweizers-projects.vercel.app`.

Read-only Supabase catalog inspection found `site_reviewers` still has only `athlete_id`; the new `role` column is absent. The deployed API selects `athlete_id, role`, catches the missing-column failure as 503, and the frontend hides the launcher for a failed access response. Tad's exact authenticated login is still joined to an existing reviewer membership. This is a schema/application mismatch, not a removed membership. The failing path is reproduced against the actual legacy schema in local PostgreSQL tests; no authenticated production request was forged or production data written.

A separate read-only aggregate found 21 open and one resolved note for Tad. The previous user-facing list is the shared Leave feedback panel, Show → Resolved notes. It has creation/context and a manually set open/resolved status, not historical approval evidence. There is no separate completed-feedback route. Once access is restored, the account can open that panel from `/account` or any page; the new completed-task history remains contingent on the reviewed migration.

## Separate repairs

1. **QA P2, uncertain submit:** retain the exact initial payload and UUID after an unknown save outcome; disable editing/discard until replay confirms it. The user can close/reopen the panel without losing the pending request. After confirmation, additional detail is added to the same task as an update. No replacement UUID/task is generated. The browser fixture now rejects changed replays with 409, matching the real RPC.
2. **Existing-feedback compatibility:** only a missing `role` column (PostgreSQL 42703 or matching PostgREST PGRST204) enables legacy mode. Membership is rechecked using the original column; notes remain filtered by the real signed actor. Existing note submit/resolve/reopen/export work with the old schema. New approval roles, task updates/history and cross-reviewer reads remain unavailable. Other failures stay closed. This requires no migration or live access grant.

These are separate commits on a follow-up review branch. PR #152 is already merged and cannot receive an updated draft review. No merge, deployment, remote migration, permissions change, verification reset or email was performed by this repair task. The disputed takeover message was not used as sole authorization for any action.

## Local verification

- Full regression: 515 passed; focused API/PostgreSQL suite: 13 passed.
- Desktop/mobile Chromium: 10 passed, including repeated lost-save replies with locked edits/discard, exact replay, same-task follow-up updates, and old-schema reviewer controls.
- Production webpack build: passed. Final focused desktop/mobile repair checks: four passed, including uncertain legacy status replies.
- Synthetic local fixtures only. Hosted acceptance still needs a separately authorized release and participant verification.

## Rollout boundaries

This compatibility repair can preserve the original owner's feedback without granting Beth access. Beth's requested account is exactly `bethschweizer@gmail.com`; read-only queries found a linked identity but null `auth.users.email_confirmed_at` and `athletes.email_verified_at`, and no reviewer membership. Supported user action: sign in, open Account → How You Sign In → Resend confirmation email, then follow the email link. No delivery was tested or email sent here. The application callback synchronizes verification after Supabase confirms the address.

Any release of these repairs requires explicit production authorization. Enabling the new workflow still requires separate migration and exact-identity membership approvals, following FEEDBACK_WORKFLOW.md. Do not apply that migration as an emergency shortcut to restore the existing button.
