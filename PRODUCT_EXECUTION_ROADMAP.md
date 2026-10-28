# Threshold Product Execution Roadmap

Last updated: 2026-10-28<br>
Status: Athlete onboarding simplification deployed through PR #144 / merge 59e0667, Vercel dpl_4fbgop93jzn2LDJa9mv2MMsVwo8i READY on both domains; see ATHLETE_ONBOARDING_SIMPLIFICATION.md. Copy week destination picker released through PR #142 / merge 72e4ce5, Vercel dpl_F85PBT7KHehZze8RwKeUhXDHZD79 READY on both production domains. Weekly planning and coach/athlete review workflow deployed with owner authorization on mythreshold.co and www.mythreshold.co, PR #141 / main 0415ffe, Vercel dpl_EV67hYZtVjzAx4wRc7pVLEfe6BFG READY. Migration 20261017012725 applied; do not replay local 20261017003222. See WEEKLY_COACHING_RELEASE_2026-10-16.md. Owner review mode and prior security controls remain deployed.<br>
Current milestone: M0 — workout email/text notifications implemented locally in 4ac6bf9, not deployed or activated (COACHING_NOTIFICATIONS.md); coaching calendar readability, sport distance comparisons and editor IF removal locally verified in 095aa41/efa674b; exact-head CI/review and production acceptance remain pending. Feedback history permissions are reconciled in merged PR #154; hosted migrations must not be replayed.<br>
Next item: Review the notification PR and text configuration baseline; provider setup, migration, scheduler and deployment require separate owner authorization. Complete exact-head checks/review for the focused calendar presentation change, release under the owner-authorized bounded feedback workflow, and verify actual live behavior. Resolve review-queue/import scope and shared-library questions separately. Preserve real participant, physical-phone, provider and mailbox acceptance; contributor access remains separately gated.


## Purpose

This is the source of truth for product execution. It exists so work can resume in a new session
without relying on chat history, and so a feature is not called complete merely because code was
written.

Supporting evidence lives in:

- `LAUNCH_AUDIT_2026-09-06.md` for the latest source, GitHub, Vercel, Supabase, and public-page review.
- `NEXT_CHAT_EXECUTION_PROMPT.md` for the bounded first execution session and handoff requirements.
- `COACH_PILOT_READINESS.md` in PR #104 for the detailed coach/athlete journey audit.
- `COACH_TEST_PLAN.md` for the current manual coach workflow.
- `README-PLATFORM.md` for the existing architecture and older parity matrix.
- `MULTIUSER_ROADMAP.md` and `AI_ANALYSIS_ROADMAP.md` for historical context. Where they conflict
  with this document, this document controls execution order.

## Product direction

Threshold's main product goal is to become at least as useful as TrainingPeaks for a coach's and
athlete's daily planning work, then win on intervention tracking, correlations, and coach decision
support.

The September launch priority is manual coach/athlete training: create and assign workouts, log or
import completion, review results, and exchange timely feedback. AI-labelled features and automated
generation are deferred until after this loop is reliable. Preserve deterministic training calculations
and coach-written feedback. The detailed launch audit defines the deferral and verification scope.

That does **not** mean building every large parity feature before fixing the current closed loop.
The invite, role, check-in, and mobile navigation failures must be repaired first. Otherwise there
is no reliable way to put the product in front of one coach and learn which parity work matters most.

The release strategy is therefore:

1. Make a manually provisioned, one-coach pilot physically work.
2. Build the core TrainingPeaks planning loop, beginning with the calendar and training plans.
3. Add structured workouts, device delivery, integrations, and serious analytics.
4. Open a self-serve free trial only after the product and billing paths are trustworthy.

Mobile is not a final cleanup phase. Every milestone must ship complete coach and athlete mobile
workflows for the functionality it introduces.

## Definitions

- **Closed coach pilot:** One manually approved coach with up to five athletes. No public trial
  marketing and no assumption that self-serve billing is ready.
- **Public trial:** Any visitor can sign up, receive premium access for a defined period, and convert
  or downgrade without manual intervention.
- **TrainingPeaks parity:** The core coach/athlete workflow can be completed at comparable speed and
  reliability. A feature existing somewhere in the interface is not parity.
- **Complete:** Acceptance criteria pass in an isolated environment or a controlled real pilot,
  automated tests pass, mobile and desktop are verified, and evidence is linked below. A controlled
  production pilot uses normal participant data only; it never creates synthetic production records
  or performs destructive test operations.

## How to use this document

At the start of every implementation session:

1. Read this document and the evidence document linked to the current item.
2. Work only from the **Current milestone**, starting with the first unchecked, unblocked item.
3. Keep each pull request focused on one item or one tightly related group.
4. Add or update automated tests with the change.
5. Verify the acceptance criteria in staging.
6. Mark the item complete only after verification, then add the PR and evidence to the progress log.
7. Update `Last updated`, `Current milestone`, and `Next item` before ending the session.

Checkbox meanings:

- `[ ]` not complete
- `[x]` complete and verified
- `BLOCKED:` cannot proceed until the stated dependency is resolved
- `DEFERRED:` intentionally removed from the current release scope, with a reason

## Release gates

| Gate | What it permits | Required milestones |
| --- | --- | --- |
| G0: One-coach pilot | Personally invite one coach and up to five athletes | M0 |
| G1: Planning beta | Ask coaches to use Threshold for real weekly planning | M0–M2 |
| G2: Structured-workout beta | Plan workouts and deliver them to at least one real device ecosystem | M0–M4, with one outbound provider live |
| G3: Public free trial | Advertise a self-serve athlete and coach trial | M0–M7 |
| G4: TrainingPeaks replacement claim | Publicly claim minimum TrainingPeaks-level daily functionality | All parity acceptance tests in this document |

## M0 — Make the closed pilot work end to end

Goal: One coach can sign up, invite an athlete, receive daily check-ins, plan/review work, message the
athlete, and use the experience on a phone without Tad or an administrator repairing records by hand.

### Technical readiness without waiting for feedback — October 9

The complete audit below still controls parent closure. [PR #133](https://github.com/tadschweizer/Ultra_OS/pull/133)
prepared the targeted release; the owner authorized the production database application
on October 9. The three dependencies and follow-up foreign-key indexes are now applied. See `PILOT_TECHNICAL_READINESS.md`
for the exact three-source order, safe read-only preflight, hosted API check and rollback.
`pilot-observation.csv` is a blank measurement record; no participant timings were invented.

- New repair source: `20261009201251_pilot_release_prerequisites.sql`, applied first.
  It creates missing message/document/group membership tables, adds the missing group
  description field and installs service-only metadata readiness. Existing-object or
  partial-release collisions stop the reviewed release; existing participant history stays intact.
- `/api/ready` now requires feature schema as well as database connectivity. Shared
  documents honour revoked sessions/relationships; group adds retry on the composite key.
- Combined isolated SQL/actual signed handlers and transport checks are included in
  required CI regression execution: **431/431** local tests; integrations **4/4**;
  production build passed; desktop/mobile critical **129 passed / 3 existing skips**.
- Live preflight: `repair_allowed: true`, no missing base columns, zero duplicate links;
  the initial `ready: false` is resolved. Fresh `ready: true` and all ten GET-only hosted
  API checks pass after the authorized release. Source-to-remote mappings are in the runbook.
- CI enforcement remains unverified: rulesets `[]`, classic protection denied (403).
  Measurement preparation is complete; enforced required checks and participant observation are not.

### Verified P0 deliverables and next work — October 9

This snapshot supersedes older “draft”, “next implementation” and missing billing-schema
statements in the historical checkpoints. It covers every P0 parent and P0-013 slice.
Unchecked means acceptance remains open; it does not mean the feature needs rebuilding.
No checkbox is advanced by this documentation audit.

| Deliverable | Verified position | Work remaining before completion |
| --- | --- | --- |
| P0-001 — Invitations | Checked; existing PR #108 release/acceptance evidence | Retain invite regression coverage; no new implementation queued. |
| P0-002 — Invitation email | Checked; existing real-mailbox and persisted-failure evidence | Retain delivery/copy-link coverage; invitation email does not prove message-alert email delivery. |
| P0-003 — Roles | Canonical role/auth implementation merged; prior schema evidence recorded | Normal fresh-account enrollment, refresh/new session and server authorization acceptance. |
| P0-004 — Pilot access | Grant/provision/revoke implementation merged | Approved coach receives an honest expiring entitlement; verify normal access and expiry/revocation. |
| P0-005 — Check-in entitlement | Server entitlement and abuse limits implemented | Linked pilot athlete completes seven normal daily check-ins without product-limit blockage. |
| P0-006 — Fast check-in | Dedicated flow and failure retention implemented | Time an actual returning athlete at 30 seconds or less; verify persisted triage signals. |
| P0-007 — Coach mobile path | Navigation/invite/group entry implemented | All M0 actions on a physical phone; October 9 repairs resolve messaging/shared-document schema gaps; full-loop acceptance remains. |
| P0-008 — Honest integrations | Placeholder cleanup and Strava lifecycle merged | Actual provider OAuth/import/disconnect/webhook/worker acceptance and honest configured availability; separate provider approval gates remain. |
| P0-009 — Onboarding/empty states | Canonical linking, group entry and retained failed answers implemented | Real coach/athlete onboarding and no-data/save-failure journeys on phone and desktop. |
| P0-010 — Billing safety | PR #127 merged; October 9 live schema/RPC/grant preflight passes | Full application Stripe SDK authentication, hosted 3DS/async settlement and provider acceptance in test mode; never repeat applied migrations just because source timestamps differ. |
| P0-011 — Trust/support | Threshold LLC pages, export and protected deletion implemented | Correspondence address and retention/processor review; external Auth/uploaded-file/backup cleanup acceptance separately from database deletion. |
| P0-012 — Test environment/CI | Node 22 regression, integration, build, desktop/mobile and accessibility run in Auth Smoke | Required-check enforcement, full legacy migration-chain/hosted Auth/provider acceptance and physical-phone script. No paid staging approved. |
| P0-013 — Backend/authorization parent | A complete; B/C implemented; D remains acceptance work | Close the remaining slice criteria below before closing the parent. |
| P0-013A — Release baseline | Checked historical baseline; current main/deployment/schema refreshed in this audit | Recheck immediately before any authorized release; baseline is not account acceptance. |
| P0-013B — Research authorization | Canonical admin guard and signed-handler tests merged | Verify deployed non-admin denial without mutations; privileged CRUD remains isolated. |
| P0-013C — Readiness/alerts | Bounded readiness and tagged failure reporting implemented | Accept or resolve reduced alerting scope; external rule/monitor previously declined. Live failure behavior is not established by healthy probes. |
| P0-013D — Isolation/revocation | Local isolation tests and earlier schema audit exist | Hosted cross-athlete/revoked access, privileged routes, current RLS and real-role acceptance; recheck historical COROS RLS finding before any narrowly scoped repair. |
| P0-014 — Workout reliability | PR #130 merged | Exact reviewed migration applied October 9; hosted column/RPC/API readiness passes. Verify import/correction/retry/timezone behavior and phone timing. |
| P0-015 — Messaging | PR #131 merged; durable server drafts, exact counts and private leased email outbox implemented | Message and lifecycle dependencies applied October 9; hosted Data API and reviewed advisors pass. Worker contention, two-account/reconnect/revocation/phone and consenting real-mailbox acceptance remain. |
| P0-016 — Athlete navigation | Daily-loop navigation/Today implementation merged | Physical-phone agenda, non-drag editing, retained context and accessible full-loop acceptance. |
| P0-017 — AI deferral/claims | PR #132 merged and deployed; final PR evidence reports 419 regression, 4 integration and 129 browser passes / 3 skips | Deployed guard/no-deferred-requests and existing participant-data preservation acceptance. No further deferral build is queued. |
| P0-018 — Usability/retention | CI coverage exists; required enforcement unverified; observation not completed | Prepare measurement sheet and first-session script now; verify required checks, then observe one coach/up to five athletes for two weeks after technical gates pass. Time planning/check-in/logging; record saves, support, unread failures, corrections and repeat use. Compare representative TrainingPeaks tasks before parity claims. |

#### Execution order

1. **Release readiness first (P0-014/015/013):** database sources are applied; final-head CI and the authorized PR #133 app release are complete. Continue with
   the remaining provider/physical-phone acceptance gates. The prepared release
   in `PILOT_TECHNICAL_READINESS.md`, starting with the new targeted prerequisite repair.
   Review the exact source and current
   target prerequisites. The October 9 application resolves the previously missing workout-match column/RPC,
   `coach_messages`, `coach_shared_docs`, and messaging preferences/lifecycle functions.
   P0-015's merged source is `20261008231639_message_delivery_and_drafts.sql` from PR #131;
   do not deploy the superseded `20261007200545_messaging_delivery.sql` from the separate
   local branch. Review missing legacy message/document dependencies individually.
   P0-014's exact source remains `20261007162647_workout_match_decisions.sql`.
   The owner authorized the targeted release on October 9; no broad `supabase db push` or automatic history repair is included.
2. **Next bounded work batch (P0-018 preparation, about one to two hours):** verify
   branch protection/rulesets and required Auth Smoke check; prepare a simple task-time,
   error and repeat-use record plus a moderated first-session script (now prepared in
   `pilot-observation.csv` and `PILOT_TECHNICAL_READINESS.md`). CI running is
   already implemented; the last PR audit could not read classic branch protection
   (403) and found no public rulesets, so enforcement remains unverified.
3. **Controlled acceptance:** verify fresh-account signup and email verification with
   appropriate consenting new accounts; the manually provisioned QA pair cannot cover
   those enrollment gates. Use the approved labelled pair within `QA_ACCOUNTS.md` for
   post-enrollment entitlement, check-in, workout, message, draft, unread and revocation
   journeys. Verify desktop and a physical phone separately; no real billing or
   destructive production tests.
   Opt-in message email needs verified provider and protected POST scheduler setup.
4. **Observe and close M0:** seven normal check-in days and the two-week P0-018 study
   take actual elapsed days. Resolve remaining provider/billing/trust/authorization gates,
   close only evidenced parent criteria, then advance to M1 calendar work.

#### Evidence checked in this audit

- GitHub: PR #127 merged `2841ac8`; #130 `4f2038f`; #131 `66d941a`; #132 `1830b14`.
  Fetched remote main is `1830b1478338dd8416f93260ad1f79ed2606e57c`.
- Vercel: both public domains alias READY production deployment
  `dpl_EJW3CheGpF7LbYKrxbKKh3KnNkeL`, whose Git source is the same #132 merge commit.
- Supabase `jzfctjaaowdvubhqswpa`: read-only schema inventory confirms the missing
  workout-match and coach-message/document objects. Recent migration history contains
  only the October 4 tier/billing/Strava sources under remote versions `20261004125923`,
  `20261004125933`, `20261004125934`; neither new workout/messaging migration is recorded.
  Actual billing/Strava preflight returns `ready: true`: nine functions have service-only
  execution and empty search paths; all three private tables have RLS and no client access.
- Implementation evidence: `P0_WORKOUT_MATCH_VERIFICATION.md`,
  `P0_015_MESSAGING_VERIFICATION.md`, `P0_017_AI_DEFERRAL_VERIFICATION.md`,
  `P0_010_012_EXTERNAL_ACCEPTANCE.md`, and the parent checkpoints below. Test totals are
  attributed to their recorded PR runs; this documentation audit did not rerun application
  suites, exchange participant messages, send real email or perform production writes.

### Pilot blockers

- [x] **P0-001 — Repair coach invitation acceptance**
  - `/join` accepts the canonical coach invitation parameter.
  - Logged-out recipients return to the invite after signup or login.
  - The UI calls `/api/coach/accept-invitation` exactly once and handles used, expired, invalid, and
    already-accepted tokens.
  - The active coach-athlete relationship appears in both accounts.
  - Automated API and browser tests cover the complete journey.

- [x] **P0-002 — Send a real invitation email**
  - Use the existing transactional email layer.
  - Include coach identity, clear purpose, expiration, and canonical acceptance URL.
  - Keep a one-click copy-link fallback in Command Center.
  - Record delivery failure without pretending the invitation was sent.

- [ ] **P0-003 — Persist role and enforce role-aware access**
  - Coach/athlete choice reaches the server and persists on the account.
  - Existing accounts receive a safe migration/default.
  - Server-side route checks and navigation consume one canonical role helper.
  - A client-side role selector cannot grant coach or admin privileges by itself.
  - Local verification on 2026-08-25: focused role/auth tests passed 53/53; the full regression
    suite passed 196/196; the production build generated all 35 static pages; role-aware browser
    tests passed 5/5 across desktop Chromium and 390 px mobile Chromium (with three intentional
    project-specific skips); invitation browser regression passed 14/14 across both viewports; and
    `git diff --check` passed.
  - Migration `20260821193413` passed isolated PostgreSQL 17.6 validation: a real existing coach
    profile backfilled to coach, ordinary/paid/admin accounts stayed athlete-oriented, invalid roles
    were rejected, and a rerun preserved a later primary-mode choice. A full local migration-chain
    reset remains blocked by pre-existing legacy migration filenames that the Supabase CLI skips,
    leaving `public.athletes` absent for the first timestamped migration.
  - September 6 audit: GitHub main contains P0-003 via PR #111 (`7336511`). Vercel lists production
    deployment `dpl_CqSxKNoaLjeBndJ4BiK1nXSiEBYr` as READY on equivalent source commit `27ee0e5`.
    This supersedes the earlier statement that production deployment had not occurred.
  - September 6 recheck confirms restored ACTIVE_HEALTHY Supabase, migration `20260821193413`,
    role/default/admin/tier constraints, and current production source `fcc29a0`. This supersedes
    the audit's inactive/timeout evidence. September 7 combined local regression passes 248/248
    and five applicable mocked role browser journeys pass. Still open: real staging account
    persistence, refresh/new-session, and authorization acceptance; no isolated staging was available.
  - [PR #119](https://github.com/tadschweizer/Ultra_OS/pull/119) applies one canonical post-auth
    destination rule across login, signup, onboarding, and OAuth. A crafted coach checkout return
    path now fails closed, while approved public checkout intents survive incomplete-account and
    Strava onboarding. Node 22 authorization tests pass 251/251 and pilot browser journeys pass
    12/12 across desktop and mobile.
    It merged as `b4339f1` and production deployment `dpl_Fw9hoWzgs6fS5mDNLwsMJef7uuWv`
    reached READY with both public domains attached. Live desktop/mobile public routing passed 2/2.
  - No-cost decision 2026-09-09: accept role persistence during normal coach/athlete enrollment in
    the controlled production pilot. Keep synthetic, forged, and destructive cases local.

- [ ] **P0-004 — Give pilot coaches honest access**
  - Review: [PR #115](https://github.com/tadschweizer/Ultra_OS/pull/115), code `fceb053`.
  - Implementation checkpoint 2026-09-07: separate expiring admin grants and provisioning/revocation
    form/API; role and paid tier unchanged; closed-pilot copy aligned. Staging acceptance open.
  - Review hardening in [PR #119](https://github.com/tadschweizer/Ultra_OS/pull/119) rejects coach
    checkout at both the post-auth return-path boundary and server checkout endpoint. Choosing coach
    or crafting a billing URL cannot grant pilot or paid access.
    Production returns 403 for anonymous coach checkout while Individual Annual returns the expected
    307 signup redirect.
  - Remaining acceptance will use a specifically approved real pilot coach in production. Signup
    alone remains insufficient; an administrator must verify the person before granting access.
  - Implement an explicit pilot/beta entitlement or manually provisioned pilot state.
  - Signup, landing, pricing, and upgrade copy match the actual entitlement.
  - Do not conflate a closed pilot entitlement with the later Stripe public trial.

- [ ] **P0-005 — Uncap coach-dependent athlete check-ins**
  - Review: [PR #115](https://github.com/tadschweizer/Ultra_OS/pull/115); same feature/dependency chain as P0-004.
  - Implementation checkpoint 2026-09-07: canonical server entitlement lookup and UI usage, active
    pilot/paid coach relationships, explicit lookup failure, expiry/revocation behavior and independent
    abuse limit. 30 pilot tests and combined 248-test suite passed; isolated SQL validated. Staging open.
  - Final local release verification after review hardening: 251/251 authorization tests, a 36-page
    production build, and 12/12 pilot browser journeys including seven controlled daily dates.
  - Seven synthetic dates remain local. Production acceptance will come from seven normal daily
    check-ins by a linked pilot athlete; no production clock override or synthetic rows are allowed.
  - An athlete attached to an active pilot/paid coach can complete the daily check-in needed by the
    coach product.
  - Abuse protection operates separately from product limits.
  - Pricing and entitlement copy describe the behavior accurately.

- [ ] **P0-006 — Make daily check-in a first-class workflow**
  - Dedicated check-in entry point from athlete Home and mobile navigation.
  - Today's date is prefilled.
  - The fast path captures legs, energy, and RPE, which are required by coach triage/correlation.
  - A missing-today prompt appears without becoming a guilt-inducing dark pattern.
  - Completion target: a returning athlete can submit a useful check-in in 30 seconds or less.
  - Local implementation checkpoint 2026-09-28: `/check-in` page (date prefilled from the athlete's
    local day, one-tap 1-10 legs/energy/RPE, optional note, retained answers and retry on failure,
    double-submit guard); athlete mobile tab and sidebar entry; dashboard prompt when today has no
    check-in (`/api/me` now returns `lastCheckInDate`); server rejects out-of-range scores and, for
    the fast path, requires all three. Review hardening: coach triage now derives readiness from fast check-ins
    (legs/energy/RPE) since nothing writes `daily_checkins`; lightweight logs no longer count as the
    daily check-in; the page shows the entitlement limit before accepting answers. Full suite 266/266,
    production build, and daily-check-in browser journeys pass on desktop and 390 px. Open: a real athlete timing the flow at 30 s or less.

- [ ] **P0-007 — Give coaches a complete mobile path**
  - October 1 implementation checkpoint: preserved existing role-aware Roster/Calendar/Messages/Profile
    tabs; added a visible Invite an athlete action and Manage groups link in basic Command Center.
    The first-invitation journey passes on desktop and 390 px. Live QA pages have no horizontal
    overflow, but live messaging returns 500 for missing `coach_messages`; this item stays open.
    See `P0_007_009_VERIFICATION.md` and `QA_ACCOUNTS.md`.
  - Coach mobile navigation includes Roster, Calendar, Messages, and Profile.
  - Command Center and the first-athlete invitation are reachable with no memorized URL.
  - All M0 coach actions work at 390 px CSS width.

- [ ] **P0-008 — Remove false and unsafe integration states**
  - October 1 implementation checkpoint: one entry per provider, server-reported Strava availability,
    unfinished wearables cannot start OAuth, safe callback errors, removed fictional TrainingPeaks
    progress, and persisted Strava identity required before onboarding claims success. Unit and
    desktop/mobile browser checks pass; production deployment/acceptance remains open.
  - Unconfigured connectors are disabled or shown as coming soon.
  - No user-facing response exposes environment-variable names.
  - Remove duplicate Oura/Ultrahuman entries.
  - Remove hardcoded TrainingPeaks migration and connection-success claims.

- [ ] **P0-009 — Repair onboarding and empty-state directions**
  - October 1 implementation checkpoint: directions point to Account Settings → Coach Connection;
    code requests honestly wait for coach approval; first invitation and groups are directly reachable;
    missing race/sport fields and failed saves have actionable errors; failed saves retain answers and
    the current step. Removed import follow-up directions to the fictional migration panel. Automated
    desktop/mobile checks pass; production deployment/acceptance remains open.
  - Remove references to nonexistent Invitations and Roster tabs.
  - Make coach linking available in one canonical location and point all copy there.
  - Link `/coach/groups` from the appropriate coach navigation or remove the sales claim until live.
  - Incomplete onboarding fields display an actionable error.

- [ ] **P0-010 — Fix high-risk billing behavior before any pilot touches billing**
  - October 9 verification: PR #127 is merged and live billing/Strava preflight passes.
    The earlier migration-apply blocker is resolved; provider/application acceptance remains open.
  - October 1 P0-010A local checkpoint: read-only billing review; protected JSON POST for checkout,
    portal and sync; signed expiring price/account/subscription reviews; Stripe hosted explicit
    plan-change confirmation; idempotent checkout/customer creation and unfinished-checkout reuse;
    safe errors; current-session/checkout ownership and paid-state enforcement. Existing subscriptions
    are never updated or granted a new tier by selecting a pricing link. Full regression 311/311,
    production build and billing desktop/mobile journeys 10/10 pass. See
    `P0_010_BILLING_VERIFICATION.md` for evidence and release gates. Sandbox acceptance remains open.
    Review: [draft PR #127](https://github.com/tadschweizer/Ultra_OS/pull/127), code `5392ffd`.
  - October 1 P0-010B local checkpoint: durable service-role-only receipts and customer leases,
    current-state webhook/sync reconciliation, atomic owner-fenced writes, retryable provider/database
    failures and asynchronous-payment tests. Actual PostgreSQL migration and signed-handler integration
    pass locally. Apply the specific migration before releasing the handlers. Isolated Supabase and
    real Stripe hosted acceptance remain open; see `P0_010_012_EXECUTION.md` in draft PR #127.
  - Subscription mutations use `POST`, not `GET`.
  - Add origin/CSRF protection appropriate to the session architecture.
  - Plan changes show price/proration impact and require explicit confirmation.
  - User-facing errors do not expose raw provider details.
  - Tests cover upgrade, downgrade, repeat submission, failed payment, and webhook replay/order.

- [ ] **P0-011 — Publish minimum trust and support surfaces**
  - October 9 reconciliation: merged PR #127 identifies Threshold LLC; operator identity
    is supplied. Address, retention/processor review and external cleanup acceptance remain open.
  - October 1 local checkpoint: public Privacy/Terms/Support pages, user-provided support email,
    coach-sharing/cancellation copy, protected paginated personal archive, typed revocable-session
    deletion with billing failure stop, and Strava attribution. Desktop/mobile, keyboard and axe
    smoke checks pass. Legal operator identity/review and populated staging cleanup acceptance,
    including storage/provider/backup limits, remain open. See `P0_010_012_EXECUTION.md`.
  - Privacy policy, terms, support contact, cancellation language, data export, and account deletion.
  - Explain what athlete data an attached coach can see.
  - Add required Strava attribution wherever Strava data is displayed.

- [ ] **P0-012 — Establish staging and critical-path tests**
  - October 1 local checkpoint: CI now gates full regression, integration checks, production build,
    desktop/mobile critical journeys and axe smoke. Messaging tests cover both roles, reload and
    draft-preserving retry. Demo writes require opt-in/exact isolated target and reject production.
    A safe staging template and beginner-friendly repeatable script are in
    `STAGING_AND_CRITICAL_PATH_VERIFICATION.md`. Actual isolated provisioning/seed, full Supabase
    migration-chain checks and actual-phone acceptance remain open; no paid branch was created.
  - Isolated Vercel preview/staging, Supabase staging, Stripe test mode, and test email/OAuth config.
  - CI runs build, unit/regression tests, browser E2E, and accessibility smoke tests.
  - Seed the existing demo coach/athlete dataset from `lib/adminDemo.js` safely in staging.
  - M0 has a repeatable phone and desktop test script.
  - Cost decision 2026-09-09: do not create the quoted paid Supabase branch. Continue local database,
    handler, and browser checks plus a controlled production pilot. Revisit hosted staging only when
    it is already included or additional spend is approved.

### September launch additions

These items are part of M0. Finish readiness first, then P0-004/005 and the daily training loop.
Bring UX-001 through UX-005 forward for the five frequent surfaces; leave the broad final M7 audit
in place. Existing milestones remain the larger parity roadmap.

- [ ] **P0-013 — Backend readiness and authorization audit**
  - Resolve Supabase availability, verify P0-003 migration and fresh-account role persistence.
  - Scope Vercel's reported configuration errors to their deployments; verify the intended release.
  - Separate liveness from database readiness; add useful failure alerts without exposing secrets.
  - Require administrator authorization for research-library administration before service-role access.
  - Validate athlete isolation, coach relationship revocation, privileged routes, and staging RLS.
  - Production service changes still require explicit authorization.

  Execute this item in separately verifiable slices; do not attempt the whole launch audit in one chat:

  - [x] **P0-013A — Read-only release baseline.** Recheck Supabase availability after the owner
    unpauses it; confirm migration `20260821193413`, required role columns/constraints, current
    GitHub/Vercel source, and deployment-specific configuration errors. Record exactly what was
    observed. Do not infer fresh-account persistence from migration presence or mock browser tests.
    September 6 recheck confirms ACTIVE_HEALTHY, migration/schema and Vercel source `fcc29a0`.
    Configuration-error summaries point to an older preview; current-deployment query had no errors
    in the bounded window. This slice may complete with an evidenced blocker
    report, but P0-003 and the parent P0-013 remain open until their acceptance requirements pass.
  - [ ] **P0-013B — Research-admin authorization repair.** Require the canonical server-side
    administrator guard before every privileged research-library operation. Add meaningful tests
    for anonymous, athlete, coach, and admin requests across supported methods, including denial
    before any privileged read/write. Preserve legitimate admin behavior. Verify locally and in
    isolated staging before marking complete; otherwise record implementation and remaining gates.
    Local implementation checkpoint: canonical guard applied; all 20 signed-session/CRUD regression
    cases pass on Node 22. Staging blocked; see `PILOT_ACCESS_EXECUTION.md`.
    Review: [PR #114](https://github.com/tadschweizer/Ultra_OS/pull/114), code `fafb20c`, after
    [baseline PR #113](https://github.com/tadschweizer/Ultra_OS/pull/113). Pilot PR #115 follows.
    Combined release hardening and regression evidence is in
    [PR #119](https://github.com/tadschweizer/Ultra_OS/pull/119).
    Non-admin denial may be checked read-only in production. Admin create/update/delete remains
    local until an isolated environment exists; do not mutate the production research library for a test.
  - [ ] **P0-013C — Dependency readiness and alerting.** Add bounded readiness checks separate
    from liveness, safe error contracts, and actionable operational alerts. Verify dependency failure.
    Local implementation checkpoint 2026-09-28: `/api/ready` (`lib/readiness.js`) runs a time-bounded
    database probe (3 s), returns 200/503 with status and latency only, and raises a structured log and
    Sentry message on failure; `/api/health` stays a liveness check. 8 new tests cover healthy, error,
    thrown, unconfigured, hung (timeout), non-GET, and no-leak cases; the auth suite passes 259/259 and
    the production build succeeds. Merged in [PR #122](https://github.com/tadschweizer/Ultra_OS/pull/122)
    (`ab4fa36`). Production deploy `dpl_F7ERQSqB8QFHasfmrHozbegB9raZ` is READY; live probe on
    2026-09-28 returned 200 `{"status":"ready","checks":{"database":{"status":"ok","latencyMs":1008}}}`
    with `Cache-Control: no-store`, and `/api/health` returned 200. The first fetch failed at Vercel's access
    layer before reaching the app and the immediate retry succeeded; the runtime log search found no
    `readiness_failed` event. Remaining: a live dependency-failure check is local-test only. Decision 2026-09-28: no Sentry alert rule or external uptime monitor for the pilot;
    failures still log and send a tagged Sentry message, and `/api/ready` is checked by hand. This
    reduces the "actionable alerts" criterion, so P0-013C stays open until that is accepted explicitly.
  - [ ] **P0-013D — Relationship and data-isolation verification.** Verify cross-athlete denial,
    revoked coach access, privileged routes, staging RLS, and outstanding P0-003 real-account tests.
    Record evidence and complete the parent only after every remaining criterion passes.

  Historical first-session scope was A plus the focused B repair. The current verified queue
  above supersedes that scope; C and P0-014–017 now have implementation checkpoints.

- [ ] **P0-014 — Reliable workout creation and logging**
  - October 7 match-correction checkpoint ([merged PR #130](https://github.com/tadschweizer/Ultra_OS/pull/130), implementation `efed738`): durable confirm/reject/replace/unlink and explicit automatic restore; owner-scoped imported actuals, duplicate-link protection, stale conflicts, retry-safe decisions and cross-range calendar placement. Node 22 regression 403/403; critical browser 103 passed / 3 skips; daily-loop browser 24/24; build and isolated PostgreSQL checks pass. See `P0_WORKOUT_MATCH_VERIFICATION.md`. Exact new migration and controlled deployed/physical-phone acceptance remain open; no production writes.
  - October 5 local implementation checkpoint: retained save failures, blank actuals, completion correction/undo, unplanned logging, durable workout-create retries, validation and conservative import matching.
    Node 22 regression 394/394; critical browser suite 89 passed / 3 viewport skips; expanded
    daily-loop journeys 16/16; real isolated Supabase 6/6 check groups. Evidence and remaining
    parent acceptance: `P0_DAILY_LOOP_VERIFICATION.md`. No production release is claimed.
  - Every create/update/complete/delete/library action reports persisted success or actionable failure.
  - Preserve drafts, clear busy states after errors, prevent duplicate submission, and support retry.
  - Directly edit/undo completion; support partial, skipped, and unplanned sessions.
  - Distinguish actual/imported values from copied planned defaults.
  - Test later device import against manual logging, mistaken matches, and timezone boundaries.
  - Returning athlete target: log completion within 30 seconds, excluding optional written notes.

- [ ] **P0-015 — One dependable messaging experience**
  - October 9 verification: PR #131 merged as `66d941a` and its app code is deployed in
    #132. Its migration and legacy message prerequisites remain absent in production.
  - October 8 local implementation checkpoint ([PR #131](https://github.com/tadschweizer/Ultra_OS/pull/131), code `6cea21d`): server-persisted/versioned per-recipient drafts, retry-safe atomic send/outbox, shared all-history unread summaries, owned email/badge preferences, generic private-content-free alerts, leased bounded delivery worker, delivery status and scoped account export. Node 22 regression 415/415, integration 4/4, critical browser 115 passed / 3 existing skips and build pass; SQL and desktop/mobile evidence in `P0_015_MESSAGING_VERIFICATION.md`. Target-schema migration, protected scheduler/provider activation, hosted advisors and real phone/mailbox acceptance remain open. No production writes or real emails.
  - October 5 local implementation checkpoint: one canonical composer, four-second refresh, per-recipient drafts, durable retries, cursor history and loaded-message read acknowledgements.
    Node 22 regression 394/394; critical browser suite 89 passed / 3 viewport skips; expanded
    daily-loop journeys 16/16; real isolated Supabase 6/6 check groups. Evidence and remaining
    parent acceptance: `P0_DAILY_LOOP_VERIFICATION.md`. No production release is claimed.
  - Full inbox and floating center share conversation selection, unread state, and read acknowledgement.
  - Incoming replies refresh promptly; target five seconds in an open conversation.
  - Keep per-recipient drafts, retry safely, paginate history, and preserve session-discussion links.
  - Notifications have explicit preferences, delivery state, and private content handling.
  - Verify two-account delivery, refresh, reconnect, duplicate prevention, and relationship revocation.

- [ ] **P0-016 — Athlete-first navigation and focused interface**
  - October 5 local implementation checkpoint: Today/Calendar/Log workout/Messages/Profile mobile navigation, Today sessions and coach reply, keyboard-accessible workout panels.
    Node 22 regression 394/394; critical browser suite 89 passed / 3 viewport skips; expanded
    daily-loop journeys 16/16; real isolated Supabase 6/6 check groups. Evidence and remaining
    parent acceptance: `P0_DAILY_LOOP_VERIFICATION.md`. No production release is claimed.
  - Athlete mobile navigation: Today, Calendar, Log workout, Messages, Profile.
  - Today exposes the planned session, fast check-in, and latest coach reply.
  - Preserve coach Roster/Calendar/Messages access already introduced by P0-003.
  - Converge roster, calendar, editor/logging, Today, and inbox components now, including accessible
    dialogs, labelled fields, saved/error states, readable type, and touch controls.
  - Verify a phone agenda view and non-drag editing; retain calendar context after mutations.

- [ ] **P0-017 — Defer AI and align product claims**
  - October 9 verification: PR #132 merged as `1830b14`; production is READY on that
    source. Verify deployed behavior and preserved participant data before closing acceptance.
  - October 8 local checkpoint: immutable release capability blocks four Exa endpoints, research draft generation and direct library calls; automatic race/protocol UI is deferred. Manual catalog/race entry, human research editing and deterministic calculations remain. Landing and pilot claims now describe the available manual loop. Node 22 regression 418/418, integrations 4/4, build, focused browser 12/12 and expanded critical browser 127 passed / 3 existing skips. Evidence: `P0_017_AI_DEFERRAL_VERIFICATION.md`. Controlled deployed acceptance remains open.
  - Inventory AI labels, generation/search/enrichment routes, scheduled work, and deterministic logic.
  - Disable deferred generation on the server and remove its pilot UI entry points and sales claims.
  - Keep manual planning, coach feedback, workout totals, and transparent deterministic calculations.
  - Preserve stored data and verify pilot routes make no deferred generation requests.
  - Replace TrainingPeaks-overlay positioning with an honest description of the available pilot loop.

- [ ] **P0-018 — Measure daily-loop usability and retention**
  - Add the full build/regression and critical role/workout/message journeys to required CI.
  - Observe one coach and up to five athletes for two weeks after technical gates pass.
  - Record task time, save failures, support needs, unread failures, corrections, and repeat usage.
  - Compare representative planning tasks with TrainingPeaks before claiming equal speed or parity.

### M0 exit test

- [ ] Tad completes the coach journey on a phone using the seeded demo pair.
- [ ] A fresh coach receives access through the intended pilot mechanism.
- [ ] The coach sends an invite without manually composing an email.
- [ ] A fresh athlete accepts it after signup/login and appears in the roster.
- [ ] The athlete completes seven useful daily check-ins without a tier limit blocking them.
- [ ] The coach sees the signals, assigns work, comments/messages, and reviews completion on mobile.
- [ ] No unfinished connector or hardcoded migration state is presented as real.
- [ ] One real coach completes a moderated first session before a second coach is invited.
- [ ] Workout saves and completion corrections recover from network failure without lost input.
- [ ] Two accounts exchange timely messages and unread state stays correct across both message views.
- [ ] Pilot UI and server routes exclude deferred AI features and false migration states.
- [ ] Backend readiness, authorization, and P0-003 migration/role evidence are recorded.

## M1 — Fast calendar editing

Goal: A coach can plan and revise a real training week quickly enough that returning to TrainingPeaks
is not easier.

- [ ] **CAL-001 — Calendar interaction foundation**
  - Unified workout event model and stable optimistic updates.
  - Keyboard and touch interaction design are specified before implementation.
  - Every mutation has conflict/error recovery.

- [ ] **CAL-002 — Drag and drop**
  - Move a workout within a day or between days on desktop.
  - Provide a non-drag action menu and touch-friendly mobile equivalent.
  - Preserve local date/time correctly across time zones and daylight-saving changes.

- [ ] **CAL-003 — Copy, paste, and duplicate**
  - Copy one workout, a selected set, a day, or a week.
  - Pasting never silently overwrites existing workouts.
  - Repeated operations are idempotent where practical.

- [ ] **CAL-004 — Multi-select and batch edit**
  - Select workouts across dates.
  - Move, duplicate, delete, assign, and change selected properties safely.
  - Destructive actions show exact scope and support recovery.

- [ ] **CAL-005 — Undo/recovery**
  - Undo recent move, copy, edit, and delete actions.
  - Server and client state remain consistent after refresh.

- [ ] **CAL-006 — Recurring workouts**
  - Daily/weekly/custom recurrence with an end date or occurrence count.
  - Edit one occurrence, this-and-future, or the series.

- [ ] **CAL-007 — Dual calendar**
  - Compare two date ranges or adjacent training blocks without losing context.
  - Copy between views.

- [ ] **CAL-008 — Group scheduling**
  - Assign a workout or week to a coach group.
  - Preview recipients and exceptions before publishing.
  - Per-athlete edits do not unintentionally alter the shared source.

### M1 exit test

- [ ] A coach builds a seven-day week for five athletes, revises it, and fixes a mistake without
  leaving the calendar.
- [ ] The same week can be managed from a phone without relying on drag and drop.
- [ ] Calendar operations pass concurrency, time-zone, keyboard, touch, and accessibility tests.

## M2 — Real training plans and libraries

Goal: Coaches can create reusable intellectual property and apply it to individuals or groups.

- [ ] **PLAN-001 — Workout library architecture**
  - Multiple named libraries and folders.
  - Search, filter, sort, duplicate, archive, and ownership rules.

- [ ] **PLAN-002 — Plan templates**
  - Multi-week reusable plans containing workouts, notes, rest days, and optional protocols.
  - Draft/published/archive states and version history.

- [ ] **PLAN-003 — Apply a plan**
  - Apply by start date, end date, or target race date.
  - Preview collisions and resulting dates before committing.
  - Apply to an athlete or group.

- [ ] **PLAN-004 — Sharing and permissions**
  - Share a workout/library/plan with a coach or athlete using explicit read/copy/edit permissions.
  - Shared plans cannot leak unrelated athlete data.

- [ ] **PLAN-005 — Plan search and management**
  - Search by sport, duration, volume, goal, author, and tags.
  - Show where a plan is currently applied.

### M2 exit test

- [ ] A coach creates a 12-week plan once, finds it later, applies it backward from a race date,
  resolves calendar conflicts, and adjusts one athlete without changing the source template.

## M3 — Structured workouts

Goal: Structured workouts are expressive, quick to build, and safe to reuse before device export.

- [ ] **WORK-001 — Step model**
  - Time- and distance-based steps.
  - Warmup, work, recovery, cooldown, ramp, and open steps.
  - Targets for pace, heart rate, power, zone, cadence where supported, and RPE.

- [ ] **WORK-002 — Builder interactions**
  - Reorder steps using pointer, keyboard, and mobile controls.
  - Nested repeat groups with clear calculated totals.
  - Duplicate and convert steps without rebuilding them.

- [ ] **WORK-003 — Preview and validation**
  - Visual interval timeline and calculated duration/distance/load.
  - Validate impossible ranges, unsupported targets, and provider limitations before save/export.

- [ ] **WORK-004 — Versioning and reuse**
  - Editing an assigned workout requires an explicit choice between instance and library source.
  - History records material changes after athlete delivery.

### M3 exit test

- [ ] A coach can recreate representative running, cycling, and strength sessions without dropping
  essential structure or using raw JSON.

## M4 — Integrations and device-native delivery

Goal: Planned work reaches the devices athletes already use, and completed work returns reliably.

- [ ] **SYNC-001 — Connector framework hardening**
  - Provider-neutral connection state, token refresh, retries, rate-limit handling, sync cursors,
    idempotency, duplicate prevention, disconnect, and health reporting.

- [ ] **SYNC-002 — Provider priority decision**
  - Select providers from pilot evidence, not logo count.
  - Record commercial/API access requirements and supported inbound/outbound capabilities.
  - October 8 access checkpoint: Suunto accepted Threshold into its Partner Program on October 5;
    the separate one-use API Zone signup invitation was sent to `tad.s@mythreshold.co`.
    Development access is available; production API subscription still needs Suunto review.
    Next: redeem the invitation from the original email, subscribe to Developer API, configure
    OAuth app name/client secret/redirect URI in the profile, and use a Suunto App test account.
    Verify one authorized workout/FIT import and webhook before expanding to Guides delivery.
    Docs: https://apizone.suunto.com/how-to-start and https://apizone.suunto.com/faq.
    The welcome email also advertises sleep/HRV and SuuntoPlus Guides, but the public FAQ has
    older conflicting sleep information; confirm actual subscribed endpoint scope during setup.
    No signup, credential creation, production request or connector implementation was performed.

- [ ] **SYNC-003 — First outbound workout provider**
  - Deliver a structured workout to one real device ecosystem.
  - Surface provider validation errors before delivery.
  - Confirm delivery state and handle later edits/cancellations.

- [ ] **SYNC-004 — Reliable inbound activity sync**
  - Historical import, incremental updates, corrections/deletions, duplicate control, and manual retry.
  - Link planned and completed workouts with explainable reconciliation.

- [ ] **SYNC-005 — Expand major providers**
  - Garmin, COROS, and Wahoo sequencing depends on access and pilot usage.
  - Oura/Ultrahuman remain recovery-data connectors, not substitutes for workout delivery.

- [ ] **SYNC-006 — Real TrainingPeaks import**
  - Import only through a supportable, permitted mechanism.
  - Show transferred, skipped, mapped, and failed records from actual job state.
  - Provide an audit log and resumable retries.

### M4 exit test

- [ ] A planned structured workout is delivered to a physical device, completed, synced back,
  reconciled with the plan, and shown to the coach with no manual file handling.

## M5 — Performance analytics

Goal: Coaches can understand load, fitness, fatigue, workout execution, and trends without exporting
to another product.

- [ ] **ANA-001 — Metric definitions and data quality**
  - Document CTL, ATL, TSB, TSS/load equivalents, time zones, missing-data behavior, and confidence.
  - Distinguish estimated, device-reported, and user-entered values.

- [ ] **ANA-002 — Performance Management Chart**
  - Configurable date range and visible fitness/fatigue/form trends.
  - Hover/tap inspection and links to underlying workouts.
  - Coach multi-athlete navigation retains context.

- [ ] **ANA-003 — Workout analysis**
  - Planned versus actual structure, laps/intervals, zones, time-in-zone, elevation, and key streams.
  - Missing streams degrade honestly.

- [ ] **ANA-004 — Peaks and trends**
  - Sport-appropriate best efforts, rolling trends, volume, intensity, consistency, and adherence.
  - Filters and comparison periods are understandable on mobile.

- [ ] **ANA-005 — Threshold differentiation**
  - Intervention correlations and coach triage link to the underlying check-ins and workouts.
  - Show sample size, uncertainty, and data-quality limitations.
  - Never present correlation as causation.

### M5 exit test

- [ ] A coach can answer what changed, why the system believes it changed, which workouts support
  that conclusion, and how confident the result is without exporting data.

## M6 — Public trial, pricing, and billing

Goal: Self-serve trial users reach a real activation event and can convert, downgrade, or leave
without surprises.

- [ ] **TRIAL-001 — Finalize product tiers**
  - One canonical entitlement matrix drives UI, API, pricing, and tests.
  - Decide whether Research Feed is truly premium or remove the separate paid SKU.
  - 2026-10-01 Status: Weekly planning and coach/athlete review workflow deployed with owner authorization on mythreshold.co and www.mythreshold.co, PR #141 / main 0415ffe, Vercel dpl_EV67hYZtVjzAx4wRc7pVLEfe6BFG READY. Migration 20261017012725 applied; do not replay local 20261017003222. See WEEKLY_COACHING_RELEASE_2026-10-16.md. Owner review mode and prior security controls remain deployed.<br>
    Tiers are Free / Athlete Core / Athlete Pro and Coach Essentials / Coach Pro; the feature
    matrix lives in `webapp/lib/subscriptionTiers.js` (`TIER_FEATURES`, `hasFeature`). Research
    Feed is retired as a paid SKU (existing subscribers map to Core). Pro is deterministic analytics
    only; AI is listed as `COMING_SOON_FEATURES` and granted to no tier. Remaining before this can
    be checked: apply migration `20261001120000_tiered_athlete_coach_plans.sql` before deploying,
    create the eight Stripe prices and set the `STRIPE_PRICE_CORE_*`, `STRIPE_PRICE_PRO_*`,
    `STRIPE_PRICE_COACH_ESSENTIALS_*`, `STRIPE_PRICE_COACH_PRO_*` env vars, then verify
    checkout and webhook tier writes in production. Coach checkout stays closed during the pilot,
    and roster-size enforcement and per-extra-athlete billing are not built yet.

- [ ] **TRIAL-002 — Athlete trial**
  - Proposed starting point: 21 days, no card required.
  - Clock begins at first imported/logged activity, not account creation.
  - Activation checklist leads to the first useful insight.

- [ ] **TRIAL-003 — Coach trial**
  - Proposed starting point: 30 days, no card required, up to five athletes.
  - Demo roster is available before the clock starts.
  - Clock begins when the first real athlete accepts an invitation.

- [ ] **TRIAL-004 — Stripe lifecycle**
  - Stripe is authoritative for paid/trialing subscription state.
  - Trial reminders, expiry, cancellation, payment failure, action-required, upgrade, downgrade, and
    customer portal paths are implemented and tested.
  - Expiry never deletes or conceals the user's historical data.

- [ ] **TRIAL-005 — Preserve purchase intent**
  - Pricing selection survives signup, verification, OAuth, and onboarding.
  - The user returns to the intended checkout or trial confirmation.

- [ ] **TRIAL-006 — Funnel measurement**
  - Measure landing → signup → onboarding → connection/invite → activation → trial → paid → retained.
  - Define athlete and coach activation by product value, not page views.
  - Establish baseline cohorts before setting conversion targets.

### M6 exit test

- [ ] Fresh athlete and coach accounts complete every trial lifecycle path in staging.
- [ ] No card is charged without explicit consent.
- [ ] Trial expiry preserves data and leaves a useful free state.
- [ ] Support can explain and reproduce any entitlement from Stripe and application records.

## M7 — Interface convergence and release hardening

This milestone is not permission to defer usability. Each earlier milestone must already be usable.
M7 removes systemic inconsistency and validates the full product before public launch.

- [ ] **UX-001 — Role-based information architecture**
  - One primary desktop navigation and one role-appropriate mobile navigation.
  - Public pages never inherit protected app navigation.

- [ ] **UX-002 — In-app type scale**
  - Reserve marketing-scale heroes for marketing pages.
  - Standard app page titles are approximately 28–32 px with tested responsive behavior.

- [ ] **UX-003 — Component and token convergence**
  - Adopt a small documented set of cards, buttons, fields, spacing, and corner radii.
  - Convert top-traffic surfaces before low-use pages.

- [ ] **UX-004 — System states**
  - Consistent loading, empty, error, offline, success, upgrade, and permission states.
  - Login and signup never appear blank during session checks.

- [ ] **UX-005 — Accessibility and input coverage**
  - Keyboard, screen reader, reduced motion, contrast, focus, touch target, and zoom checks.

- [ ] **UX-006 - Messaging page revamp (implemented; independent acceptance pending)**
  - User request, October 10, 2026: the message page should function and look kind of like the
    iPhone messaging app. Use a familiar conversation list and chat-thread layout, clear sender
    bubbles and unread state, and an easy mobile composer with retained coach-athlete context.
  - Preserve current persistent drafts, failed-send input, retries, delivery/read behavior and
    exact unread counts. This UX work is separate from P0-015 messaging reliability and its
    remaining provider, real-mailbox and physical-phone acceptance gates.
  - Acceptance: responsive phone and desktop conversation/thread/composer layouts;
    keyboard navigation, focus and conversation/back navigation; draft persistence through
    reload and recipient/role switching; unread/read and send/retry regressions pass without
    losing athlete context or implying unverified external delivery.
  - Implemented on separate branch feature/messages-native-ui after demo stabilization; before a polished coach
    presentation, require independent acceptance of the production UI. 432 regressions, final build, 48 desktop/mobile browser scenarios and 6 final navigation/SQL cases pass; see docs/production-messaging-evidence/README.md. Keep this item open for review/hardware acceptance.

- [ ] **QA-001 — Full regression matrix**
  - Email/password, verification, reset, OAuth, invitations, roles, onboarding, calendar, plans,
    structured workouts, integrations, analytics, billing, portal, cancellation, and deletion.
  - Verify at phone, tablet, and desktop breakpoints.

- [ ] **QA-002 — Observability and operational readiness**
  - Real-user performance, product analytics, error reporting, sync health, webhook health, and alerts.
  - Runbooks exist for auth, provider sync, payment, and email failures.

- [ ] **QA-003 — Claims and trust audit**
  - Every marketing claim is linked to a verified product behavior.
  - No placeholder, beta, or hardcoded state can be mistaken for completed user data.

## TrainingPeaks parity acceptance scenarios

Threshold cannot claim parity until all of these pass with representative accounts and real data:

- [ ] A coach builds, copies, revises, and undoes changes to a multi-athlete training week quickly.
- [ ] A coach creates a reusable multi-week plan and applies it from a target race date.
- [ ] A coach builds a nested structured workout with time/distance and appropriate intensity targets.
- [ ] A planned workout reaches at least one major physical device and the completion syncs back.
- [ ] Planned versus completed work is reconciled and understandable.
- [ ] A coach evaluates fitness, fatigue, form, execution, peaks, zones, and longer-term trends.
- [ ] The athlete checks in, views the plan, receives feedback, and understands progress on a phone.
- [ ] The coach completes roster triage, planning, messaging, and review on a phone.
- [ ] Billing, login, invitations, account recovery, export, and deletion require no administrator.

## Decision log

Execution checkpoint: [PILOT_ACCESS_EXECUTION.md](PILOT_ACCESS_EXECUTION.md) records stage-by-stage
implementation and acceptance separately. September 6 recheck confirms restored Supabase, role
migration/schema, and current Vercel source. P0-003 remains unchecked because real staging
accounts are unavailable; the previous INACTIVE observation below is historical.

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-09-06 | Promote logging, messaging, core UX, and AI deferral into M0 | The initial users need a reliable manual training loop; see `LAUNCH_AUDIT_2026-09-06.md` |
| 2026-09-06 | Verify backend readiness before continuing the release | Supabase reports INACTIVE; migration query timed out; production deployment alone is insufficient evidence |
| 2026-08-19 | Do not advertise the public free trial yet | Current invite, entitlement, billing, truth, and activation gaps would waste trial traffic and damage trust |
| 2026-08-19 | Fix M0 before major parity implementation | A working one-coach loop is needed to validate the larger planning roadmap |
| 2026-08-19 | Calendar, then plans, then structured workouts/device delivery | This follows the coach's daily planning dependency chain |
| 2026-08-19 | Treat mobile as a requirement in every milestone | A separate late mobile pass would preserve broken coach workflows for too long |
| 2026-08-19 | Keep Vercel as the primary app runtime for now | Avoid maintaining two Next.js deployment paths while product risk is higher than hosting risk |
| 2026-09-09 | Do not purchase hosted staging now | Continue free local verification and use normal controlled-pilot activity for real-user acceptance; keep synthetic and destructive tests out of production |
| 2026-10-01 | Adopt Free / Core / Pro athlete tiers and Coach Essentials / Coach Pro; launch Pro without AI | Owner decision: ship robust deterministic analytics first and add AI to the Pro tiers later. Paid-coach athletes get Core; pilot-linked athletes keep check-ins only, per the pilot runbook |
| 2026-09-28 | Do not add a Sentry alert rule or uptime monitor | Owner declined; keep the readiness check manual for the closed pilot |

## Progress log

### October 20 — Public-interface PR #146 conflict resolution

Merged main `ed059a7` into `codex/public-interface-improvements`. The only conflict was
the roadmap milestone/next-item text. Retained main's completed-session production release
and outstanding acceptance gates alongside the unreleased public-interface work.
The package scripts retain both branches' test coverage; session-analysis application code
matches main unchanged. On the combined tree, all 504 regression tests and all 18 public-interface
and session-analysis desktop/mobile browser tests passed. Evidence:
`webapp/output-public-merge-regression.log` and `webapp/output-public-merge-browser.log`.
This updates PR #146 only; no production release is authorized by the conflict-resolution request.

### October 20 — Public interface improvements, locally verified

Implemented all five owner-approved Impeccable findings in `d485634`: access wording follows
existing entitlements; signup/login labels and role controls are accessible; mobile navigation
uses a native modal with focus wrapping; the guide follows one coaching week; the homepage
shows the actual session interface with fictional data and an early athlete entry point.
Shared public navigation, role-appropriate mobile actions and consolidated trust links are included.

Verification: 493 regression tests passed; existing onboarding/role browser coverage 15 passed
with 3 intentional viewport skips; public/free-access browser coverage 14 passed; switch-off
fallback 2 passed; production build passed (41 static pages); production-bundle browser smoke
2 passed. Automated axe checks passed in tested views and the 14-file detector found no issues.
See [PUBLIC_INTERFACE_IMPROVEMENTS.md](PUBLIC_INTERFACE_IMPROVEMENTS.md) for scope and evidence.
No production deployment or service changes occurred. Physical-phone, real-participant,
mailbox/provider and actual screen-reader acceptance remain separate.

### October 10 - isolated calendar/private-draft/load verification and focused fix

Fresh main `fa8ebe2b377784007b4a40b4e982f92a11224075` reproduced duplicate week
copies, five lost prescription fields, athlete-visible private drafts, recovery
load labelled as synced activity, and omitted manual-completion load. Original
runtime evidence is preserved. The authorized focused fix uses atomic copy retry
records, full prescription mapping, private-subject boundaries across calendar,
comments/export/inbox, and explicit actual-training provenance/unknown states.
Local acceptance passes: 443/443 full regression and 30/30 desktop/mobile browser
checks, plus production build. See `CALENDAR_GAP_FIX_VERIFICATION.md` for exact
source, commands, results and rollout/rollback gates. The library mapper is tested
against PR135's published contract checkpoint; that PR's pending library API/UI
is not claimed complete. No production data, providers, secrets, production
migration application, merge or production deployment occurred. Keep all parent acceptance
checkboxes open. [Draft PR136](https://github.com/tadschweizer/Ultra_OS/pull/136)
contains implementation `d300153aff08142425fb8ed1ed4e2dbdb8e812bf` and evidence;
it targets main directly and remains unmerged. PR135's library migration remains
a coordinated release dependency. Hosted concurrency/schema/participant checks
and final-head CI are separate release gates.

Independent review then reproduced a PR136 structure-only PATCH regression at
`0a25f1e`: omitted totals had been converted to explicit null before derivation.
The follow-up correction preserves omitted/null/zero distinctions and clears
unavailable dimensions from replacement structures. The ninth signed-handler/SQL
group verifies structure-only PATCH, explicit null/zero and untouched omissions;
the updated evidence is retained with the same PR. No production rollout occurred.

Two further isolated reproductions confirmed private-draft leakage in personal
account archives and phantom in-window load from out-of-window confirmed imports.
The archive filters before pagination; load resolves athlete-owned links
independently of its rolling query and excludes unresolved/out-of-window links
with explicit provenance. Signed archive/date-boundary/ownership/revocation/manual
and deduplication regressions bring acceptance to11 groups/full regression443.
The original and new failed-before/passed-after outputs are retained in the
verification report. These remain draft PR136 changes, without production rollout.

October 9 technical readiness preparation (PR #133): traced live group description/membership gaps in addition to the message/document and workout/lifecycle gaps. Prepared exact prerequisite repair and a read-only before/after preflight; combined all three release sources in isolated SQL, with grant/RLS/index/function failure checks. Added schema-aware readiness, document session/relationship revocation and retry-safe group membership plus a GET-only zero-row Data API verifier. Node 22 regression 431/431; integrations 4/4; build; critical desktop/mobile browser 129 passed / 3 existing skips. Measurement CSV/script prepared; CI required enforcement remains unreadable/unverified. No production migration, app release, provider activation or participant observation.

October 9 P0 deliverables audit: verified merged PRs #130/#131/#132, fetched main `1830b14`, matching READY production and read-only Supabase schema/grants. Merged PR #131 supersedes the unmerged feature/p0-messaging-delivery implementation and its different migration. Added a complete P0-001–018 / P0-013A–D closure matrix and ordered next queue: release prerequisites, P0-018 measurement/required-CI preparation, controlled phone/two-account acceptance, then elapsed pilot observation. Billing/Strava migration repair is confirmed; workout/message/document schema gaps remain. No parent checkbox advanced, application suite rerun or production write.

October 8 P0-015 checkpoint: [PR #131](https://github.com/tadschweizer/Ultra_OS/pull/131), implementation `6cea21d`, completes the local durable-draft/unread/notification batch. PostgreSQL and actual signed-session handler checks verify persistence, stale tabs, exact retries after lost commit responses, atomic rollback, all-history counts, owned preferences, protected worker leases, retry/expiry bounds, revoked/unverified recipients, RLS/grants and account cascades. Full regression 415/415; integration 4/4; critical browser 115 passed / 3 existing skips; Node 22 build passes. Browser evidence, limitations, remaining P0 list and exact release order: `P0_015_MESSAGING_VERIFICATION.md`. PR #130 is confirmed merged on main `4f2038f`. P0-015 and other parent items remain open for controlled release/live acceptance; next implementation is P0-017. No production deployment/database/configuration change or real notification email.

October 7 P0-014 match-correction checkpoint: saved athlete decisions, explicit manual-to-import linking, duplicate-link protection, stale-edit conflicts, lost-response retries, provider-deletion handling and cross-range calendar visibility are locally verified. Node 22 regression 403/403; critical browser 103 passed / 3 skips; expanded daily-loop 24/24; production build and seven isolated PostgreSQL groups pass. Read-only checks confirm PR #129's READY production deployment on `a9d83c2`, zero existing/duplicate links, the new migration still absent and `coach_messages` still absent. Evidence and release order: `P0_WORKOUT_MATCH_VERIFICATION.md`. P0-014 stays open; P0-015 notification lifecycle is the next implementation batch. No production deployment, database write or service configuration change.

October 3 Strava checkpoint: owner authorized implementation assuming approval and will
contact Strava before launch. Atomic imports/token refresh, safe status, owned disconnect,
deletion/deauthorization webhook handling and a queued refresh worker are implemented.
Six real isolated Supabase/Auth/PostgREST checks and actual app browser import/disconnect
with an HTTP provider fixture pass. Native regression 387/387 and Node 22 build pass.
No real Strava provider account, hosted webhook/scheduler, production migration or public
release is claimed. Evidence/setup: `STRAVA_IMPORT_VERIFICATION.md`. Parent gates stay open.

October 3 external acceptance checkpoint: real local Supabase/PostgREST verified both billing
migrations in order, service-role RPCs and client denials, populated export/deletion, real demo
sign-ins, captured SMTP/application email callback and persisted two-role browser messaging.
Uploaded files survive account deletion and were cleaned separately. Repository bootstrap passes
65/67 historical SQL files, with two explicit older gaps. Demo listing, deletion schema-error
handling and protocol-summary legacy-column queries were repaired. Read-only production checks
confirm the tier prerequisite and all three reconciliation RPCs are absent. Hosted Stripe,
operator/retention/Strava decisions and physical-phone acceptance remain open. Detailed evidence:
`P0_010_012_EXTERNAL_ACCEPTANCE.md`. No production writes or paid staging creation.

October 1 expanded checkpoint: [draft PR #127](https://github.com/tadschweizer/Ultra_OS/pull/127)
now includes P0-010B, P0-011 local account/trust controls and P0-012 CI/demo safeguards. Node 22
regression **364/364**, integration checks **4/4**, production build and final critical browser suite
**79 passed / 3 intentional viewport skips** pass. Merged current plans from PR #126 (`39cc8ca`), resolving checkout/tier conflicts and verifying Core/Pro confirmation plus legacy-price mapping. Eight actual PostgreSQL cases include signed
handler/RPC integration; browser checks include axe and keyboard cancellation. Evidence and remaining
external gates: `P0_010_012_EXECUTION.md`. No production service writes, hosted staging provisioning
or paid branch creation. Parent items remain unchecked.

Add one row when an item is verified. Do not use this table for code that has not passed its exit
criteria.

| Date | Item | PR/commit | Verification evidence | Notes |
| --- | --- | --- | --- | --- |
| 2026-10-08 | PR #128 merge-conflict repair and calendar import notice review | [PR #128](https://github.com/tadschweizer/Ultra_OS/pull/128) | Merged current main (`4f2038f`) into the PR branch, retaining saved match decisions/candidates and cross-range calendar loading. Updated the injected activity fixture to the new metadata contract; regression covers connection state and retained stored activities. Node 22 full regression 404/404; production build passes. Desktop/390 px Chromium pilot-UX and daily-loop browser suites 36/36 pass against the production build (temporary CJS harness on Node 22). | Notice now acknowledges previously imported activities rather than implying disconnected athletes have no history. Roadmap reflects PR #130's confirmed merge, leaves production acceptance open, and records Suunto development-access setup under SYNC-002. No production writes or deployment. |
| 2026-10-04 | Owner request (out of queue): coach sees every athlete workout on the calendar, assigned or not | [PR #128](https://github.com/tadschweizer/Ultra_OS/pull/128) | Code audit: `/api/planned-workouts` already returns unmatched Strava activities and athlete self-added workouts to an active coach, and the calendar renders them for both roles. Read-only production counts: both actively coached athletes have no Strava connection and 0 imported activities, so the coach calendar had nothing to show. Change: the endpoint now reports `import_source.strava_connected` from the sync it already runs, and the coach calendar explains when an athlete has no Strava connection. `next build` passes; `node --test` workout-compliance/activity-sync/workout-comments 56/56; `e2e/pilot-ux.spec.mjs` 12/12 desktop + mobile (Chromium 1194 via executablePath), new test fails when the notice is removed. | COROS pushes are stored in `coros_activities` but never read by any calendar; revisit when COROS is sequenced (M4). Current milestone and Next item unchanged. |
| 2026-10-01 | P0-010A local billing request/confirmation slice | [Draft PR #127](https://github.com/tadschweizer/Ultra_OS/pull/127) / `5392ffd` | Node 22 regression 311/311; build; billing browser journeys 10/10; combined billing/pilot browser regression 32/32 with one worker; diff checks. See `P0_010_BILLING_VERIFICATION.md`. | Local handler and mocked browser gates verified. P0-010 remains open pending webhook replay/order/retry work and isolated Stripe hosted-payment acceptance. No production service writes. |
| 2026-08-19 | Roadmap created | Local branch `agent/product-execution-roadmap` | Reconciled PR #104, current source audit, and existing roadmaps | No implementation items completed |
| 2026-08-20 | P0-001 | [PR #106](https://github.com/tadschweizer/Ultra_OS/pull/106) / `cc3c1da` | Production on `mythreshold.co`: canonical `coach_invite` links displayed invalid (404), expired (410), already-connected/used (409), and accepted states; acceptance POST returned 200; active records were confirmed in both relationship tables and appeared in the athlete account and coach roster. [Auth Smoke run #99](https://github.com/tadschweizer/Ultra_OS/actions/runs/32390037510) passed 41/41 auth tests and 12/12 Playwright tests in desktop Chromium and 390 px mobile Chromium; local invitation API tests passed 7/7 and the full suite passed 179/179. | A fresh athlete accepted the production invitation. PR #107 review later identified that the logged-out browser test stopped at auth-link inspection, so this item was reopened for the complete transition and repaired in PR #108. |
| 2026-08-20 | P0-002 | [PR #106](https://github.com/tadschweizer/Ultra_OS/pull/106) / `cc3c1da` | A production invitation sent through the existing transactional layer arrived in a real recipient inbox from `Threshold <hello@mythreshold.co>`. The message identified the coach, explained the relationship, stated the expiration, and linked to the canonical `https://mythreshold.co/join?coach_invite=...` URL. Command Center retained the copy-link control and displayed `Copied`. Automated API/regression coverage verified honest 502 failure handling while retaining the fallback link. | Live successful delivery was verified. PR #107 review later identified that failed delivery was response-only and disappeared after refresh, so this item was reopened for persistence and repaired in PR #108. |
| 2026-08-21 | P0-001/P0-002 review-gap repair | [PR #108](https://github.com/tadschweizer/Ultra_OS/pull/108) / merge `18f7047` | Invitation API and migration-schema tests passed 12/12; full regression passed 184/184; the production build generated all 35 static pages; invitation Playwright passed 14/14 in desktop Chromium and 390 px mobile Chromium, including complete login and signup return/acceptance journeys; `git diff --check` passed. Production migration `20260820202433` was applied to the UltraOS Supabase project and its columns and constraints were verified before the Vercel production deployment succeeded. Production home, join, and health routes returned 200, and an invalid invitation returned the expected 404 contract. | Delivery lifecycle is persisted separately from invitation lifecycle, failed/skipped delivery remains honest after GET refresh, and Copy Link remains available. Production schema and application deployment completed in migration-first order. |
| 2026-09-28 | Supabase re-verification after restart (P0-003/004/005/013B/013D evidence) | none | Project `UltraOS` ACTIVE_HEALTHY; all 43 migrations present including `20260821193413` (persist_primary_role) and `20260907234756` (pilot_coach_entitlements). `athletes.primary_role` text NOT NULL default `athlete` with CHECK (athlete, coach); `subscription_tier` CHECK (free, individual, coach); `is_admin` boolean NOT NULL default false. RLS enabled on every public table except `coros_activities`. `anon` and `authenticated` hold no SELECT on `athletes`, no INSERT on `research_library_entries`, and `anon` has no SELECT on `coros_activities`. Counts only: 4 athletes, 1 coach role, 1 admin, 1 relationship, 3 invitations, 0 pilot grants. | Schema evidence only; no item advanced. Real-account persistence, pilot grant, and check-in acceptance remain open. Supersedes the earlier COMING_UP/empty-schema entry, which was a restarting project. Follow-up for P0-013D: `coros_activities` has RLS off (no client grants today, so not exposed, but enable RLS). |
| 2026-09-07 | P0-013A | [PR #113](https://github.com/tadschweizer/Ultra_OS/pull/113) / merge `b3869ec` | Supabase project `jzfctjaaowdvubhqswpa` was ACTIVE_HEALTHY; migration `20260821193413`, role defaults and constraints were verified; Vercel production source and deployment-specific errors were checked; Node 22 role tests passed 14/14. | This baseline slice is verified. P0-003 and parent P0-013 stay open because isolated real-account and broader authorization gates remain. The owner explicitly expanded the subsequent session to P0-013B and P0-004/P0-005 while P0-013C/D remain queued. |
| 2026-09-28 | Read-only acceptance recheck (P0-003/004/005/013B) | none | Vercel production `dpl_ErpFm2AbW4KDYp3uXFhadrHLLDdt` READY on `bea51de` (main). Supabase `UltraOS` reported `COMING_UP`; `list_tables` and `list_migrations` returned empty and `athletes` was reported missing, so the schema could not be confirmed. Direct HTTPS to `mythreshold.co` from the agent sandbox was blocked (proxy 403), so the anonymous research-admin denial was not rechecked live. | No item advanced. The empty schema is most likely a project still restarting, but it must be re-verified before any real-user acceptance. |

## Parking lot

Items remain here until evidence moves them into a milestone. They are not commitments.

- Native iOS/Android apps beyond the responsive/PWA experience.
- Training plan marketplace and coach commerce.
- AI-generated plans or workouts before the manual planning model is reliable.
- Additional recovery/wellness providers after core activity and workout delivery are stable.
- Broad social/community features.

October 8 P0-017 checkpoint: [PR #132](https://github.com/tadschweizer/Ultra_OS/pull/132), implementation `6af6629`, stacked on PR #131. Five deferred APIs and their library entry points fail closed; local automatic race/protocol recommendations are unavailable; manual race entry/catalog selection and human research editing remain, with deterministic training calculations. Marketing and pilot guidance describe the manual loop and data limits. Regression 418/418, integration 4/4, production build, focused desktop/mobile 12/12, and critical browser 127 passed / 3 existing skips. Evidence and release prerequisites: `P0_017_AI_DEFERRAL_VERIFICATION.md`. Next item advances to P0-018 measured real-pilot usability and retention. No production changes or participant observation are claimed; P0-017 stays unchecked pending controlled deployed acceptance.
October 8 merge preparation: Tad authorized merging the current PRs. PR #128 merged as `6be3c1a`. The PR #131/main conflicts were confined to roadmap status text and the already-merged PR #130 label; resolved using the newer implementation evidence while preserving the Suunto onboarding record. Imported activity connection metadata changes from PR #128 are retained. Release migration and real-pilot gates remain open.

October 8 combined-branch verification: PR #132 includes the resolved PR #131 integration head `7a496da` and the merged PR #128 calendar import-source metadata. Its roadmap conflicts preserve the newer P0-017 evidence plus Suunto onboarding and merge history. No application conflict required a behavioral change. P0-018 remains the next item; release and real-pilot parent acceptance gates stay open.

### Authorized technical release — October 9

Supabase plugin confirmed target `jzfctjaaowdvubhqswpa`, applied only the reviewed
three-source repair plus three additive foreign-key indexes, and verified metadata
readiness plus all ten hosted Data API checks. New foreign-key advisor findings are
cleared. Intentional service-only RLS notices and existing legacy warnings are recorded
in `PILOT_TECHNICAL_READINESS.md`. Focused final release checks pass 21/21.
PR #133 final-head application rollout follows green CI.

Hosted QA found a draft-conflict timeout. The targeted fifth repair,
`20261009204853_pilot_conflict_responses.sql`, replaces application 40001 errors with
PT409 in the three functions. Full regression passes 432/432; final-head CI and
post-deployment QA must verify the actual HTTP 409 responses. See the runbook for
the confirmed Supabase issue and source-to-remote release mapping.

A sixth targeted repair adds the missing legacy athlete notification preference column
and requires it in schema readiness. Live signed QA now verifies coach-to-athlete delivery,
athlete replies/coach notification, exact unread 1 then 0, draft reload and send retries.
The hosted GET-only verifier now checks eleven contracts, including full workout columns.
Email remains off; the labelled QA pair does not establish mailbox delivery.

### Final deployed technical evidence — October 9

PR #133 merged `1d1e0b6`; final-head [Auth Smoke run 161](https://github.com/tadschweizer/Ultra_OS/actions/runs/37990325629)
and Vercel checks passed. READY production `dpl_GsKkYVtBW87jTCmbXrkfREp5v8QG`
serves that Git source. Both domains pass health/schema readiness and all eleven hosted
Data API contracts pass. Exact six-source mappings and live QA outcomes are in
`PILOT_TECHNICAL_READINESS.md`. These final results supersede the earlier pending-rollout
notes in this session's checkpoints.

Signed live QA verifies drafts, send retries, two-way messages and coach notification,
exact unread 1 then 0, group membership retry/roster denial, documents, workout
reject/auto persistence and stale-edit 409, non-admin research denial, concurrent
notification leases/fencing, relationship revocation and stale-session 401. Only the
labelled pair received test records; temporary relationship/session/outbox/preference
changes were restored. No email was sent, and email preference availability remains off.
Final regression 432/432 and focused release 22/22 pass. No P0 parent is closed by
these checks alone: actual phone, enrollment, provider/mailbox and elapsed-day participant
gates remain. No paid staging or repository protection configuration was changed.

### Authorized synthetic demo - October 10

Built on verified online main fa8ebe2b377784007b4a40b4e982f92a11224075 in an
isolated checkout, after inspecting the earlier demo branch. Shared real calendar,
structured editor, completion/reconciliation and messages/draft views use a closed
synthetic transport; production authentication and API handlers remain unchanged.
Adapter 12/12, browser 15/15 (desktop, 390 and 320px) and production regression
432/432 pass; production and static builds pass. The dedicated branch is
demo/synthetic-transfer. See DEMO_PARITY_MATRIX.md and DEMO_VERIFICATION.md;
publication identity will be in coach-demo/preview-identity.json. Independent
parent QA and physical-phone acceptance remain open. No production milestone
checkbox is closed by this simulation, and no production service configuration
or existing public Sites version was changed.

Draft PR #134: https://github.com/tadschweizer/Ultra_OS/pull/134. Runtime commit
edccc86a83b2c2e21cbad13f78ca0f3330ec3e5e is served by READY static preview
https://ultra-os-tb77-r0amr2xjc-tadschweizers-projects.vercel.app,
deployment dpl_jvfAeqF1FmmJZSat33oHCCcLV889. All 15 hosted browser tests pass;
asset SHA-256 identity, CSP and absent protected API routes are verified.
Exact identity, test output and screenshots accompany this branch. Independent
QA is pending; this entry is a review handoff, not an acceptance declaration.

### Independent synthetic demo repairs - October 10

Independent hosted QA rejected edccc86 on F1 library metadata/private-visibility
loss, F2 planned TSS substituted for unknown actual load, and F3 consumed failure
banner persistence. DEMO_QA_FIXES.md records each cause, bounded repair and
regression. Full demo adapter 15/15, local browser 18/18 (including all three
widths), production auth regression 432/432, and both builds pass. Corrected
immutable publication and independent exact-build retest follow on PR #134.
The production library schema and API are unchanged; full prescription metadata
is a deliberately local demo capability. No acceptance checkbox is closed.

Corrected runtime 683a5ebf42a6e86e56b62544f7b79d303a71aeda is READY at
https://ultra-os-tb77-9vifc1i44-tadschweizers-projects.vercel.app,
deployment dpl_HGAsRETr6kkg1doGUmdrwqyAZMt4. Full hosted suite passes 18/18,
including F1/F2/F3; exact asset hashes, closed CSP, absent API routes and no
page API/external requests are verified. Prior rejected preview/evidence remain
available. Current preview identity and fresh screenshots/output accompany the
branch. Independent exact-build retest remains open; no merge or live-domain
promotion is authorized.

### Second independent synthetic demo repair - October 10

Independent 683a5eb retest clears F1/F2/F3 but holds acceptance on pre-existing
F4 stale calendar selection on refresh and F5 lost matched recorded elevation.
The shared calendar now replaces/clears selection query state; a pure week
summary retains linked/matched elevation/work once, preserving existing actual
duration/distance/TSS attribution. Raw/normalized activity shapes are covered.
Final adapter/helper 17/17, full local browser 21/21, F4/F5 browser subset 3/3,
production auth regression 432/432 and both builds pass. New pinned static
publication and independent F4/F5 retest follow on the same draft PR #134.
Prior previews/evidence remain; no API/auth/schema or production settings change.

Final F4 dialog identity check also verifies unsaved actual inputs reset on both same-calendar deep-link switches. Full local browser 21/21 and final Next/static builds pass; the dedicated branch receives a new immutable static preview and hosted full-suite run before independent handoff.

Final handoff source `54f2ab181848baf022c2fc59ce0c5c492f00da1d`, draft PR #134, READY static deployment `dpl_EtjWEJQQ4gY6xA7UW7aFvf8SeB2B` at https://ultra-os-tb77-fbct852gc-tadschweizers-projects.vercel.app. Hosted full suite 21/21; browser assets match local SHA-256, API paths return 404 and page API/provider requests are zero. Identity/screenshots/raw outputs updated. Independent exact-build acceptance and physical-phone verification remain open; keep this preview stable for retest.

### Independent scoped demo acceptance — October 10

Exact-build independent QA on 54f2ab records limited PASS for the agreed synthetic daily-coaching scope, test window 2026-10-10 01:47:49–01:53:51 UTC. F4/F5 pass at desktop/390/320, F1–F3 smoke and the core coach/athlete loop pass; served asset hashes match cb3136fd and no API/external requests or JavaScript errors were observed. The unmodified report and original ZIP (SHA-256 B13707F02659FE9C08325045EBA5197B596FFF0C046028D49E913E0B2C6155CB) are committed under docs/demo-evidence/independent-54f2ab.

Physical-phone/Safari/Firefox, measured mechanical-work/kJ, production library persistence/production regression and the other report-listed branches were NOT RUN in this independent retest. The narrower production library schema remains unchanged. All prior failed outcomes/dates remain preserved; no full-app parity or physical-phone claim. Runtime CI 38014218602 and existing evidence-head CI 38014420545 verified successful before this docs-only update. No runtime edits, manual redeployment, merge or live-domain promotion; PR #134 remains draft. No production acceptance checkbox is closed.

October 10 user-requested roadmap addition: queued UX-006 under M7 - Interface convergence and
release hardening for an iPhone-style messaging page. Proposed after demo stabilization and
before a polished coach presentation if the user chooses; P0-015 reliability acceptance remains
distinct. Documentation-only queue entry on PR #134; no runtime edit, merge or redesign started.

- 2026-10-10: UX-006 implementation on feature/messages-native-ui, separately based on PR #134 6f1d3f4: familiar list/thread/sender bubbles/bottom composer, visible-thread read gating, URL/back/draft isolation and late-send navigation guard; remove duplicate floating inbox on /messages. 432/432 regressions, final production build, 48/48 messaging + daily-loop browser scenarios, 6/6 final SQL/navigation cases, WCAG list/thread contrast and 320px layout pass. See docs/production-messaging-evidence/README.md. No message backend/schema/auth changes, real provider sends, production deploy/merge or frozen demo redeploy. Independent acceptance and physical hardware remain open.

- 2026-10-10: Independent d13ec51 combined QA reproduced F8: signed inbox GET outage falsely asserted empty. PR #137 now tracks verified reads separately, shows unknown availability and truthful last-loaded conversations, retries and clears role/account or unauthorized caches. Actual SQL-outage browser regression reproduced before repair; workspace 8/8 and final F8 2/2 pass, production/auth 432/432 and final production build pass. See docs/production-messaging-evidence/F8_REPAIR.md. Final combined independent/hardware acceptance remains open; no API/schema/auth/provider, frozen preview, merge or deployment change.

- 2026-10-10: PR #135 narrow athlete calendar wrapping correction committed as 1b1e32e. Reproduced 320px clipping on 17ad6db (348px empty actuals / 362px recorded actuals) and long-label overflow at 390px. Three CSS class changes preserve every value/label; all nine layout combinations fit after correction. Local production build and eight browser tests pass, including six existing calendar copy/privacy/load cases. Regression appended to critical suite. See docs/production-library-evidence/calendar-320/REPORT.md. Fresh published-head CI and independent new-head QA remain gates; production schema approval and main merges remain on hold.

- 2026-10-11: Bounded coach-report correction on released main 64a440e: protocol percentages unavailable with schema-defined planned sessions and matching sampled logs; explicit UTC 28-day window; usable-score unknown handling; generic 503 and UI retry for SQL failures. Baseline four cases fail; final focused 6/6, full 463/463, production build and browser 2/2 (320/390/1440) pass with served-asset hashes matching. See docs/coach-report-correction/REPORT.md. Independent exact-artifact retest remains pending. User approved one new PR only after that passes; no publication, merge, production, migration, provider or auth/security change occurred.

- 2026-10-11: Independent retest7a95e440 cleared F1-F3 and report-only Retry but reproduced G1: shared /api/me500 redirected valid coaches to login. Narrow meClient correction maps all5xx to existing safe retry payload;401/403 clear cached claims. No server validator, permission, cookie, credential, policy or schema change. Real shared faults reproduced before correction; revised local focused9/9, regression466/466, production build and browser10/10 pass including cold/cached320/390/1440 recovery and genuine invalid/expired/revoked denial. Original failure evidence retained. Revised independent QA required before authorized one-PR publication; no publication occurred.

- 2026-10-11 publication evidence, now retained in the reviewed roadmap: independent QA accepted exact patchc65a00a107fa0fcef0cca30ed8f3db28748c9fd50958190ca3c52b7af6a39d53 on main64a440e:11 source hashes,127 assertions,12 cold/cached outage cases, genuine denials and9 rebuilt asset hashes. Accepted commitadc9b9c published as [PR#138](https://github.com/tadschweizer/Ultra_OS/pull/138). Initial CI38107576600 exposed two development-only asset-byte test failures; test-only3499b8b handles Next's generated middleware JSON and Turbopack filenames, with all application code unchanged and local development/production suites6/6 each. Final [CI38108268980](https://github.com/tadschweizer/Ultra_OS/actions/runs/38108268980) passes466 regressions,4 integration checks, production build,175 browser cases (3 intentional skips) and6 isolated calendar acceptance cases. [Automatic Git preview](https://ultra-os-tb77-5gi4ifvqm-tadschweizers-projects.vercel.app) READY at3499b8b, buildySyZYyy_JsYeG2fW13V5f; public HTML200 and10 static assets/compiled correction markers verified without executing authenticated workflows. PR is ready for review, not merged; auto-merge disabled, main unchanged, no production deployment. Task-root COACH_REPORT_PR138_PUBLICATION_MANIFEST.json and CI_FINAL_PASS log retain identity, evidence and limits. Hosted signed workflows, physical hardware and production NULL-score feasibility remain unverified.

- 2026-10-11 PR#138 review follow-up, local and unpushed: discussions4240129692/4240129696 reproduced a Denver evening UTC/local mismatch and stale published roadmap header. On3499b8b the oldest September13 plan is omitted, displayed as0/0 with an unplanned completion; isolated original-handler cases also reproduce Los Angeles and UTC+14 omissions (4 failures,2 passing controls). Narrow correction shares explicit local reconciliation bounds, fetches two extra UTC days for cross-timezone coverage, and retains readiness's existing UTC samples. Local focused11/11, full regression468/468, production build5O_lkUJuWpX9mTMbPnkRU and12 browser tests pass, including12 fixed-boundary observations across1440/320, prior F1-F4,12 G1 shared-fault recoveries, genuine denials and existing safe503 guards. See docs/coach-report-correction/REPORT.md and task-root COACH_REPORT_BOUNDARY_FIX_MANIFEST.json / COACH_REPORT_BOUNDARY_FIX_HANDOFF.md. Exact new artifact awaits independent QA before any push; prior c65/3499 acceptance remains separate. No new commit/push, merge, preview publication, production, security, schema, account or provider operation occurred.

- 2026-10-11 independent timezone acceptance and authorized publication preparation: QA accepted exact incremental patchc09d80bb1b5ba35d9ddf66b95780a08546509e09c62bdfd9ca2028029a955e82 on3499b8b, all12 source hashes and9 independently rebuilt served assets (buildjFlpowcAE6JDwjkdT593h). Runtime independently reproduced4 baseline failures/2 controls and passed42 boundary +60 nearby regression observations,304 assertions, focused11/11 and full468/468 across1440/390/320. Evidence: task-3/output/playwright/protocol-boundary/QA_PR138_BOUNDARY_RETEST.md and threshold-pr138-boundary-independent-pass.zip, SHA25632625F8FBDFEB56FBFF56AAA7F84A4818CCB3CEF96B854FB0A0BDA2872FB2993. A single initial320px confirmed-link navigation timeout passed a fresh instrumented retry; cause unconfirmed and retained as a limitation. Roadmap/report acceptance wording is the only post-QA source difference; runtime/test bytes are unchanged. Existing PR#138 alone is authorized for the update; current head/checks/automatic preview are recorded in task-root COACH_REPORT_BOUNDARY_PUBLICATION_MANIFEST.json and the PR description. No merge, production deployment or schema/security/provider/account operation is authorized or performed.


## Weekly coaching release authorization — 2026-10-16

Owner authorized production release in this chat. Focused branch codex/weekly-coaching-release starts from current main 2930618 and retains security and owner review mode. Six database scenarios and 482 existing regression checks passed on this base. Migration and deployment evidence will be recorded in WEEKLY_COACHING_RELEASE_2026-10-16.md. No synthetic participant records will be created in production.

Release result: PR #141 merged as 0415ffe; both production aliases verified on READY deployment dpl_EV67hYZtVjzAx4wRc7pVLEfe6BFG. Live migration catalog and health checks passed. Owner Google login works at mythreshold.co; new APIs correctly enforce its missing pilot/paid entitlement. See the release record for test totals and the corrected network-fault fixture. No production training records were fabricated.

Owner pilot access approved and provisioned 2026-10-17 01:55 UTC for 30 days, with no paid subscription change. PR #141 is merged; final CI 38991793750 passed. Live signed-in calendar showed the existing athlete, Plan week controls and review list. No new production training records were created during this verification.


### 2026-10-16 — Calendar Copy week destination picker

- PR #142: https://github.com/tadschweizer/Ultra_OS/pull/142; implementation commit `a2bc7b3`, branch `codex/calendar-copy-week-picker`; isolated from unrelated canonical checkout work.
- Replaced next-week-only shortcut with a small Copy week button on each populated calendar week and an accessible destination dialog. Any selected date resolves to its Monday; copying to the same week is blocked.
- Requires explicit acknowledgement that copied prescriptions are added alongside existing sessions. Existing workouts are never replaced. Existing service-only atomic copy, visibility rules, prescription fields, weekday/order offsets and retry identities are unchanged.
- Destination selection survives reload, scoped by account, athlete and source week. Server-confirmed copy shows an acknowledgement. Failed copies retain the dialog and can retry without duplicating an acknowledged operation. Results, feedback and messages are not copied.
- Local validation: 488 regression tests passed; production build passed; targeted desktop/mobile retry tests passed; all six database-backed calendar browser acceptance checks passed. All 28 daily-loop browser checks passed.
- No production migration or deployment performed for this follow-up. Physical-phone and real-participant acceptance remain separate.

- Release follow-up: CI run 38994276211 found transient Send-button contrast during its disabled-to-enabled opacity fade. Removed that button transition; keep the accessibility assertion intact and require fresh full CI before merging.


### 2026-10-16 — Copy week release verified

- User explicitly authorized release, auth smoke and merge. PR #142 merged as `72e4ce5cc5cf233917aa7a115bc6d0cf44bea94c` after all checks passed on final implementation head `d48df4b085aa9a76e636b45722a308862c7475f6`.
- Final Auth Smoke run: https://github.com/tadschweizer/Ultra_OS/actions/runs/38994908811 — SUCCESS. 488 regression, 4 integration-availability, 191 browser checks (3 intentional skips), 6 isolated SQL calendar checks, and production build passed.
- Earlier run 38994276211 failed transient Send-button contrast; removed the disabled-to-enabled fade and retained the accessibility assertions. Six repeated local desktop/mobile runs passed before final CI. No failing checks were bypassed.
- Production deployment `dpl_F85PBT7KHehZze8RwKeUhXDHZD79` for merge `72e4ce5` is READY, target production, aliasError null. Both mythreshold.co and www.mythreshold.co assigned successfully.
- Post-deploy checks: both public health endpoints 200; login 200; anonymous account and planned-workout APIs 401. Live calendar JavaScript contains the destination picker. No production training records were created for these checks.
- No migrations or service configuration changes. Signed-in human workflow, physical-phone, mailbox and participant gates remain separate from automated checks. This follow-up evidence edit does not change application code.


### 2026-10-18 — Free athlete access and coaching website copy

- PR #143: https://github.com/tadschweizer/Ultra_OS/pull/143; final tested implementation `75a3845a82ff8b64ee1df60080aa33b9e67085e3`, merged as `729ece26b762af2d7cd0486de503f34b498a8cad`.

- Owner authorization: all currently available athlete features free until explicit go-ahead to restore billing; permanent free owner coach access and permanent athlete access for owner and named friend. No general free coach access was authorized.
- `NEXT_PUBLIC_ATHLETE_OPEN_ACCESS=true` grants the existing athlete Pro feature set and uncaps logging/check-ins. It does not grant coach/administrator permissions or deferred AI. Checkout GET/POST and billing previews refuse new subscriptions while open access is active; existing billing-history management remains available. Reverting the flag requires a rebuild and deployment; do not turn it off without owner approval.
- `COMPLIMENTARY_ATHLETE_EMAILS` is server-only deployment configuration for permanent grants. Resolve against confirmed primary Supabase Auth email, never profile email or user metadata; failures are recoverable and fail closed. These grants remain independent of open-access mode and Stripe webhook updates. Do not publish email values in repository documents.
- PostgreSQL `infinity` is supported for a non-expiring existing coach grant; start-time and revocation checks remain enforced. No new schema migration. Apply the owner's non-expiring grant only after compatible application code is deployed.
- Homepage and guide explain copy/customize a week, prescription/result review, response requests and next-session adjustment. Free-access pricing replaces purchase CTAs while enabled. Provider copy now says Strava/COROS/Suunto in progress, Garmin next. No claimed measured savings or competitor superiority.
- Local checks: 492 regression tests passed; free-access desktop/mobile tests passed (2), including accessibility and direct checkout rejection; production build with open access enabled passed. Added these checks to Auth Smoke.
- Production data check found only a canceled subscription recorded. Friend has not registered yet; verified-email grant will apply on signup. No invitation email or athlete records were created automatically.

- Release check found existing paid-account billing controls missing when the fixture had no Stripe identifiers (CI 39158480120). Retain the established paid-plan fallback when open access is off, while complimentary accounts without billing history keep it hidden. Require the full suite again before release.

### 2026-10-18 — Free access release verified

- Final Auth Smoke https://github.com/tadschweizer/Ultra_OS/actions/runs/39159833095 succeeded: 493 regression, 4 integration-availability, 191 critical desktop/mobile browser checks (3 intentional skips), 6 database-backed calendar checks, 2 free-access public-copy/accessibility checks, and production build. No failing tests bypassed. The earlier billing-control failure was corrected and the complete suite rerun.
- Additional local checks passed: 22 role/security tests with open access enabled, 44 focused entitlement tests, and 12 billing browser tests. Complimentary athlete access does not count as a paid coach subscription or revive canceled coach eligibility.
- Production deployment `dpl_7xzchfAR9y55eiXMtZ7zR2Abaa6K` READY for merge `729ece2`, aliasError null, both mythreshold.co and www.mythreshold.co assigned. Both public health endpoints returned 200; anonymous account/planned-workout APIs returned 401; checkout returned 403 with ATHLETE_OPEN_ACCESS. Live homepage and pricing display the updated coaching message and free athlete access.
- Authorized production configuration applied: public open-access flag enabled and private verified-email permanent athlete allowlist saved. Keep individual permanent grants when general billing eventually resumes. No schema migration was needed.
- After compatible code deployed, existing owner coach grant updated to `expires_at = infinity`; existing start time retained, revoked_at null. Verified the stored grant, signed-in account showing Permanent complimentary access / PRO, and coach calendar loading roster, planning, review, library and Copy week controls without a paywall.
- Friend is not registered yet: permanent athlete access is reserved and activates after verified signup. Coach relationship still needs to be established normally. No invitation emails or synthetic training records were created.
- Physical-phone, mailbox and real-participant acceptance remain outstanding. Do not infer observed time savings from automated checks. Rolling back to application code that predates infinity support requires restoring a valid finite coach expiry first.


## October 19 — Approved athlete onboarding simplification

Owner approved production release of the reviewed two-screen onboarding. Personal invitation signup removes redundant role choices; onboarding loads existing coach links, starts with optional activity connections, and finishes at Calendar after optional profile details. Races move out of setup; existing data is preserved. No new provider availability, migrations, grants or service settings are included. Release isolated from the mixed D: checkout onto origin/main eb1808c. Prior local checks: 36 browser and 57 regression passed. Exact-branch CI and deployment evidence will be recorded in ATHLETE_ONBOARDING_SIMPLIFICATION.md; participant gates remain open.

Release result: PR #144 merged as 59e0667; exact-head Auth Smoke 39341359723 passed 493 regressions, 4 integrations, build, 201 browser checks (3 existing skips), 6 calendar and 2 free-access checks. Production deployment dpl_4fbgop93jzn2LDJa9mv2MMsVwo8i READY on both domains. Live browser verified simplified invitation signup and invitation-preserving login navigation. No real signup/provider acceptance claimed.


## October 20 — Authorized completed-session analysis release

Owner requested deployment. Prepared only the session-analysis components, API, calculations, tests, calendar entry points and verification notes on codex/completed-session-analysis-release from c04c814. Existing copy-week, onboarding and free-access behavior is retained. No migration or provider configuration change is required. Release evidence will be recorded in COMPLETED_SESSION_ANALYSIS.md after exact-head CI and deployment verification. Live participant recordings and physical-phone acceptance remain separate open gates.

### October 20 chart review refinement
Added unit-labelled Y-axis ticks for each recorded channel, doubled running/walking/hiking cadence to total steps/minute (including summary), and bounded pace display using moving-sample percentiles. Slower samples remain inspectable and included in statistics. Cycling RPM stays unchanged. Validation: 12 calculation/API tests and 6 desktop/mobile browser tests passed; mobile screenshot reviewed. Production release of this refinement is pending. Existing suggested-match and real-participant acceptance remain open.
Production build and diff whitespace checks also passed. Implementation is recorded in the chart refinement commit on codex/analysis-chart-axes.

October 20 release verified: PR #147 merged as 34a3851d2d80d41874f7cf308a537176fe26fd4f. Exact-head Auth Smoke run 39465414228 passed: 505 regression, 4 integration, 207 browser journeys (3 skipped), 6 calendar acceptance, 2 free-access checks and production build. Vercel dpl_6ZHayeAZvQ6DpGoFR3jHQFz1Frb1 READY on mythreshold.co and www.mythreshold.co; GitHub deployment 7207208261 confirms the merge SHA. Signed-in production workout showed pace axis 5:24 /mi, 8:07 /mi, 10:49 /mi; cadence axis uses spm and summary is 174 spm. No workout data or service configuration changed. Existing suggested-match and participant acceptance follow-ups remain open.

## October 27 open-PR conflict review

- PR #146 merges main e3c50db, retaining the chart refinement release record and the pending public-interface work. Only the roadmap header required manual conflict resolution; application changes merged cleanly.
- PRs #148, #149, #150 and #151 are independent branches targeting main, with no ancestry stack and no current base conflicts. Their existing release and real-participant acceptance limits remain open.
- This review does not authorize merging PRs, production deployment or remote database changes.
- Local merge verification on Node 22.23.4: 505 regression tests, four integration checks, production build, and 18 desktop/mobile public-interface/session-analysis browser checks passed. Exact remote-head CI is checked after pushing the merge; real-participant acceptance is unchanged.

### October 21 — Suggested completion analysis clarification (local)

- Implementation commit `1b3b87d`, based on current main `e3c50db`. A calendar suggestion can decorate an unsaved plan as completed, but analysis correctly requires a persisted completion. The detail view now explains activity confirmation, does not mount/request completed-workout analysis for suggestions, and labels the displayed result Suggested completion. Athlete confirmation uses the existing service; coaches receive guidance without new permissions.
- Reproduction: new suggested-match browser regression failed before the fix. Afterward, all 10 analysis browser checks passed on desktop and 390px mobile, including reload, no premature analysis requests, athlete confirmation → analysis, coach guidance, manual completion and unassigned recordings. A final four-case rerun passed with no dialog overflow; desktop/mobile screenshots inspected.
- Node 22.23.3: full regression 505/505 passed; production build passed with loopback-only Supabase configuration; whitespace check passed. Impeccable detector returned zero findings. Evidence: `SUGGESTED_MATCH_ANALYSIS_VERIFICATION.md`.
- No API authorization, matching algorithm, database, provider configuration or production data changes. This is local verification and draft review preparation, not production or physical-phone acceptance. No parent acceptance gate closed.

### October 27 — Current-main conflict reconciliation for PR #148

Main advanced to d10d95b after PR #146 merged. Retained both roadmap workstreams; only the roadmap conflicted and application files merged cleanly. No release or remote migration was performed. Local combined tree passed 505 full regression tests and all 10 desktop/mobile session-analysis checks. Logs: webapp/review-148-regression.log and review-148-browser.log. Full build and critical acceptance are verified by exact-head CI after pushing.

### October 22 — Message notification availability (local)

- Implementation `fb842e5`, base main `e3c50db`. The email checkbox is intentionally disabled when the preference endpoint reports delivery unavailable. Preserve that safeguard; no server/provider enablement is included. The UI now explains what is unavailable and which choices remain usable, associates the explanation with the checkbox, and provides an availability refresh without saving or replacing unsaved choices. Saving also uses the server's latest availability result.
- New recovery expectation failed before the update. Afterward, all 18 existing/new critical messaging browser checks passed across desktop and 390px mobile. Four final availability cases passed again: failed refresh preserves choices, recovered availability permits selection, refresh performs no preference write, save/reload persists choices, and existing email alerts can be switched off while delivery is unavailable. Desktop/mobile settings screenshots inspected.
- Node 22.23.4: full regression 505 passed; production build passed with loopback public Supabase placeholders; whitespace passed; Impeccable detector returned zero findings. Evidence: MESSAGE_NOTIFICATION_AVAILABILITY_VERIFICATION.md.
- This verifies isolated interface recovery, not real email delivery or a production fix. No API/database/provider/service changes or production writes. Human mailbox and participant gates remain open. Separate PR #148 was checked: Auth Smoke and preview checks pass, with no merge/release performed.

### October 27 — Current-main conflict reconciliation for PR #149

Main advanced to d10d95b after PR #146 merged. Retained both roadmap workstreams; only the roadmap conflicted and application files merged cleanly. No release or remote migration was performed. Local combined tree passed 505 full regression tests and all 18 desktop/mobile critical messaging checks. Logs: webapp/review-149-regression.log and review-149-browser.log. Full build and critical acceptance are verified by exact-head CI after pushing.

### October 27 — Reconcile PR #149 with merged suggested-match work

Main advanced again to c42aab6 after PR #148 merged by another action. Both roadmap histories are retained; application changes merged automatically. Combined tree passed 505 regression tests and 28 desktop/mobile messaging and session-analysis checks. Exact-head CI is checked after pushing. No PR merge or production action was performed by this task.

### October 23 — Athlete attention navigation (local)

- Implementation `1e140b9`, base main `e3c50db`. Daily coaching-question selections previously opened a protocol-focused drawer. They now use native athlete-review links. Attention cards and full-roster athlete names also link to the existing review page; background card/row clicks no longer open assignment. An explicit Assign protocol action retains the existing drawer in both views. Protocol-empty guidance now names that action.
- Regression reproduced before implementation: expected keyboard-accessible attention link was absent. All 16 pilot-UX browser checks pass on desktop/390px mobile; four final attention-navigation cases pass with full-roster link/action checks. Covered keyboard destination, correct athlete href, no implicit drawer request, inert flag explanation and explicit assignment opening. Synthetic card screenshots inspected at both sizes.
- Node 22.23.4: 505 regression tests, production build with loopback-only public placeholders, whitespace and design detector checks passed. Evidence: COACH_ATTENTION_NAVIGATION_VERIFICATION.md.
- No protocol mutation, API authorization, schema, provider or production changes. Destination page rendering is intercepted in the focused navigation fixture; its actual data/authorization and real participant/phone acceptance remain separate. PR #148 and #149 were checked passing; neither merged or deployed by this run.

### October 27 — Current-main conflict reconciliation for PR #150

Main advanced to d10d95b after PR #146 merged. Retained both roadmap workstreams; only the roadmap conflicted and application files merged cleanly. No release or remote migration was performed. Local combined tree passed 505 full regression tests and all 16 desktop/mobile pilot UX and coach navigation checks. Logs: webapp/review-150-regression.log and review-150-browser.log. Full build and critical acceptance are verified by exact-head CI after pushing.

### October 27 — Reconcile PR #150 with merged suggested-match work

Main advanced again to c42aab6 after PR #148 merged by another action. Both roadmap histories are retained; application changes merged automatically. Combined tree passed 505 regression tests and 26 desktop/mobile pilot-navigation and session-analysis checks. Exact-head CI is checked after pushing. No PR merge or production action was performed by this task.

### October 27 - Reconcile PR #150 after message availability merged

Main advanced to 15304d55f2a123db5ed11e6b9f613001e7b293ac after PR #149 merged externally. Resolved roadmap-only conflicts by retaining both histories and updating the current milestone and next item. Message settings merged automatically; coach navigation feature behavior is unchanged. Combined tree passed 505 regression tests and 34 desktop/mobile navigation and messaging checks on Node 22.23.4. Logs: webapp/review-150-15304-regression.log and review-150-15304-browser.log. Exact-head CI is verified after the normal branch push. No PR merge or production action by this task.

### 2026-10-27 — Workout save acknowledgement and calendar refresh

- Implementation `6c0b6ea`, branch `codex/workout-save-refresh` from verified main `e3c50db`. Acknowledged editor saves update the calendar from the returned record and close immediately; background read failures have an explicit read-only recovery action. Latest-request guards prevent old refreshes from replacing newer calendar state.
- Reproduced the old behavior on unchanged source: both coach assignment and athlete logging stayed in the editor while the follow-up GET was held. Node 22.23.4: 505 regression tests, 32 desktop/mobile daily-loop checks, six final save/recovery/race checks and a production build passed with loopback public placeholders. Desktop/mobile synthetic captures inspected; whitespace and Impeccable detector passed. See WORKOUT_SAVE_REFRESH_VERIFICATION.md.
- Locally verified; draft review preparation authorized. No merge, production deployment or production write. This removes a dependency on refresh latency, without claiming faster backend writes. Real participant, physical-phone, fresh-account, provider and mailbox gates remain open. The canonical mixed checkout roadmap was preserved.
### October 27 — Preserve calendar enrichment after workout saves

The owner authorized addressing PR #151's P2 review finding. Acknowledged database rows now retain the workout's known activity and comment count while recomputing display date, suggested actuals and compliance. Invalidated suggestions and explicit unlinks do not retain stale matching data. No API or permission changes.

Both new desktop browser regressions reproduced lost comment data against the original component. The repaired source passed 508 full regression tests, four integration checks, 38 desktop/mobile daily-flow browser tests and the production build on Node 22.23.4. This includes held/failed-refresh coverage for confirmed and suggested matches and recovery without another write. Exact-head CI is verified after pushing; release and live acceptance remain pending. See WORKOUT_SAVE_REFRESH_VERIFICATION.md.

October 27 base refresh: main advanced to d10d95b when PR #146 was merged by another action. Reconciled the new roadmap conflicts while preserving both workstreams; application files merged cleanly. Combined tree passed 508 regression tests, 50 desktop/mobile daily-flow and public-interface checks, and the production build.

### October 27 — Reconcile PR #151 with merged suggested-match work

Main advanced again to c42aab6 after PR #148 merged by another action. Both roadmap histories are retained; application changes merged automatically. Combined tree passed 508 regression tests, 60 desktop/mobile daily-flow, session-analysis and public-interface checks, and the production build. Exact-head CI is checked after pushing. No PR merge or production action was performed by this task.

### October 27 - Reconcile PR #151 after message and navigation merges

Main advanced to f004a11698fe45372c7a5d600000be5744535aec following external merges of PRs #149 and #150. Resolved roadmap-only conflicts, retaining all histories and the save-refresh acceptance gates. Application files merged automatically; the save-refresh implementation and calendar-enrichment regressions are unchanged. Combined tree passed 508 regression tests and 72 desktop/mobile daily-flow, messaging and navigation checks on Node 22.23.4. Logs: webapp/review-151-f004-regression.log and review-151-f004-browser.log. Exact-head CI is verified after the normal branch push. No PR merge or production action by this task.

### October 27 - Feedback task review workflow (local draft)

Extended the existing private review notes with contributor/owner authorization, approval and acceptance stages, atomic history, retries and a live filtered panel. Exact corrected Beth login is linked but email verification is pending; production access remains unchanged. Local evidence and rollout gates are in FEEDBACK_WORKFLOW.md. No merge, deployment or hosted migration authorized or executed.

Feedback draft [PR #152](https://github.com/tadschweizer/Ultra_OS/pull/152): implementation 68b85f1, verification 6882ec1; rebased onto main 241b047. Local results: 514 regression, 12 focused API/PostgreSQL, four integration and six desktop/mobile browser checks passed; production webpack build passed. Rollout remains gated as documented in FEEDBACK_WORKFLOW.md.

### October 27 - Local feedback restoration and uncertain-save repair

Verified external merge/deployment of PR #152 before the role-column migration. Original owner membership and 22 notes remain intact. Separate local commits preserve exact uncertain submissions and restore membership-scoped legacy feedback when that column is absent. Results: 515 regression tests, 13 API/PostgreSQL checks, 10 desktop/mobile scenarios plus four final focused checks, and production webpack build passed. See FEEDBACK_REPAIR_2026-10-27.md; no live changes by this task.

## Feedback history permission reconciliation - 2026-10-27

Production default privileges reproduced locally; explicit service_role revocation now precedes SELECT/INSERT. All 13 focused PostgreSQL/API tests pass, including UPDATE/DELETE/TRUNCATE denial. Historical migration version mapping and non-destructive recovery constraints documented in FEEDBACK_HISTORY_PERMISSIONS.md. Review-only branch; no production action in this reconciliation.

### October 28 — Coaching calendar readability and sport comparisons

- Implementation 095aa41 from verified main 7c78f6d, branch codex/feedback-calendar-fixes. Workout titles wrap, workout detail no longer offers its raw export action, and weekly distance comparisons stay within each sport while duration can aggregate. The coach calendar identifies its selected athlete; the command center uses a functional heading, status-tinted triage cards and an aligned nudge link.
- Local Node 22.23.4 verification: 516 regression tests; 62 desktop/mobile daily-flow and pilot-UX browser cases; production webpack build with loopback public placeholders; whitespace and design detector checks passed. Synthetic responsive captures inspected. Browser fixtures do not establish real participant acceptance.
- Application presentation only: no schema, access, provider, billing, authentication or training-record mutations. Private request context stays outside Git. Exact-head hosted checks and independent automated review precede normal merge/deployment. Live results and owner final acceptance remain distinct.
### October 28 — Confirmed editor simplification and access-test alignment

- Owner selected removal of the editor IF input. Follow-up implementation efa674b removes that control in workout/template editors while retaining existing stored values. Does not remove recorded analysis values or change API/storage fields.
- Existing access tests still expected the old personal-name heading; the first hosted run failed four such assertions while 239 other browser cases passed. Updated positive and negative heading assertions to the functional command-center heading, retaining entitlement, failure and revocation checks.
- Combined local evidence: 516 regressions, 62 daily-flow/pilot-UX browser cases, 18 library persistence/retry cases and 12 access/revocation cases across desktop/mobile. Updated webpack build passed with loopback public placeholders; screenshots inspected. The changed head requires fresh hosted CI and independent review; prior head approval is not reused.

### 2026-10-28 — Opt-in workout email and text notifications (local)

- Owner prioritized coach alerts for Beth's uploaded/completed workouts and independent athlete choices for comments and newly assigned workouts.
- Implementation commit `4ac6bf9` on `codex/workout-email-sms-notifications`, isolated from the dirty D: checkout in the attached `workout-notifications` worktree. Details and release prerequisites: `COACHING_NOTIFICATIONS.md`.
- Added separate email/text switches, verified phone opt-in, signed STOP handling, durable event capture, service-only delivery queue, revocation/visibility/preference rechecks, and Resend/Twilio adapters. All switches and the rollout flag default off. No provider account, scheduler, production migration, deployment, or real send occurred.
- Verification: focused related regression 66/66; full authentication/critical regression 523/523; final notification suite 9/9 after the text destination-link check; desktop/mobile browser and accessibility 4/4; webpack production bundle passed with existing framework/Sentry warnings. PGlite and intercepted browser/provider fixtures are local evidence only.
- Production gates remain open: hosted CI, schema/dependency inspection, explicit rollout authorization, sender/provider setup, scheduler, opted-in mailbox/physical-phone checks, and normal participant acceptance. No M0 parent item marked complete. Preserve earlier feedback-history work and Beth's email-verification requirement.

### 2026-10-28 — Notification PR and text configuration baseline

- Opened PR #156: https://github.com/tadschweizer/Ultra_OS/pull/156. Includes the disabled-by-default Twilio/Resend environment template, phone consent/verification, signed opt-out webhook and scheduler setup instructions.
- Merged current main fbeb164 into the feature branch and preserved the calendar release evidence and gates. Post-merge head 496e5af passed all 525 local authentication/critical regression checks. Hosted Auth Smoke is running; GitHub reports the PR mergeable. No production activation or real send performed.
