# P0-015: notification delivery, saved drafts and unread counts

Date: October 7, 2026. Branch: `feature/p0-messaging-delivery`.
Base: PR #130 merged on remote main as `4f2038f`.

## Delivered behavior

- Direct coach/athlete messages and session comments create private in-app
  notifications for the recipient in the same database transaction. A delivery
  failure rolls back the save; direct-message retries retain their UUID and create
  one message and one delivery record. No new external delivery service is needed.
- Delivery records explicitly distinguish `delivered` from `suppressed` and retain
  read timestamps. Preferences apply to future deliveries; re-enabling a preference
  does not flood the feed with previously suppressed replies. Muting notifications
  does not hide messages or alter their unread counts.
- Coach and athlete feeds refresh on focus/reconnect and every 15 seconds while
  visible. They paginate with timestamp/UUID cursors, link to the actual conversation,
  and acknowledge only the displayed IDs. Marking an alert read does not claim that
  its source message was read. Reading a source message/comment updates its alert.
- Both message views use one service-only SQL summary. Direct conversations and
  every session thread aggregate all historical unread rows, independent of
  PostgREST's row cap or preview limits. Only the newest message/comment is returned
  per conversation/thread. Successful direct acknowledgements return fresh counts.
- Session preview navigation does not acknowledge unseen comments. The calendar
  acknowledges only fetched comment IDs, in batches of at most 100. Hidden pages
  do not clear unread state. Failed refreshes show an unavailable count with retry.
- Direct-message drafts persist immediately on this browser/device, including
  their purpose and retry identity, across navigation, reload and sign-out. Keys
  include the authenticated account, role, coach and athlete. Replacement coaches
  and different accounts cannot accidentally restore another conversation's draft.
- Successful sends clear only the sent draft. A newer draft saved by another tab
  is not removed by an older completed request. Discard is explicit. Storage failures
  retain the mounted draft and show that it could not be saved on the device.
  Drafts expire after 30 days when next read. Clearing browser storage removes them;
  cross-device draft synchronization is outside this batch.
- Existing coach alert history is preserved, with old message/comment previews
  redacted. Other legacy coach-alert writers forward into the new feed and honor
  preferences. Obsolete direct/comment notification side effects are ignored to
  prevent duplicates during migration-first rollout.

## Database and authorization

Exact new migration: `webapp/supabase/migrations/20261007200545_messaging_delivery.sql`.
Created through `supabase migration new messaging_delivery --workdir webapp`.

It narrowly creates `coach_messages` if absent, adds `athletes.notification_preferences`
if absent, creates `account_notifications`, installs transactional delivery/read/delete
triggers and the summary/feed/preference RPCs, and adds history/unread indexes.
It does not replay the older coach groups or shared-document migration.

New tables have RLS enabled and no public-client access. Functions are security invoker,
use an empty search path and are callable only by the service role. Routes resolve
the signed, revocable session before supplying the actor, and recheck ownership or an
active coaching relationship before reads/writes. A direct insert also locks and
checks its active relationship, serializing it with relationship revocation.
Preference patches use one SQL UPDATE so separate setting changes cannot replace
each other's entire JSON value. APIs use private/no-store responses and generic errors.

Read-only production preflight on confirmed project `jzfctjaaowdvubhqswpa` found:

- `coach_messages` and `athletes.notification_preferences` are absent.
- The existing notification/comment/relationship tables and required columns exist.
- The new feed/table/functions have not been applied.
- Neither `20261007162647` (PR #130) nor `20261007200545` is recorded in migration history.
  PR #130's merge does not establish that its database release was completed.

Reusable read-only preflight: `webapp/scripts/messaging-schema-preflight.sql`.
No production database, application deployment or service configuration was changed.

## Local verification

Node.js 22 is required. Run from `Ultra_OS/webapp/`:

```powershell
npm run test:auth:full
npm run test:e2e:critical
npm run test:e2e:messages
node node_modules/@playwright/test/cli.js test e2e/messaging-delivery.spec.mjs e2e/messaging-critical.spec.mjs e2e/daily-loop.spec.mjs --workers=1
npm run build
```

Results:

- Full Node 22 regression: **416/416 passed** (`output/p0-messaging-regression.log`).
- Critical desktop/390 px browser checkpoint: **115 passed / 3 intentional viewport
  skips** (`output/p0-messaging-critical.log`).
- Expanded daily-loop/messaging checkpoint: **46/46 passed**, including loaded-only
  session acknowledgements (`output/p0-messaging-final-browser.log`).
- Final messaging rerun after the cross-tab preservation refinement: **22/22 passed**
  (`output/p0-messaging-final-drafts.log`). Together these cover 26 daily-loop and
  22 messaging journeys on desktop and mobile; the overlapping messaging cases are
  not additional unique coverage.
- Isolated PostgreSQL/signed-handler suite: **13/13 passed** inside the full regression.
- Production build and `git diff --check`: **passed**. The Windows sandbox blocked
  Turbopack junction creation; the same Node 22 build passed outside the sandbox
  (`output/p0-messaging-build.log`).

Browser routes use isolated mock stores to test the actual UI. Database cases use real isolated PostgreSQL (PGlite)
with a PostgREST-shaped adapter and signed sessions; they are not hosted acceptance.

The database suite covers both delivery directions; replay/mismatched retries;
transaction rollback on delivery failure; actual anonymous denial and service-role
trigger execution; atomic preferences; future-only suppression; legacy forwarding;
1,105 history rows and 135 old session comments; cursor ties; replies arriving after
load; owner-scoped/idempotent alert acknowledgements; relationship revocation;
direct inserts bypassing a route; source deletion cleanup; revoked sessions; and
draft isolation/expiry/storage failures.

## Release and remaining acceptance

1. Review the PR and green checks. Confirm the intended production project and
   inspect the read-only preflight again. Investigate any unexpected existing
   notification table/function rather than overwriting it.
2. Apply only this exact migration after explicit owner authorization, using the
   repository's narrow migration process. Do not use a broad `supabase db push`.
   Resolve PR #130's independently outstanding migration/release in its own scope.
3. Verify remote grants/RLS/functions, expose the schema through PostgREST, then
   deploy the reviewed application commit after explicit owner authorization.
4. Verify controlled coach/athlete delivery, reload/reconnect, preferences, accurate
   unread state and revocation through hosted PostgREST and on a physical phone.

P0-015 stays open until release and controlled live/phone acceptance pass. Independent
database connections and hosted PostgREST were not exercised by the PGlite suite.
Email/push delivery, cloud draft synchronization and a session-comment history/retry
redesign remain outside this batch. No paid staging resource was created.
