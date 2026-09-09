# Next execution session — no-cost real-user acceptance

Updated 2026-09-09. The previous baseline/research-only prompt was expanded by the owner to include
P0-003 verification and P0-004/P0-005. Implementation is now recorded in PILOT_ACCESS_EXECUTION.md;
use that record and the linked PRs rather than repeating completed local work.

```text
Work on Threshold in C:\Users\BAS\Desktop\UltraOS\Ultra_OS.
Fetch GitHub state. Read AGENTS.md, PRODUCT_EXECUTION_ROADMAP.md,
PILOT_ACCESS_EXECUTION.md, and PILOT_ACCESS_RUNBOOK.md. Preserve unrelated local changes.

Continue only the remaining acceptance of P0-003, P0-013B, P0-004/P0-005. PRs #113-#115 are
merged and Vercel deployed merge 1016373. The production migration SQL file
20260907025635 was applied through the Supabase migration API and recorded by Supabase as
version 20260907234756. Review repair PR #117 merged as cf55e73 and deployed to production as
dpl_BTcjsEhdznGe1G6uvShkUCJe8fae. Read the post-merge checkpoint before proceeding. Do not repeat
completed local checks without a reason. PR #119 contains the complete delayed-review repair and
merged as b4339f1. Production deployment dpl_Fw9hoWzgs6fS5mDNLwsMJef7uuWv reached READY on that
exact source. It fails closed on cold entitlement errors, preserves only approved
Individual/Research checkout intent through login and Google/Strava onboarding, and denies coach
checkout at the server endpoint. Final Node 22 local evidence is 251/251 authorization tests, a
36-page build, and 12/12 pilot browser journeys across desktop and mobile. Production read-only
checks passed, but they do not replace the real-user gates below.

Do not create a paid Supabase branch or other paid staging service. The owner declined additional
spend on 2026-09-09. Use local tests for synthetic, forged, expiry, and destructive cases. Use
production only for normal activity by specifically approved pilot participants.

Complete the unchecked no-cost runbook gates as specifically approved pilot participants become
available: role signup/refresh/new session, administrator pilot provision/revoke, seven normal daily
check-ins, and desktop/mobile. Preserve historical data and independent paid access. Keep forged
privilege, expiry, abuse, and destructive research CRUD checks in local automated tests.

Fix concrete defects with focused tests, keep reviewable commits, and update roadmap statuses
and the execution checkpoint. Mark items complete only after their required real-account gates pass.
Keep P0-013C/D broader work, workouts, messaging, AI removal, integrations, public trial and
billing overhaul outside scope. Do not create paid infrastructure or provision a named pilot coach
without explicit authorization.

Finish with scoped item status, tests/evidence, remaining gates, PR links, and the exact next action.
```
