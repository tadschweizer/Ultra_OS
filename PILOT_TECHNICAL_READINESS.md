# Pilot technical readiness without participant feedback

Prepared October 9, 2026. Review: PR #133. This package prepares the system to
work before usability observation. It does not claim production repair or pilot acceptance.

## What can be completed independently

- Repair schema/API mismatches in an isolated database and prepare an exact release.
- Run signed coach/athlete handlers against actual SQL: message persistence, drafts,
  retries, unread counts, shared documents, group membership and revoked access.
- Verify privacy, service-role grants, RLS, unique-link constraints and safe failures.
- Run desktop and 390 px mobile browser journeys, accessibility checks and the build.
- Verify deployed public routes, readiness and zero-row Data API contracts without
  changing participant records. Prepare provider/worker setup and post-release checks.
- Prepare the pilot measurement sheet and moderated first-session script. Real task
  times, phone comfort and repeat use need participants; preparation does not.

## Concrete changes

The read-only production inspection found missing `coach_messages`, `coach_shared_docs`
and `coach_group_members`; `coach_groups` exists but lacks `description`, which the
current handler selects. PR #130's match column/RPC and PR #131's lifecycle objects
are also missing. Database connectivity alone was being reported as readiness.

The new prerequisite migration creates only those three missing tables, adds the group
description field, and installs a document update trigger plus a service-only metadata
readiness function. It retains existing group IDs, names, colours and ordering. New
private tables have RLS and explicit service-only access. It does not recreate groups,
replay old policies, backfill messages, send notifications or alter participant roles.
Existing-object collisions stop the transaction for review.

`/api/ready` now checks both connectivity and required feature schema. Missing tables,
columns, functions, grants, RLS or the unique workout-link index produce 503 with status
and latency only. `/api/health` remains a liveness check. The metadata check does not
invoke the message worker or inspect participant rows. This is a focused pilot-schema
probe, not proof of every provider or every historical migration.

Athlete shared-document reads now validate session revocation and restrict results to
active coaches. Coach document failures return safe retry messages. Group membership
upserts use the actual group/athlete conflict key so retrying an add does not duplicate
or fail. Signed-handler/SQL tests cover persistence, isolation and revocation.

## Exact release package — owner authorized October 9

Target: existing UltraOS Supabase project **`jzfctjaaowdvubhqswpa`**.
Apply these sources in this order, individually, after reviewing current preflight:

| Order | Exact source in `webapp/supabase/migrations/` | Purpose |
| --- | --- | --- |
| 1 | `20261009201251_pilot_release_prerequisites.sql` | Missing message/document/membership dependencies, group description, metadata readiness |
| 2 | `20261007162647_workout_match_decisions.sql` | Merged PR #130: persistent workout-match decisions and unique activity links |
| 3 | `20261008231639_message_delivery_and_drafts.sql` | Merged PR #131: private drafts, preferences, email outbox and signed-handler RPCs |
| 4 | `20261009204246_message_foreign_key_indexes.sql` | Three additive indexes identified by post-release hosted advisors |
| 5 | `20261009204853_pilot_conflict_responses.sql` | Stable PT409 conflicts for stale drafts, altered message retries and workout matches |
| 6 | `20261009205343_pilot_notification_preferences.sql` | Missing legacy athlete preference column and expanded metadata readiness |

The dependency repair intentionally precedes the older timestamps. This is a targeted
history-drift release, not a chronological full-chain push. Do **not** apply the
unmerged alternative `20261007200545_messaging_delivery.sql`. Do not reapply the October
4 billing/Strava sources: their remote versions differ and their actual schema is ready.

The owner authorized applying this targeted package through the Supabase plugin and
releasing PR #133 on October 9. The three sources were applied successfully. Email remains off;
activating a real provider or protected POST scheduler is a separate reviewed action.

## Release steps

1. Open the UltraOS project in Supabase and confirm its project reference matches the
   target above. Codex can perform the remaining steps after your authorization;
   you do not need to paste credentials into this chat.
2. Run the read-only file `webapp/scripts/pilot-release-preflight.sql` in SQL Editor.
   Before this exact package, require `repair_allowed: true`, an empty
   `missing_base_columns` list and `duplicate_activity_links: 0`. Missing or partially
   present objects require a fresh review; never delete duplicates to make a check pass.
3. Apply only the three exact sources in the table, checking success after each.
   A partial failure stops release. Do not retry an already applied migration blindly.
4. Rerun the read-only preflight. Require `ready: true`. Run hosted security/performance
   advisors and resolve findings introduced by this release before application rollout.
5. Verify actual Supabase Data API access. From `webapp/`, with the intended target's
   server environment already loaded, run:

   ```powershell
   npm run verify:pilot-release
   ```

   If the server variables are stored in `webapp/.env.local`, Node 22 can load that
   existing file directly. In a terminal opened in `webapp/`, use:

   ```powershell
   node --env-file=.env.local scripts/verify-pilot-release.mjs
   ```

   The command makes authenticated **GET requests only**, requests zero rows from
   nine table surfaces (including the group's embedded membership relationship), and
   calls the stable metadata readiness function. It prints
   check names/status only and exits with code 1 if anything fails. Keep service keys
   in the server environment; never paste them into browser tools or chat. A successful
   SQL result without this API check does not establish PostgREST schema visibility.
6. Release the reviewed app after green checks and authorization. Verify `/api/health`
   and `/api/ready`; readiness must return 200 with both database and schema `ok`.
   Then use the existing approved QA pair, within `QA_ACCOUNTS.md`, for actual saved
   messages/drafts/read counts, shared documents, groups and workout corrections.
7. Complete phone, independent database-connection and consenting real-mailbox checks
   separately. The labelled QA pair uses `.test` email and cannot prove mailbox delivery.

Rollback: keep the additive tables and participant history. Roll back the application
if needed; stop any separately activated scheduler. Do not drop drafts, message history,
membership records or workout decisions to undo an application release.

## Verification and current limits

- Node 22 full regression **432/432**; integration **4/4**; production build passed;
  desktop/mobile critical browser **129 passed / 3 existing viewport skips**. Seven
  new isolated SQL/handler groups, two readiness contracts and three Data API verifier
  cases are included in the full regression. Final results are also in the roadmap.
- Real October 9 read-only preflight: `ready: false`, `repair_allowed: true`, no missing
  base columns and zero duplicate activity-link groups. No production schema changed.
- Actual GET-only hosted Data API verifier reports the expected missing features:
  schema, messages, documents, groups, memberships, preferences, drafts, outbox and
  workout-match column are down; existing workout comments pass. No rows were fetched.
- Combined isolated SQL applies the exact three sources, verifies readiness remains
  false between incomplete stages, then passes. Security regressions deliberately
  remove a grant/function/index or RLS and confirm readiness fails closed.
- Hosted independent-connection contention, real provider/mailbox delivery, actual
  phone interaction and participant observation remain separate evidence layers.
- GitHub rulesets return `[]`; classic branch-protection access is denied to the
  integration (403). Required Auth Smoke enforcement cannot be confirmed from that
  result. A repository administrator can inspect Settings → Rules → Rulesets, or
  Settings → Branches → protection for `main`, and require `auth-smoke`. No repository
  settings were changed. CI includes the new SQL/handler checks in the full suite.

## First-session measurement, after technical gates pass

Use `pilot-observation.csv` with anonymous participant codes. Record what happened,
not message contents, passwords, health notes or email addresses. No timings have
been invented in this package.

1. Coach: enter roster, invite/link the approved athlete, assign a workout and share
   a document. Record time, save failures and help needed.
2. Athlete: complete the fast check-in (target ≤30 seconds), view the workout and log
   completion (target ≤30 seconds excluding optional notes).
3. Both: exchange a normal message, confirm refresh within five seconds in an open
   conversation, save/reload a draft and verify counts in the inbox and floating centre.
4. Athlete: correct completion, move through Today/Calendar/Messages and return to the
   same calendar context. Repeat on a physical phone.
5. In permitted QA/isolated sessions, exercise failure/retry and relationship revocation.
   Do not alter ordinary participants' relationships or billing just to run a test.
6. Record seven normal check-in days and two weeks of actual usage. Compare representative
   planning tasks with TrainingPeaks before claiming comparable speed or parity.

Technical fixes can proceed without these observations. The observations establish
human usability and retention; they cannot be replaced by mocked browser timings.

## Authorized database release checkpoint — October 9, 20:42 UTC

Applied through the Supabase plugin to the confirmed healthy UltraOS project. Remote
migration versions differ from source timestamps; preserve this exact mapping.

| Source | Remote migration version |
| --- | --- |
| `20261009201251_pilot_release_prerequisites.sql` | `20261009204148` |
| `20261007162647_workout_match_decisions.sql` | `20261009204157` |
| `20261008231639_message_delivery_and_drafts.sql` | `20261009204211` |
| `20261009204246_message_foreign_key_indexes.sql` | `20261009204323` |
| `20261009204853_pilot_conflict_responses.sql` | `20261009205027` |
| `20261009205343_pilot_notification_preferences.sql` | `20261009205417` |

Fresh preflight now returns `ready: true`, `repair_allowed: false`, no missing base
columns and zero duplicate activity links. The actual hosted GET-only Data API check
passes all ten contracts, including readiness and embedded group membership.

Hosted security advisors add only six informational RLS-without-policy findings for
the new service-only tables. This is intentional: client grants are denied and signed
server handlers authorize access. See [RLS advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
Existing mutable-search-path/definer/Auth warnings were present before this package.
Performance advisors identified three uncovered new foreign keys; the fourth additive
source was applied and the three new foreign-key findings are cleared. New unused-index notices are expected until actual traffic uses them.
See [foreign-key advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

Auth Smoke passed for `fe93e96` (run 158). Application release and approved two-account
acceptance will be recorded after the final reviewed head passes CI and deploys.
Fresh-account signup/email verification require separate accounts; these manually
provisioned QA identities only cover post-enrollment journeys.

Final additive index source is included in the isolated release fixture; focused release
checks pass **21/21** after that change.

## Hosted conflict repair discovered during acceptance

Actual signed QA requests saved/reloaded a draft but a conflicting PUT timed out.
Supabase documents that application-raised `40001` triggers infinite PostgREST retries:
[Supabase conflict troubleshooting](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).
The fifth source replaces only the three existing function bodies, changing application
conflicts to `PT409`. Ownership checks, signatures, INVOKER mode, empty search paths
and service-only grants remain intact. Server handlers recognize the new code as HTTP
409 and retain the old transient-error mapping for compatibility. Historical sources
remain unchanged. Full regression now passes **432/432**, including actual SQL
assertions that all three final functions emit PT409 and preserve drafts on conflict.
The hosted readiness probe still passes after this additional owner-authorized repair.

## Hosted reply dependency repair and two-account evidence

Signed athlete replies returned safe 503. A rolled-back QA-only function diagnostic
identified missing `athletes.notification_preferences`; this legacy column was assumed
by the merged message function but absent remotely. The sixth source adds an empty
JSONB preference object and expands readiness to require it. The isolated release fixture
now starts without that column, applies the exact forward repair and verifies an
athlete reply creates its coach notification. Loss of the column fails readiness.

Approved browser-session API checks now pass: draft save/reload, retry deduplication,
matching draft removal on send, actual message persistence, athlete unread 1 then 0
after acknowledgment, athlete reply persistence, coach unread 1 and its corresponding
notification. Notification preferences return 200, email remains unavailable/off.
PT409 is prompt at the database/API layer; the old app maps it to 503 until the final
head rolls out. Final release must repeat conflict acceptance with actual HTTP 409.
The expanded GET-only verifier includes athlete preferences and all calendar-selected
workout columns, for eleven contracts in total.
