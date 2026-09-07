# Threshold Product Execution Roadmap

Last updated: 2026-09-06<br>
Status: P0-003 production schema verified; real-account staging acceptance blocked; scoped pilot-access execution in progress<br>
Current milestone: M0 — make the closed coach pilot work end to end<br>
Next item: P0-013B — secure research administration; then P0-004/P0-005 pilot entitlements. P0-003 staging acceptance remains open.

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
- **Complete:** Acceptance criteria pass in a production-like staging environment, automated tests
  pass, mobile and desktop are verified, and evidence is linked below.

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
  - Still open: independently confirm migration application and staging/production acceptance.
    Supabase reports INACTIVE and a read-only migration query timed out during this audit.
    Do not mark complete from deployment status or historic local tests alone.

- [ ] **P0-004 — Give pilot coaches honest access**
  - Implement an explicit pilot/beta entitlement or manually provisioned pilot state.
  - Signup, landing, pricing, and upgrade copy match the actual entitlement.
  - Do not conflate a closed pilot entitlement with the later Stripe public trial.

- [ ] **P0-005 — Uncap coach-dependent athlete check-ins**
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

- [ ] **P0-007 — Give coaches a complete mobile path**
  - Coach mobile navigation includes Roster, Calendar, Messages, and Profile.
  - Command Center and the first-athlete invitation are reachable with no memorized URL.
  - All M0 coach actions work at 390 px CSS width.

- [ ] **P0-008 — Remove false and unsafe integration states**
  - Unconfigured connectors are disabled or shown as coming soon.
  - No user-facing response exposes environment-variable names.
  - Remove duplicate Oura/Ultrahuman entries.
  - Remove hardcoded TrainingPeaks migration and connection-success claims.

- [ ] **P0-009 — Repair onboarding and empty-state directions**
  - Remove references to nonexistent Invitations and Roster tabs.
  - Make coach linking available in one canonical location and point all copy there.
  - Link `/coach/groups` from the appropriate coach navigation or remove the sales claim until live.
  - Incomplete onboarding fields display an actionable error.

- [ ] **P0-010 — Fix high-risk billing behavior before any pilot touches billing**
  - Subscription mutations use `POST`, not `GET`.
  - Add origin/CSRF protection appropriate to the session architecture.
  - Plan changes show price/proration impact and require explicit confirmation.
  - User-facing errors do not expose raw provider details.
  - Tests cover upgrade, downgrade, repeat submission, failed payment, and webhook replay/order.

- [ ] **P0-011 — Publish minimum trust and support surfaces**
  - Privacy policy, terms, support contact, cancellation language, data export, and account deletion.
  - Explain what athlete data an attached coach can see.
  - Add required Strava attribution wherever Strava data is displayed.

- [ ] **P0-012 — Establish staging and critical-path tests**
  - Isolated Vercel preview/staging, Supabase staging, Stripe test mode, and test email/OAuth config.
  - CI runs build, unit/regression tests, browser E2E, and accessibility smoke tests.
  - Seed the existing demo coach/athlete dataset from `lib/adminDemo.js` safely in staging.
  - M0 has a repeatable phone and desktop test script.

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
    Owner reported an intent to unpause on September 6; the subsequent project listing still said
    INACTIVE, so restoration remains unverified. This slice may complete with an evidenced blocker
    report, but P0-003 and the parent P0-013 remain open until their acceptance requirements pass.
  - [ ] **P0-013B — Research-admin authorization repair.** Require the canonical server-side
    administrator guard before every privileged research-library operation. Add meaningful tests
    for anonymous, athlete, coach, and admin requests across supported methods, including denial
    before any privileged read/write. Preserve legitimate admin behavior. Verify locally and in
    isolated staging before marking complete; otherwise record implementation and remaining gates.
  - [ ] **P0-013C — Dependency readiness and alerting.** Add bounded readiness checks separate
    from liveness, safe error contracts, and actionable operational alerts. Verify dependency failure.
  - [ ] **P0-013D — Relationship and data-isolation verification.** Verify cross-athlete denial,
    revoked coach access, privileged routes, staging RLS, and outstanding P0-003 real-account tests.
    Record evidence and complete the parent only after every remaining criterion passes.

  First-session scope: A plus the focused B repair if feasible; stop before C or any P0-014–018 work.
  If Supabase remains unavailable, continue B locally and document the blocked staging checks.

- [ ] **P0-014 — Reliable workout creation and logging**
  - Every create/update/complete/delete/library action reports persisted success or actionable failure.
  - Preserve drafts, clear busy states after errors, prevent duplicate submission, and support retry.
  - Directly edit/undo completion; support partial, skipped, and unplanned sessions.
  - Distinguish actual/imported values from copied planned defaults.
  - Test later device import against manual logging, mistaken matches, and timezone boundaries.
  - Returning athlete target: log completion within 30 seconds, excluding optional written notes.

- [ ] **P0-015 — One dependable messaging experience**
  - Full inbox and floating center share conversation selection, unread state, and read acknowledgement.
  - Incoming replies refresh promptly; target five seconds in an open conversation.
  - Keep per-recipient drafts, retry safely, paginate history, and preserve session-discussion links.
  - Notifications have explicit preferences, delivery state, and private content handling.
  - Verify two-account delivery, refresh, reconnect, duplicate prevention, and relationship revocation.

- [ ] **P0-016 — Athlete-first navigation and focused interface**
  - Athlete mobile navigation: Today, Calendar, Log workout, Messages, Profile.
  - Today exposes the planned session, fast check-in, and latest coach reply.
  - Preserve coach Roster/Calendar/Messages access already introduced by P0-003.
  - Converge roster, calendar, editor/logging, Today, and inbox components now, including accessible
    dialogs, labelled fields, saved/error states, readable type, and touch controls.
  - Verify a phone agenda view and non-drag editing; retain calendar context after mutations.

- [ ] **P0-017 — Defer AI and align product claims**
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

## Progress log

Add one row when an item is verified. Do not use this table for code that has not passed its exit
criteria.

| Date | Item | PR/commit | Verification evidence | Notes |
| --- | --- | --- | --- | --- |
| 2026-08-19 | Roadmap created | Local branch `agent/product-execution-roadmap` | Reconciled PR #104, current source audit, and existing roadmaps | No implementation items completed |
| 2026-08-20 | P0-001 | [PR #106](https://github.com/tadschweizer/Ultra_OS/pull/106) / `cc3c1da` | Production on `mythreshold.co`: canonical `coach_invite` links displayed invalid (404), expired (410), already-connected/used (409), and accepted states; acceptance POST returned 200; active records were confirmed in both relationship tables and appeared in the athlete account and coach roster. [Auth Smoke run #99](https://github.com/tadschweizer/Ultra_OS/actions/runs/32390037510) passed 41/41 auth tests and 12/12 Playwright tests in desktop Chromium and 390 px mobile Chromium; local invitation API tests passed 7/7 and the full suite passed 179/179. | A fresh athlete accepted the production invitation. PR #107 review later identified that the logged-out browser test stopped at auth-link inspection, so this item was reopened for the complete transition and repaired in PR #108. |
| 2026-08-20 | P0-002 | [PR #106](https://github.com/tadschweizer/Ultra_OS/pull/106) / `cc3c1da` | A production invitation sent through the existing transactional layer arrived in a real recipient inbox from `Threshold <hello@mythreshold.co>`. The message identified the coach, explained the relationship, stated the expiration, and linked to the canonical `https://mythreshold.co/join?coach_invite=...` URL. Command Center retained the copy-link control and displayed `Copied`. Automated API/regression coverage verified honest 502 failure handling while retaining the fallback link. | Live successful delivery was verified. PR #107 review later identified that failed delivery was response-only and disappeared after refresh, so this item was reopened for persistence and repaired in PR #108. |
| 2026-08-21 | P0-001/P0-002 review-gap repair | [PR #108](https://github.com/tadschweizer/Ultra_OS/pull/108) / merge `18f7047` | Invitation API and migration-schema tests passed 12/12; full regression passed 184/184; the production build generated all 35 static pages; invitation Playwright passed 14/14 in desktop Chromium and 390 px mobile Chromium, including complete login and signup return/acceptance journeys; `git diff --check` passed. Production migration `20260820202433` was applied to the UltraOS Supabase project and its columns and constraints were verified before the Vercel production deployment succeeded. Production home, join, and health routes returned 200, and an invalid invitation returned the expected 404 contract. | Delivery lifecycle is persisted separately from invitation lifecycle, failed/skipped delivery remains honest after GET refresh, and Copy Link remains available. Production schema and application deployment completed in migration-first order. |

## Parking lot

Items remain here until evidence moves them into a milestone. They are not commitments.

- Native iOS/Android apps beyond the responsive/PWA experience.
- Training plan marketplace and coach commerce.
- AI-generated plans or workouts before the manual planning model is reliable.
- Additional recovery/wellness providers after core activity and workout delivery are stable.
- Broad social/community features.
