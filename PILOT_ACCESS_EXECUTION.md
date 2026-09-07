# Pilot access execution checkpoint — 2026-09-06

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

Next: require canonical administrator authorization before research operations; test every method.

## Stage 3

Pending: implement pilot entitlements and coach-dependent check-ins together after stage 2.
