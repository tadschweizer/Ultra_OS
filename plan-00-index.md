# Execution Plans — Index & Priority Order

Ten self-contained plans, written so a less capable model can execute each without asking questions. Each plan has: goal, exact files, step-by-step order, edge cases, and verifiable acceptance criteria.

## Priority order (do them in this order)

| # | Plan | Why this rank |
|---|------|---------------|
| 1 | [plan-01-signed-session-cookie.md](plan-01-signed-session-cookie.md) | **Critical security hole**: auth is a plaintext, unsigned, non-httpOnly `athlete_id` cookie; coach APIs hand out athlete UUIDs, so any coach can impersonate any roster athlete today. Blocks everything else. |
| 2 | [plan-02-unify-api-auth-guard.md](plan-02-unify-api-auth-guard.md) | Ship in the SAME deploy as plan-01 — ~50 routes parse the cookie by hand and would break/bypass the fix otherwise. Also audits coach-authorization on client-supplied athlete ids. |
| 3 | [plan-03-complete-account-deletion.md](plan-03-complete-account-deletion.md) | "Delete account" currently leaves data in a dozen tables, the Supabase auth user alive, and Stripe billing running. GDPR/pre-launch requirement. |
| 4 | [plan-04-planned-vs-completed-reconciliation.md](plan-04-planned-vs-completed-reconciliation.md) | First ❌ in the TrainingPeaks parity matrix — your own declared release gate. Building blocks already exist in `lib/workoutCompliance.js`. |
| 5 | [plan-05-coach-import-health-dashboard.md](plan-05-coach-import-health-dashboard.md) | Second parity ❌. `trainingpeaks_import_jobs` data exists; nothing surfaces it to coaches. |
| 6 | [plan-06-correlation-engine-tests.md](plan-06-correlation-engine-tests.md) | The correlation engine (the product moat) has zero tests. Cheap, protects plans 07–08, and flushes a timezone bug. |
| 7 | [plan-07-load-spike-insight.md](plan-07-load-spike-insight.md) | Highest value-per-effort AI-roadmap item: needs no new external APIs, reuses the TRIMP/ATL/CTL engine already built. |
| 8 | [plan-08-hr-drift-decoupling.md](plan-08-hr-drift-decoupling.md) | The top two AI-roadmap analyses; Strava streams plumbing already exists for altitude — extend to HR/pace. |
| 9 | [plan-09-coach-followup-unmapped-imports.md](plan-09-coach-followup-unmapped-imports.md) | Third parity ❌; depends on plan-05's data path and the existing message center. |
| 10 | [plan-10-admin-impersonation-and-health.md](plan-10-admin-impersonation-and-health.md) | Needed once the first cohort is in; must come after 01–02 or it widens the security hole. Includes the `/admin` N+1 fix. |

## Batching guidance

- **Deploy 1 (security)**: plans 01 + 02 together, then 03. Nothing ships to external users before this.
- **Deploy 2 (parity gate)**: plans 04 + 05 (09 can follow immediately after 05).
- **Deploy 3 (product depth)**: plans 06 → 07 → 08 (06 first — it hardens the foundation the other two extend).
- **Deploy 4 (operations)**: plan 10, right before/as the first cohort onboards.

## Stale docs note

`NEXT_STEPS_AND_UX_REVIEW.md` lists several items that are ALREADY shipped (research search, PubMed links, delete-account UI, log-intervention date default, insights progress copy, invite system, admin page). Don't re-do them; the plans above reflect the actual current state of the code as of 2026-07-10.
