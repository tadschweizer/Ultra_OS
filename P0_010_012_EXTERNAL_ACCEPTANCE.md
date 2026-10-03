# P0-010–012 external acceptance follow-up

October 3, 2026. Continues draft PR #127. Sandbox-only billing operations were
performed. No production writes, live billing, paid resources, broad remote database
push, or public release were performed.

## Verified against real local services

Docker Desktop's Linux engine and WSL2 backend work. The isolated CLI project is
`output/p010-012-supabase`, with persistent local Docker volumes. Supabase CLI 2.78.1
started PostgreSQL, PostgREST, Auth, Storage and Mailpit. Optional analytics was
disabled after a stopped logging container prevented restart; no unsecured Docker
TCP listener was enabled. Docker Desktop must be running before this stack starts.

- Applied `20261001120000_tiered_athlete_coach_plans.sql` before
  `20261001231152_billing_webhook_reconciliation.sql`; inspected the tier constraint.
- Actual service-role PostgREST RPCs verified claim, lease contention, invalid-tier
  rollback, atomic finish, durable replay and release/retry. Anonymous and real
  authenticated clients were denied all three RPCs and the unexposed private schema.
- The real demo handler seeded linked coach/athlete accounts and populated workouts,
  races and interventions. Both signed into actual Supabase Auth with correct roles.
- The export handler used a signed, revocable session and actual PostgREST to export
  populated records without provider/session credentials.
- A disposable account with training records and an authenticated Storage upload was
  deleted. Athlete/training rows disappeared, Auth cleanup succeeded, the old app
  cookie failed, and its still-issued Auth JWT could not read private athlete rows.
  **One uploaded file remained.** It was removed separately through the Storage API.
  This verifies a cleanup limit, not complete erasure. Stripe cleanup was skipped
  because this disposable account had no sandbox customer; billing-linked deletion
  and external Google identity cleanup remain open.
- Real Supabase SMTP mail was captured in local Mailpit. The confirmation endpoint
  returned a session to exactly `http://localhost:3100/auth/callback`; the actual
  browser callback established a verified application session and reached onboarding.
  This does not prove Threshold's Resend pipeline or Google OAuth configuration.
- Separate actual browser sessions exchanged athlete/coach messages against the local
  database, verified reload persistence, and checked both views at 390×844 without
  horizontal overflow. Coach browser reported zero console errors. Phone hardware,
  workout assignment/completion/check-in, invitation return and human timing remain
  acceptance tasks; no mobile emulator result is classified as a physical-phone pass.

Local artifacts: `output/p010-012-local-supabase-acceptance.json`,
`output/p010-012-local-email-acceptance.json`, `output/playwright/local-*-messages.png`.
Credentials and email callback tokens stay in ignored `webapp/.qa-private/` files.

Final local checks: Node 22 regression **368/368**; production build **passed**;
focused desktop/mobile trust, keyboard and axe browser suite **20/20**. The broader
79-pass critical suite remains the previous checkpoint until the updated PR's CI reruns.

## Defects fixed by these checks

1. Demo listing required `athletes.created_at`, absent from the repository bootstrap.
   The unused field is no longer selected.
2. Deletion's missing-schema fallback did not recognize actual PostgREST missing-table
   messages. Explicit missing table/column codes are now tolerated; permission errors
   still stop deletion. Regression tests cover both boundaries.
3. The protocol summary queried undocumented legacy race columns and failed even for
   structured, seeded races. It now reads the canonical race link first and queries
   legacy fields only as an optional fallback. Missing columns are tolerated;
   operational errors remain failures. Both seeded and empty summaries returned 200
   through the actual local application. Focused regression cases preserve legacy data.

## Database reconstruction and merge/deployment blocker

The repository schema plus historical migrations applied **65 of 67** files in separate
transactions. This is a partial reconstruction, not a successful CLI migration chain:

- `20260430090000_add_integration_interest.sql` references UUID `athletes.id` with a
  bigint foreign key and fails with `42804`.
- `20260526000000_rls_hardening.sql` assumes a `provider_connections` table whose
  creation is not present in the repository baseline; it fails with `42P01`.

The separate focused billing migrations passed. Do not silently skip these failures
when provisioning hosted staging, or claim the resulting fixture is a full production
schema clone. The CLI history also contains duplicate timestamps and nonstandard older
filenames. A reviewed baseline/targeted repair plan is required for repeatable staging.

Read-only production checks on October 3 established:

- The actual production tier constraint still allows only `free`, `individual`, `coach`.
- **None** of the three reconciliation RPCs exist in production.
- `public.coach_messages` and `public.coach_shared_docs` are still absent, confirming
  the earlier pilot messaging/shared-document schema gates remain open.
- The production migration ledger contains neither October billing migration and
  differs from repository history.

Consequently, **do not merge into an automatically deployed main branch yet**. The
maintainer must explicitly authorize a narrow, prerequisite-first production schema
change, verify its grants/constraint/RPCs, and coordinate deployment. A broad push is
unsafe. Existing Core/Pro code on main also needs this prerequisite; no production
subscription was exercised during this read-only check.

## Outstanding provider and operator work

The owner selected **UltraOS sandbox**, account `acct_1TFmRALs6h9nimdM`, and
authenticated Stripe CLI 1.53.0. All tested resources had `livemode: false`.
Provider reads/writes preserved the application's pinned `2025-02-24.acacia` API.

- Initial invoice `in_1UMVTaLs6h9nimdMJsqtVvFd` paid **700 USD cents**.
- Actual hosted Core-to-Pro confirmation showed **$18/month** and **$11 due today**.
  Confirming in the browser updated `sub_1UMVTaLs6h9nimdMwDvSQWkJ`; proration
  invoice `in_1UMVd2Ls6h9nimdMiDnYLL1p` paid **1100 cents**. Local entitlement
  became Pro. The return link was exactly `http://localhost:3100/account?checkout=returned`;
  no hosted deployment origin is claimed verified. Screenshot:
  `output/playwright/stripe-hosted-upgrade-confirmed.png`.
- A test clock advanced to renewal with Stripe's attachable decline method. Invoice
  `in_1UMVfPLs6h9nimdMsbpGGiT4` remained open, due **1800 cents**, paid zero.
  Provider and local status became `past_due`, retaining Pro grace. Paying with the
  valid card settled **1800 cents** and recovered the subscription.
- PaymentIntent `pi_3UMVfhLs6h9nimdM24DTDOjt` returned `requires_action` with
  the authentication-required method. It was canceled after inspection. This proves
  the provider 3DS state. A separate intent `pi_3UMVnxLs6h9nimdM0fkZ9Mfq`
  completed the actual hosted browser 3DS test challenge and became `succeeded`,
  receiving **100 cents**. This is a provider browser check, not full app checkout.
- Period-end cancellation was scheduled while active; immediate disposable
  cancellation produced local `free`/`canceled` state.
- Real Stripe CLI-signed delivery exercised SDK signature validation, the application
  webhook handler and actual service-role PostgREST reconciliation RPCs. Concurrent
  events received retryable 503 while one held the lease. Seventeen genuine events
  replayed newest-first preserved current `free`/`canceled` state, even with older paid
  snapshots. Durable duplicates returned 200. Manual replay used fresh local test
  signatures over genuine provider payloads.
- The actual deletion handler canceled a new disposable trial, deleted its sandbox
  customer, and removed the populated local account, interventions and Auth identity.
  It returned `stripe_cleanup: done`, `auth_cleanup: done`.

**Transport limit:** CLI authentication uses OAuth. The SDK validated real signatures,
but remote provider calls used an authenticated CLI adapter. Full Next-to-Stripe SDK
HTTP authentication, full app checkout through 3DS, asynchronous checkout settlement and a
hosted staging return/callback remain open. The owner was asked to save a test key
privately, never in chat or Git. Filtered evidence is
`output/p010-012-stripe-sandbox-acceptance.json`; raw responses and tooling remain in
ignored `webapp/.qa-private/`.

The default sandbox portal disables plan changes. A separate QA configuration enabled
the isolated QA prices. Added optional server-only `STRIPE_PORTAL_CONFIGURATION` to
both portal entry points, with a regression test proving caller overrides are ignored.
Unset behavior preserves the default. Staging needs an enabled configuration covering
its actual prices. No production portal configuration changed.

The sandbox webhook pointed at **production** and lacked invoice/async events. It was
disabled during tests, then restored to its original enabled state after stopping the
listener and deleting the disposable customer/test clock. QA portal, products and
prices were archived; the demo athlete restored to unlinked Pro. No live-mode settings
changed. An isolated endpoint, correct subscriptions and API-version review remain
deployment prerequisites. Tax registrations remain an operator release decision;
automatic tax was not enabled.

Validation: 78 focused billing tests, 369 regression tests, 12 billing browser tests
and Node 22 build passed.

Supabase lists one production project, no branches, and a Free organization. Hosted
staging does not currently exist. Await the owner's organization selection before a
cost lookup; proceed only with explicitly accepted included resources. The previously
rejected paid branch remains excluded. The local environment is available without it.

The owner supplied the Certificate of Organization details for **Threshold LLC**, a
Utah domestic limited liability company, filed and effective **April 21, 2026**.
Terms, Privacy and Support identify Threshold LLC as the operator. The formation
date is recorded here; it is not treated as the effective date of the public terms.
The business correspondence address remains pending. `tad.s@mythreshold.co` is the confirmed
support address. Public processor copy
now names the configured Resend and Sentry integrations and discloses replay diagnostics;
it does not invent retention periods. Source references are `lib/email/transactional.js`,
`sentry.client.config.js`, `sentry.server.config.js`, and the Supabase/Stripe adapters.
The operator still needs to verify enabled production services, processor agreements,
log/replay/mail retention, security logs, billing retention, uploaded-file deletion,
backups and the actual process for fulfilling access/deletion requests. No contractual
or legal acceptance is inferred from this source review.

## Strava release decision

The current [API Policy](https://www.strava.com/legal/api_policy) and
[API Agreement](https://www.strava.com/legal/api), effective June 1, 2026, require a
compatibility review. Policy sections 2.3, 5.3–5.5 and 6.2–6.3 restrict display to the
owning user, AI/analytics use and persistent storage, specify a seven-day cache limit,
and require reflecting source deletions within 48 hours. The public notice now mentions
Strava's collection of usage information (section 6.5). Branding alone is insufficient.

Existing coach routes (`coach/athlete-detail.js`, `coach/dashboard.js`,
`coach/relationships.js`) read connected athletes' cached Strava activity records.
`lib/activitySync.js` persists them; an enforced seven-day deletion lifecycle was not
established. These source findings are a release blocker, not a compliance certification.
Choose a conforming integration design, obtain written clarification where required,
or disable affected functionality before public release. No real Strava data was used
for this verification and no message was sent to Strava on the owner's behalf.

## Next actions

Complete SDK-authenticated app billing/3DS and asynchronous settlement; supply
Threshold LLC's correspondence address and legal/data-practice review; resolve the Strava decision; approve an included staging
organization/cost; complete hosted email/OAuth and external Google/uploaded-file
cleanup; run the phone script in the staging runbook.
Then authorize the exact production schema/release sequence and review the updated PR.
P0-010/011/012 and earlier human/live pilot gates remain open.
