# Feedback review workflow

## Investigation and implementation plan — October 27, 2026

- Isolated branch `codex/feedback-review-workflow` starts at fetched main `f004a11` and was rebased onto `241b047` after PR #151 merged externally. Original dirty checkout and PR #151 checkout are untouched.
- Reuse `SiteReview`, `/api/site-review`, `site_reviewers`, and `site_review_notes`; no parallel site-feedback tracker. Existing admin/coach tools serve different purposes.
- Keep revocation-checked signed athlete sessions and service-only database access. Explicit contributor/owner roles grant no general admin access. Membership and owner promotion are separate, specifically approved rollout operations.
- Extend notes with pending review → approved → in progress → awaiting acceptance → completed, immutable event history, submitter attribution, approval/acceptance actors and times, atomic retry-safe writes, and stale-update conflicts.
- Extend the existing panel with polling, filters, history, updates, and owner-only transitions. Contributors see only their own tasks. Reopening requires fresh approval.
- Verify API boundaries, real local PostgreSQL functions, and desktop/mobile browser workflows. Prepare draft PR and rollout instructions; no deployment or hosted migrations.

## Corrected identity and access gate

The user corrected the target to **bethschweizer@gmail.com**. Read-only exact-address inspection found one linked authenticated identity and athlete record; no reviewer membership exists. Both auth email confirmation and athlete email verification are currently unset. The rollout script requires a confirmed auth email and exact linked athlete identity, so it stops until normal account verification is complete. No alternative address receives access. No live records or permissions were changed.

The existing Tad reviewer is identified in `REVIEW_MODE_RELEASE_2026-10-16.md`. Administrator status alone does not grant feedback access or approval authority. The schema defaults existing memberships to contributor; promoting the verified existing Tad membership to owner is a separately approved rollout step, not an automatic migration side effect.

## Implementation

`site_review_notes` remains the task record. `site_review_events` records each submission/update/transition atomically with actor, timestamp, message and status. Original descriptions stay intact. Legacy open notes become pending review; legacy resolved notes retain completed status with an explicit history entry that prior approval evidence is unavailable. Approval timestamps are not fabricated.

Only the service role can read these tables or execute the invoker RPC. The API checks current signed sessions and membership, restricts contributor reads to their own athlete ID, and derives the write actor from the session. The RPC independently checks membership, ownership and transitions, serializes changes per task, requires expected versions, and records history atomically. Request UUIDs prevent duplicate submissions/updates after lost responses. Public/authenticated database roles cannot bypass the API.

The panel refreshes every 10 seconds while open and visible and on window focus. It preserves text during polling/errors, shows refresh errors, supports manual refresh, and filters stage and (owner only) submitter. It shows up to 1,000 recent tasks with an explicit limit notice. Contributors add updates but cannot change status. Tad approves, starts work, requests acceptance, and explicitly accepts completion. Nothing starts coding, sends notifications, or completes tasks automatically.

## Rollout — review only, not executed

1. Review the draft PR. Obtain separate authorization for deployment, migration and the narrow membership changes. None are authorized by this implementation task.
2. Beth completes normal email verification for **bethschweizer@gmail.com**. Recheck exact `auth.users.email`, confirmation and `athletes.supabase_user_id` linkage. Do not create accounts, mark verification manually, substitute an address or grant admin access.
3. Inspect hosted migration history. The base migration was applied as `20261016195758_private_site_review`; do not replay local `20261016195233_private_site_review` or run a broad database push.
4. Test `20261027190238_feedback_review_workflow.sql` and provisioning on isolated staging. Back up existing review records before an approved rollout. The migration adds no memberships or owner permissions.
5. Coordinate schema/application cutover: old clients' open/resolved writes become incompatible and are rejected. Only after specific approval, review and execute `webapp/scripts/feedback-review-access.sql`. It promotes the verified existing Tad membership and inserts Beth as contributor; the transaction stops if either exact verified identity is missing or ambiguous. No `is_admin` or account fields are changed.
6. After authorized deployment, use signed read-only checks to verify Tad sees all, Beth sees only hers, unrelated users are denied and history persists. Participant submissions then establish live acceptance; never seed fictitious production records.
7. Roll back through a compatible API/UI change, preserving task/history data. Do not destructively reverse the schema. Membership removal/demotion requires an authorized operational action.

## Local evidence

- Full regression: 514 passed on the rebased tree (Node 24.14.0); focused suite: 12 passed, including reopening and atomic rollback after history insertion failure.
- Integration availability: 4 passed.
- Desktop/mobile Chromium: 6 passed, covering lost submission/update response retries, initial loading/errors, stages, explicit acceptance, history/export, polling, preserved updates, load errors/recovery, draft retention, access denial, axe accessibility and viewport fit. Screenshots are in local `output/playwright/`.
- PostgreSQL tests use local PGlite with synthetic local IDs. Browser API fixtures are simulations, not production acceptance.
- Production build: `npm run build -- --webpack` passed (existing Sentry/React/middleware warnings). Default Turbopack startup/build stalled in this environment; the repository already uses webpack for isolated browser verification.
- Official Supabase function/security documentation checked through docs search. Changelog markdown retrieval was unavailable; no dependency/API-version change was made.

Draft PR: [#152](https://github.com/tadschweizer/Ultra_OS/pull/152). Implementation: 68b85f1; rebased-tree verification record: 6882ec1. All checks above passed locally against main 241b047 plus this feature. GitHub CI is separate and may still be pending. No merge or production action.
