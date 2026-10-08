# P0-015 messaging lifecycle verification

Date: 2026-10-08. Base: main `4f2038f` (merged PR #130).
Branch: `feature/p0-015-messaging-lifecycle`.
Review: [draft PR #131](https://github.com/tadschweizer/Ultra_OS/pull/131), implementation `6cea21d`.

This completes the local implementation batch for durable drafts, all-history unread
aggregation and notification preferences/delivery. P0-015 remains unchecked until its
controlled release and physical-phone acceptance pass. No production configuration,
database writes, deployments or real message emails were performed.

## Delivered behavior

- Drafts persist on the server per signed owner, coach, athlete and sender role. Reloads
  restore text and pending retry identity. Serialized autosaves and version checks prevent
  a stale tab from overwriting another session. A conflict retains local text and requires
  an explicit choice to load the saved draft. Failures expose retry controls.
- Before sending, the composer persists a message UUID. A transaction writes the message,
  its email outbox record and any enabled coach notification, then deletes only its matching
  draft. Duplicate retries replay the original message; changed payloads are rejected.
  Lost send responses can retry after the transaction deleted the draft. An outbox error
  rolls back the send and leaves the saved draft available.
- Full inbox and floating center consume the same SQL conversation summary. Unread totals
  cover all authorized history, independently of the 50-message display page and bounded
  60-thread previews. Read acknowledgement only touches the loaded incoming direct messages.
  Canonical server-derived role and active relationship checks apply on every request.
- Account-owned preferences independently control email alerts and unread badges. Email is
  off by default. Disabling badges preserves unread counts and inbox access. Enabling email
  is unavailable until provider and protected worker configuration exist.
- Each new direct message has a durable email state. The sender sees pending, sent, skipped
  or failed alert state alongside message Sent/Read state. An email failure never discards
  the message. Historical messages are not backfilled into the email queue.
- A bearer-protected POST worker claims bounded batches with database leases and fenced
  completion. It rechecks preferences, read state, verified email and the active relationship
  when claiming a job. Outages, throttling and temporary conflicts retry with backoff; permanent
  rejection fails. Five attempts and a 23-hour expiry bound retries within the provider's
  24-hour idempotency window. Concurrent/uncertain sends retain the same provider key.
- Emails contain a generic alert and signed-in inbox link, with no message body, participant
  names or training details. Worker responses expose counts only. New tables have RLS enabled
  and no client grants; actor-parameter RPCs are service-role-only, SECURITY INVOKER with an
  empty search path. Drafts/delivery records cascade on account deletion, and account export
  scopes drafts to their owner, preferences to their account and deliveries to their recipient.

## Verification

Use Node 22, install the existing lockfile with `npm ci`, and install Playwright Chromium.
From `webapp/`:

```sh
npm run test:auth:full
npm run build
npm run test:e2e:critical
npm run test:messages
```

- Full regression: **415 passed**, zero failures/skips.
- Integration availability: **4 passed**. Production build: **passed**.
- Final desktop/mobile critical browser suite: **115 passed / 3 existing viewport skips**.
  This includes 24 daily-loop, 14 messaging UI and 4 database-backed messaging journeys.
  The earlier interrupted browser run overlapped a rebuild; it is not used as evidence.
- Twelve message lifecycle groups execute the generated migration in isolated PostgreSQL
  (PGlite), including signed-session handlers, owned preferences/drafts, 1,105 unread direct
  messages plus 125 comments, loaded-only reads, stale versions, lost responses, atomic rollback,
  queue leases, five-attempt/expiry bounds, revoked/unverified recipients, client grant denial,
  account cascades, and generic provider payloads. Provider calls are isolated stubs.
- The two new database-backed browser journeys run actual message/draft/preferences/read
  handlers and PostgreSQL SQL behind an isolated transport. They verify coach/athlete exchange,
  prompt refresh, read suppression, reload persistence, and one message/outbox row after a lost
  commit response. `/api/me` and outer transport remain fixtures; this is not hosted Supabase,
  actual browser sign-in, multi-process lock contention or mailbox delivery acceptance.
- Browser runs use a temporary CommonJS Playwright configuration pointing at the production
  build: the runtime's Node 24 ESM configuration loader hung, so Node 22 was used. Repository
  viewport and test settings are retained. Existing three viewport-specific skips remain.
- `git diff --check`: passed. Supabase/Postgres and React review completed. Current Supabase
  changelog and Resend idempotency/error documentation were checked.
- Supabase CLI local security advisors were attempted but could not connect to
  `127.0.0.1:54322`: no local Docker Supabase stack is available. SQL tests validate the new
  grants/RLS/function access, but hosted advisors and a full migration-chain reset remain open.
  The legacy migration-chain issue is already recorded in P0-003/P0-012.

## Controlled release order

Production release/configuration changes require separate explicit authorization under
`AGENTS.md`. Prepare the following before releasing this app version:

1. Inspect the target migration ledger and schema. Confirm `athletes.email_verified_at`,
   coach profiles/active relationships (including `group_name`), `coach_messages`,
   `coach_notifications`, and workout/activity comment subjects. Earlier read-only evidence
   reported `coach_messages` absent; do not infer that merging PR #130 repaired it.
   Relevant prerequisites are `20260501110000_add_coach_groups_and_messages.sql`, the coach
   notification portion of `20260617120000_trainingpeaks_parity_foundation.sql`,
   `20260726000000_activity_comments.sql`, and `20260728120000_auth_hardening.sql`.
   Review missing legacy migrations individually; do not blindly replay the entire chain.
   Existing shared-document schema repair is a separate gate.
2. Apply the exact generated migration
   `webapp/supabase/migrations/20261008231639_message_delivery_and_drafts.sql` before deploying
   the application. Confirm all three tables, all six functions, indexes, RLS and grants;
   run security/performance advisors on the actual target and inspect new findings.
3. Deploy the app without enabling email alerts. Verify signed coach and athlete requests,
   draft persistence and unread summaries against the actual Data API. Old message history
   stays intact; the new queue starts empty.
4. Configure a protected scheduler to POST `/api/messages/deliver-pending` once per minute
   with `Authorization: Bearer <MESSAGE_EMAIL_WORKER_SECRET>`. Use a generated secret of at
   least 32 characters, a verified Resend sender, existing `RESEND_API_KEY`, and the canonical
   `NEXT_PUBLIC_SITE_URL`. Configure scheduling before exposing the worker secret to the app,
   because provider key plus secret makes the email preference available. No scheduler or
   provider setting was changed by this batch; GET-only cron invocation is unsupported.
5. Opt in only the consenting pilot recipients. Observe provider acceptance, pending age,
   failures and skipped reasons. The `sent` state means provider acceptance, not a delivery
   webhook or proof of inbox receipt. Validate actual receipt, privacy and deep-link routing.
   Turning email off suppresses future claims; an already in-flight provider request may finish.

If app rollback is required, stop the scheduler and roll back the app while retaining the
additive tables. Do not drop message history or private drafts as a rollback shortcut.

## Remaining roadmap work

| Item | Remaining work |
| --- | --- |
| P0-015 | Target-schema release; hosted advisors/Data API acceptance; independent worker contention; consenting two-account/physical-phone refresh, reconnect, draft and revocation checks; real provider/mailbox acceptance. |
| P0-014 | Exact workout-match migration/release and controlled imported/manual workout plus physical-phone acceptance, documented in `P0_WORKOUT_MATCH_VERIFICATION.md`. PR #130 is merged. |
| P0-016 | Physical-phone navigation/agenda/editing and retained-context acceptance for the already implemented athlete workflow. |
| P0-017 | Next substantial implementation batch: inventory and defer AI server routes/scheduled work, remove pilot entry points and align public claims while preserving manual/deterministic workflows. |
| P0-018 | Complete remaining required CI coverage and begin the two-week coach/athlete observation only after technical gates pass; measure task time, failures, corrections and repeat use. |
| P0-003–013 | Parent items remain unchecked. Most have local/merged checkpoints; outstanding live-account, schema, integration, billing, legal/operator, authorization and pilot acceptance gates are itemized in `PRODUCT_EXECUTION_ROADMAP.md`. No paid staging is authorized. |

P0-001 and P0-002 are the only checked parent P0 items in the roadmap. This batch does not
claim that all unchecked parents need their implementation rebuilt.
