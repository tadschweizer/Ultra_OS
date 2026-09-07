# Next execution session — isolated staging acceptance

Updated 2026-09-07. The previous baseline/research-only prompt was expanded by the owner to include
P0-003 verification and P0-004/P0-005. Implementation is now recorded in PILOT_ACCESS_EXECUTION.md;
use that record and the linked PRs rather than repeating completed local work.

```text
Work on Threshold in C:\Users\BAS\Desktop\UltraOS\Ultra_OS.
Fetch GitHub state. Read AGENTS.md, PRODUCT_EXECUTION_ROADMAP.md,
PILOT_ACCESS_EXECUTION.md, and PILOT_ACCESS_RUNBOOK.md. Preserve unrelated local changes.

Continue only the remaining acceptance of P0-003, P0-013B, P0-004/P0-005. Review the stacked
baseline → research authorization → pilot access PRs and current CI/review findings first.
Local implementation, 248 regression tests, SQL engine checks, and desktop/mobile mocked
journeys are already recorded. Do not call these staging or production acceptance.

Identify an already isolated Supabase/Vercel staging environment and verify its identity before
any write. The previous connected account exposed only production and no Supabase branches.
If none exists, identify the exact provisioning/configuration authorization needed; do not
create paid services, deploy, or use production accounts as substitutes.

When isolated staging is available within the owner's authorization, apply only the reviewed
20260907025635_pilot_coach_entitlements.sql migration there, with prerequisite schema verified.
Never use broad supabase db push. Use real staging coach/athlete/admin accounts without sending
real emails. Complete every unchecked runbook gate: role signup/refresh/new session, forged
privilege denial, research CRUD authorization for all four roles/methods, administrator pilot
provision/revoke, entitlement matrix, seven controlled daily check-ins, and desktop/mobile.
Preserve historical data and independent paid access. Test actual RLS with Supabase tokens.

Fix concrete defects with focused tests, keep reviewable commits, and update roadmap statuses
and the execution checkpoint. Mark items complete only after their required staging gates pass.
Keep P0-013C/D broader work, workouts, messaging, AI removal, integrations, public trial and
billing overhaul outside scope. Any production migration, configuration, merge or deployment
requires separate explicit authorization. Prepare exact reviewed changes before requesting it.

Finish with scoped item status, tests/evidence, remaining gates, PR links, and the exact next action.
```
