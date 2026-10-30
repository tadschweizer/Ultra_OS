# Uploaded workout review queue

Updated October 30, 2026. Local implementation; production migration and release are not authorized or performed.

## Problem and behavior

The existing review queue and dashboard counts read assigned plans only. An uploaded workout with no confirmed plan link never appears, even though the coach can read its recording in the calendar. The original SQL fixture reproduces this exclusion.

The queue now includes every retained uploaded activity from an active linked athlete, across all sports and persisted providers, alongside completed assigned workouts and explicit response requests. There is no new date cutoff; older retained uploads are a paginated backlog. Future plans alone are not uploaded activities. A completed visible plan assigned by this coach owns its matched upload's review, preventing a duplicate row. A private or other coach's plan cannot conceal a recording the current coach may already read.

Uploaded rows open the existing activity details using the recording ID, preserve the local calendar date, show summary values with the coach's distance preference, and require **Reviewed — no change** to acknowledge. Opening a workout or message never completes review. Undated uploads remain in the queue with an explicit unavailable date and summary, without a broken calendar link. Existing assigned-plan request/reply behavior is retained. Upload discussion remains in the existing workout detail comments; this change sends no message.

Review state belongs to the activity and reviewing coach, separately from training records. Actual persisted summary changes reopen review. Routine import timestamps and raw provider-payload metadata do not. This covers persisted summaries, not remote stream changes that the application does not retain. Identical retries do not rewrite acknowledgement timestamps. Conflicts require a fresh snapshot. Relationship access and coach entitlement are checked on each write, including retries; removed/expired relationships cannot use stale access. Dashboard counts use the same queue source. Pages contain at most 50 rows, with deterministic date/type/ID ordering and one lookahead row.

## Verification

Node 22.23.4 on the owner's desktop, isolated checkout from main 72a2f63. Synthetic PGlite and intercepted local browser records only.

- Original unassigned-upload expectation failed before implementation; no production participant data was needed.
- 537 authentication/critical regression checks passed, including six new signed-handler/PostgreSQL contracts. Twelve focused upload/weekly SQL contracts passed. Coverage includes non-run upload, local date, counts, reload persistence, no source mutation, no-op resync, changed/stale summaries, duplicate matched records, private plans, independent coaches, revoked/expired relationships, unrelated athletes, deterministic pagination, undated rows, public role denial and malformed requests.
- 18 desktop/mobile browser checks passed across upload and existing weekly workflows. After the final link-contrast correction, all eight upload acceptance cases passed again, including scoped Axe accessibility checks, phone width, correct activity links, explicit review/reload, failed write retry identity, stale review refresh and acknowledged-write/read-failure recovery.
- Webpack production build and four integration availability checks pass. Desktop/mobile screenshots inspected; detector and whitespace checks pass. Initial browser-label mismatch was a test expectation error (existing activity dialog is named Workout details); corrected without weakening the link/open/no-write assertion. A default-port run was discarded because the desktop already had an unrelated local server; accepted runs require a fresh isolated port and reuseExistingServer=false.

Commands from `webapp/` using the repository's Node runtime:

```powershell
npm run test:auth:full
node --test tests/uploaded-workout-reviews.test.mjs tests/weekly-workflow.test.mjs
npm run test:integrations
npm run build -- --webpack
```

Browser runs use repository-derived Playwright settings with a dedicated local server on 127.0.0.1:3173, reuseExistingServer=false, and both desktop Chromium and 390-pixel mobile Chromium. The temporary configuration and logs/screenshots remain local. Final new-suite command: `playwright test e2e/uploaded-workout-reviews.spec.mjs --config .test-config/uploaded-reviews.config.mjs --workers=1`. Full CI includes the checked-in new suite through test:e2e:critical.

## Required release gate

Independent review of the initial draft identified a distinction in the existing workflow: **Reviewed — no change** acknowledges a completed result while deliberately retaining an unanswered response request. The shared queue now exposes needs_review separately from request_open, and counts use that explicit flag. A new signed-handler/PostgreSQL regression proves pending_reviews becomes zero while response_requests remains one. All 537 regression checks pass after the correction; fresh exact-head hosted review and CI are required, rather than reusing the earlier head's result.

Prepare a draft PR and obtain independent review and passing exact-head hosted checks. The new migration **20261030150537_uploaded_workout_reviews.sql** requires separate explicit owner approval before hosted application and release. Earlier approval of the calendar movement migration does not cover this one. No production database change, merge or deployment is part of this local result.

The migration adds one RLS-protected review table and server-only invoker functions, replacing queue/count definitions to share the same pending-review source. It does not alter uploaded activities, plans, memberships or historical review rows. Browser roles have no table or function access. Service execution is restricted to the existing authenticated API workflow; the table denies service-role DELETE/TRUNCATE. No browser health-data storage is added.

Before any authorized application, inspect current hosted migration history/schema and exact reviewed SQL. Historical local/hosted timestamps differ: FEEDBACK_HISTORY_PERMISSIONS.md documents the older mappings, and calendar movement hosted 20261029155440 corresponds to local 20261029150644. Never replay historical migrations or use a broad database push. Apply only this reviewed migration after specific approval. Verify catalog grants/function definitions and the normal deployment's exact commit, then inspect live behavior without creating fake records or changing genuine workouts for tests. The owner performs the genuine final acceptance. If rolling back application code, retain review records; do not erase training or acknowledgement history.

## Separate work

The owner's analysis implementation remains local-only in its existing checkout, awaiting local review and separate migration/release authorization. This change neither copies that mixed checkout nor claims its analysis features are deployed. Earlier phone, participant, mailbox/provider and final owner acceptance gates remain open.
