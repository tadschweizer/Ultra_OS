# P0-010–012: billing, trust and verification batch

October 1, 2026 · draft [PR #127](https://github.com/tadschweizer/Ultra_OS/pull/127).
This continues the P0-010A confirmation work with the related trust and verification gates.
The parent roadmap items remain open until their external acceptance gates are complete.

Integration checkpoint: PR #126 landed on `main` as `39cc8ca` during this batch. Its current
Core/Pro and Coach Essentials/Pro plans were merged into this branch. Public review/sales fixtures
use current Core/Pro plans; retired plans stay denied for new checkout, while their existing prices
map to successor tiers. Subscription metadata still cannot override the current Stripe price.
The reconciliation SQL accepts the new canonical tiers and is tested after the prerequisite tier
constraint migration. The demo coach role and account coach-activation checks use `isCoachTier`.
New tests verify Core-to-Pro upgrades and Pro-to-Core downgrades require hosted confirmation.
Free-tier accounts with a linked failed/cancelled subscription retain access to Manage Billing;
losing paid access no longer hides the recovery/cancellation route.

## What changed

**P0-010B — durable billing reconciliation.** Signed Stripe events now claim a persistent receipt
and a 90-second per-customer lease. Replays acknowledge an already processed receipt without
reading Stripe or rewriting the account. Subscription state is retrieved from Stripe under the
lease; historical event snapshots cannot overwrite a newer plan. The atomic finish RPC verifies
the lease/owner, writes the canonical current price/status/tier, marks the receipt and releases
the lease in one transaction. Expired workers cannot finish after a lease is reclaimed.
Provider/database failures return retryable 503 responses and leave the receipt unprocessed.
Unpaid asynchronous checkout completion cannot grant access. Sync uses the same lease/write
boundary. Ambiguous or incomplete provider lists fail closed. Existing `past_due` grace remains.

The migration creates private receipt/lease tables with RLS and service-role-only RPC access.
It stores event/customer/type identifiers and timestamps, not complete Stripe payloads or secrets.
**Apply the migration before releasing the new webhook and sync handlers.** Missing RPCs intentionally
fail retryably. No live migration, Stripe configuration, subscription or database changes were made.

**P0-011 — trust and account controls.** Privacy, Terms and Support render publicly and explain
coach sharing, cancellation, scoped downloads, deletion and retention limits. The user-provided
support address is `tad.s@mythreshold.co`. Footer links and sidebar support expose the pages.
Account Settings has a paginated JSON archive of the current signed-in athlete's personal records;
nested credentials are redacted, optional missing schema sections are listed, and operational
failures stop the download. No caller-supplied owner ID controls the query. The archive expressly
excludes coach-only notes, other athletes, uploaded file contents and provider credentials.

Deletion checks the current revocable session and origin, requires `DELETE MY ACCOUNT`, and blocks
all training deletion if linked billing cleanup fails. Provider/database errors are sanitized.
The UI preserves typed confirmation on failure, offers cancellation, prevents simultaneous actions
and reports partial external sign-in cleanup explicitly. After success, old billing/security/coach
controls are replaced by a result screen and the local provider sign-in session is cleared.
Deletion uses the existing cascade/orphan
workflow; it is not a global distributed transaction. Billing may already be cancelled if a later
database step fails. Uploaded storage objects, provider copies, backups and partial auth cleanup
need separate verification/operator handling. The privacy page does not promise immediate erasure
of all such copies. Strava integration attribution appears across application surfaces, with
original-activity links for recent dashboard records that have a numeric Strava activity ID.

**P0-012 — repeatable critical paths.** CI now runs the full Node 22 regression suite, integration
availability checks, production build, desktop/mobile critical journeys and axe accessibility smoke.
Failure traces are retained. Demo POST/DELETE require same-origin JSON, explicit opt-in and a local
or exactly matched isolated staging project; production deployments and the known production
database are blocked. Demo coach role persistence is explicit. No synthetic dataset was seeded live.

Critical message journeys cover coach follow-up, athlete reply, reload, failed-send draft retention
and absent conversations. Their review also added associated composer labels, screen-reader errors,
an immediate send lock and disabled conversation/draft changes during submission. Sending is disabled
without an active conversation. Public trust/billing links now have sufficient contrast and the
HTML document declares English. Typed deletion supports keyboard review/cancellation and visible focus.

## Evidence and its limits

| Check | Result | Evidence scope |
| --- | --- | --- |
| Full Node 22 regression after PR #126 integration | 364/364 passed | Handler/domain fixtures and actual isolated PostgreSQL migration tests |
| Billing cases within full regression | 77/77 passed | Signed Stripe fixture headers; current-state provider fixtures; 8 PGlite PostgreSQL cases |
| Trust/deletion/staging safety handlers | 20/20 passed | Isolated account/provider/database adapters; no destructive live operations |
| Integration availability | 4/4 passed | Configuration-boundary regression |
| Final critical browser suite after PR #126 integration | 79 passed, 3 intentional viewport skips | Real desktop/mobile UI, isolated API responses and pilot handler adapters |
| Final trust/keyboard/accessibility browser slice | 20/20 passed | WCAG 2 A/AA + 2.1 AA smoke on public pages, billing main, deletion controls/result; keyboard cancellation and partial cleanup |
| Final messaging browser slice | 6/6 passed | Coach follow-up, athlete reply, reload, pending locks, failed-send retry and disconnected state |
| Final production build | Passed | Includes prerendered Privacy/Terms/Support and account-export API |
| Git whitespace check | Passed | Scoped local diff |

The signed-handler PostgreSQL case delivers real signed event fixtures through the webhook handler and
the actual migration RPCs. It verifies durable replay, current-state entitlement updates and lease
contention/retry together. This is stronger than a mocked receipt store, but it still uses a minimal
athletes schema and a fixture Stripe client. It does not establish full Supabase migration-chain,
PostgREST, hosted Stripe payment, real phone, legal, or production acceptance.

Local logs are under `output/p010-012-*`. Desktop support and mobile account screenshots were
visually inspected; the focused browser run also saved mobile support and desktop account images.
The initial axe run identified link contrast and missing HTML language, both fixed before passing.
The initial messaging retry assertion matched Next's route announcer as well as the page error;
the final assertion scopes to the page's main landmark. No product success was inferred from those
failed runs.

For copy/paste commands, isolated configuration, demo seeding and an actual phone/desktop script,
see [STAGING_AND_CRITICAL_PATH_VERIFICATION.md](STAGING_AND_CRITICAL_PATH_VERIFICATION.md).

## Remaining release gates

1. Apply/verify the specific migration in an isolated Supabase environment and exercise service-role
   RPCs via PostgREST. First verify prerequisite `20261001120000_tiered_athlete_coach_plans.sql`
   is applied; the local SQL suite executes both relevant migrations in that order.
   Docker was installed but its daemon was unavailable during this batch.
   Migration-history drift still precludes a broad remote database push.
2. Verify real Stripe sandbox invoices, hosted plan-change confirmation, 3DS, declines, asynchronous
   settlement, renewal failure, cancellation and delayed/out-of-order delivery. Check the portal
   configuration and exact deployment origin. Existing SDK/API contracts were preserved.
3. Supply the legal person/business operating Threshold, review the public terms/privacy language,
   actual processor/retention practices and Strava integration obligations before public release.
   A support email alone does not establish the legal operator. No operator name was invented.
4. Test exports/deletion against disposable isolated accounts with populated records, external auth,
   billing and uploaded files. Resolve/record partial cleanup and provider/backups separately.
5. Provision/use already included staging resources and test email/OAuth callbacks; actually seed
   and verify the isolated demo pair. The prior decision against the quoted paid branch remains.
6. Run the manual daily coach/athlete loop on an actual phone. Existing pilot live/schema and human
   timing gates are still open. Production release, schema and service configuration require
   separate user authorization.

Primary integration references used for implementation review: [Stripe webhook guidance](https://docs.stripe.com/webhooks),
[Stripe hosted confirmation flows](https://docs.stripe.com/customer-management/portal-deep-links),
and [Strava brand guidelines](https://developers.strava.com/guidelines/). These references do not
certify legal or contractual compliance.
