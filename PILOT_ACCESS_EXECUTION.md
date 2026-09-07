# Pilot access execution checkpoint — 2026-09-07

Scope: P0-003/P0-013A verification, P0-013B research authorization, then P0-004/005.
No production writes, migrations, configuration changes, deployment, emails, or merges authorized.

## Stage 1: release baseline and role acceptance

- Fetched origin; main is `fcc29a01a1d98a1f38aa7ca4ec8ac169b8adeb41` (PR #112).
  No open PRs were returned. Preserved the local AGENTS.md edit and untracked output folders.
- Production read-only: Supabase `jzfctjaaowdvubhqswpa` reports ACTIVE_HEALTHY;
  SQL succeeds. Migration history contains `20260821193413`. `primary_role` is text,
  NOT NULL, defaults to athlete, and has the athlete/coach CHECK constraint.
  `is_admin` defaults false and subscription tier defaults free, both NOT NULL.
- Vercel production `dpl_Bb7AcsX3JF3uDg7THJeBtizzKPko` is READY, source `fcc29a0`,
  aliased to mythreshold.co. Project runtime is Node 24.x; repository verification uses Node 22.
- Configuration error summary reports ten /api/me errors; its last deployment is the older
  preview `dpl_BEtoszxNXmG615TpVEXo6HrrwGsT`, not the intended release. A query scoped
  to the current production deployment returned no error logs in the previous day.
  This is bounded negative evidence, not proof of all authenticated paths.
- Public production GET /api/me returned expected 401; /api/health returned 200 (liveness only).
- Local Node 22.23.2 `npm run test:roles`: 14/14 passed.

| P0-003 criterion | Evidence | Remaining gate |
| --- | --- | --- |
| Signup role persists | Source writes validated primary_role on athlete creation; email/OAuth intent tests pass | Fresh real staging signup, refresh, logout/login |
| Existing-account defaults | Live default/constraint and migration record; conservative backfill source and local regression | Staging legacy account/backfill rerun |
| Canonical server/navigation role | roleGuards, roleAccessServer and siteNavigation; focused tests pass | Real staging desktop/mobile accounts |
| Client selector cannot escalate | Server loads coach profile/admin state; role intent accepts only defined values; focused denial tests pass | Real staging forged request and direct-data denial |
| New-session persistence | Login reloads athlete; completed onboarding does not accept role intent overwrite | Real staging refresh and new browser session |

No concrete P0-003 repair identified in this review; no artificial code changes.
P0-003 remains OPEN. P0-013A baseline is verified with the following blocker recorded.
Only one Supabase project and no development branches are available through the connected account;
no isolated staging credentials were identified locally. Do not create test accounts or synthetic
check-ins in production. Real account persistence and staging RLS/authorization remain unchecked.

## Stage 2

Implemented the canonical requireAdminAthleteId guard before GET/POST/PUT/DELETE research access.
The route factory injects only the database client for tests; the real signed-session and admin
guards run. Anonymous, athlete, paid coach, administrator, and failed admin lookup cases pass
20/20 with Node 22.23.2. Denied requests make zero research-table calls; successful admin CRUD
response contracts are preserved. Added this suite to test:auth:full.
P0-013B implementation is locally verified, staging acceptance remains OPEN (stage 1 blocker).
Combined full regression/build/browser checks run after stage 3, avoiding duplicate unchanged suites.

## Stage 3

Implemented separate, expiring administrator-controlled coach pilot grants, a same-origin/live-admin
provisioning and revocation API and form, canonical server entitlement lookup, paid/pilot Coach Command
Center gating, truthful signup/pricing/upgrade/landing copy, and coach-dependent daily check-ins.
Role, pilot, paid tier and administrator authority remain separate. Pending/paused/removed/expired
relationships and revoked/expired grants confer no check-in benefit. Historical data and independent
paid athlete access remain. Failures return 503 without insertion. A separate atomic 30/minute abuse
bucket applies to every plan. See [PILOT_ACCESS_RUNBOOK.md](PILOT_ACCESS_RUNBOOK.md) for exact behavior,
operator provisioning instructions, migration order and real staging acceptance checklist.

Local Node 22.23.2: pilot handler/matrix tests 30/30; combined test:auth:full 248/248; initial build passed.
Isolated PGlite 0.5.8 / PostgreSQL 18.3 WASM: actual migration executed, 18 anon/authenticated CRUD/RPC
permission denials, RLS flags, service-role operations, expiry constraint, 30/31 rate boundary and
next-window recovery passed. This minimal-prerequisite engine is not the production PostgreSQL 17.6
or the complete migration chain. Docker daemon was unavailable. No SQL had been applied to production
at this stage; see the post-merge checkpoint below for the later authorized production application.

P0-004/P0-005 implementation is locally verified; real isolated staging acceptance remains unchecked.
Cohort size (one coach, up to five athletes) is an operator-controlled pilot condition, not a new public
billing/roster limit.

## Stage 4: combined final verification — 2026-09-07

- Node 22.23.2 `npm run test:auth:full`: **248/248 passed** after final application edits.
- Node 22.23.2 `npm run build`: **passed** after final application edits.
- Existing mocked role navigation: **5 passed**, 3 intentional viewport-specific skips.
- New pilot browser suite: **10/10 passed** on desktop Chromium and 390 x 844 mobile Chromium.
  It exercises signup/pricing, role-only denial, grant/refresh/revoke, admin form persistence in the
  in-memory adapter, seven consecutive daily check-ins with legs/energy/RPE, preserved seven-row
  history after revocation, restored free cap, and explicit entitlement-error/cache behavior.
- The browser suite uses real page rendering and handler/helper logic with an instrumented in-memory
  database and test sessions. It is **local/mocked**, not Supabase or staging acceptance. Early test
  failures were corrected to match existing label hints and numeric-string protocol storage; all
  seven saves then passed in both viewports. No production synthetic records were created.
- Browser skill smoke: local pricing renders meaningful content with no Next error overlay; initial
  navigation began before server readiness and was retried. Screenshots inspected for pricing and
  mobile provisioning; administrator mobile page has no horizontal overflow.
- Local artifacts (untracked): `output/pilot-auth-full-final.log`, `output/pilot-build-final.log`,
  `output/pilot-browser.log` (initial role results), `output/pilot-browser-final.log` (final pilot results),
  `output/pilot-admin-{desktop,mobile}-chromium.png`, `output/pilot-checkins-{desktop,mobile}-chromium.png`.
- Final origin fetch still reports main `fcc29a0`. Production read-only grant inspection found no
  anon/authenticated CRUD grants on athletes, coach_profiles, or coach_athlete_relationships.
  Residual non-CRUD REFERENCES/TRIGGER/TRUNCATE grants on relationships are recorded for P0-013D's
  broader isolation review; no privileges were changed in production.

## Stage 5: reviewable handoff

- Baseline evidence: [PR #113](https://github.com/tadschweizer/Ultra_OS/pull/113), commit `4ada51b`.
- Research authorization: [PR #114](https://github.com/tadschweizer/Ultra_OS/pull/114), commit `fafb20c`.
  Both reported successful Auth Smoke and Vercel preview checks. Preview status is not isolated
  staging or production acceptance. At this handoff, Git integration had generated previews but no
  merge, production configuration change, or production migration had been performed.
- Pilot feature: [PR #115](https://github.com/tadschweizer/Ultra_OS/pull/115), code commit `fceb053`.
  It is stacked on the research branch. Review/merge order is
  baseline → research → pilot; retarget each dependent PR to main after its base is merged.
- At this handoff, the next required action was to identify an isolated Supabase staging project plus
  matching app URL and test accounts/configuration. That acceptance requirement remains open; the
  production actions subsequently authorized by the owner are recorded below.

## Post-merge production checkpoint — 2026-09-07

- The owner merged PRs #113, #114, and #115. Vercel Git integration automatically deployed merge
  `1016373` to production as `dpl_5LdkyPxm7Ccce5ZFdq3ksEsFJP7F`; it reached READY and serves
  `mythreshold.co`.
- The application deployed before its additive database migration. Production inspection confirmed
  that both new tables, the relationship expiry column, and the rate-limit function were absent.
  Under the owner's production authorization, only the merged SQL file
  `20260907025635_pilot_coach_entitlements.sql` was applied through the Supabase migration API.
  Supabase recorded it as version `20260907234756` with name `pilot_coach_entitlements`.
- Post-migration metadata verification confirmed both tables, the expiry column, and the function;
  RLS is enabled on both tables; anon/authenticated have no table privileges or function EXECUTE;
  `service_role` can execute the SECURITY INVOKER function. Public home, pricing, and health returned
  200; anonymous `/api/me` returned its expected 401. No synthetic production check-ins or pilot
  grants were created.
- Post-merge automated review found two product defects: Individual and Research checkout links had
  been replaced by account links, and a 503 on the first `/api/me` request did not expose the
  entitlement verification error. The production-readiness repair restores only non-pilot checkout
  links, preserves the closed-pilot coach signup path, and creates an explicit fail-closed client
  state even with no warm cache. Focused browser coverage was added for both cases.
- Supabase advisors reported the expected informational no-policy notices for the new service-only
  RLS tables. Their roles have no grants, so this is intentional. Other advisor findings predate this
  migration and remain outside this scoped release.
- The post-review repair passed Node 22 `npm run test:auth:full` (248/248), `npm run build` (36 static
  pages), and the full pilot Playwright suite (12/12 across desktop and 390 px mobile). The browser
  suite includes the seven controlled-date check-in journey and remains local/mocked evidence.
