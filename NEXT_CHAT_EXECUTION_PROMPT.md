# First execution session

Select GPT-6 Astra in the new chat and paste the prompt below. This scope deliberately covers a
read-only baseline and one small security repair, not all of M0. The roadmap remains authoritative
if intervening chats have already completed these slices.

```text
Work on Threshold in C:\Users\BAS\Desktop\UltraOS\Ultra_OS, repository
https://github.com/tadschweizer/Ultra_OS. I am a beginner; explain any manual steps clearly.

Read AGENTS.md, PRODUCT_EXECUTION_ROADMAP.md, and LAUNCH_AUDIT_2026-09-06.md.
Fetch the latest GitHub state and inspect the working tree, relevant PRs, and checks before editing.
Preserve unrelated local changes. Use an isolated branch/worktree if needed, based on current main.
Treat the roadmap as the execution record, not earlier chat memory.

Execute only P0-013A and the tightly scoped P0-013B repair in this request:

1. I said I would unpause Supabase. Verify its current state rather than assuming restoration.
   Use read-only checks to establish the current GitHub/Vercel release, P0-003 migration
   20260821193413 and required schema, and whether reported /api/me configuration errors affect
   the intended deployment. Record gaps without exposing secrets or athlete data. Migration
   presence alone does not prove fresh-account role persistence or complete P0-003.

2. Fix research-library admin authorization using the existing canonical server-side admin guard.
   Inspect webapp/pages/api/research-library/admin.js and the existing auth helpers first.
   Ensure anonymous, ordinary athlete, and coach requests cannot reach privileged research reads
   or mutations. Preserve legitimate administrator behavior. Keep the change focused; do not
   refactor unrelated authentication or redesign the application.

3. Add meaningful regression tests for all supported methods, proving unauthorized requests are
   denied before privileged database access and legitimate admin operations still work. Run with
   Node.js 22 from webapp: relevant focused tests, npm run test:auth:full, npm run build, and the
   existing role-aware browser suite when applicable. Run real authorization checks in an already
   isolated staging environment if available; never test mutations against production research.
   Clearly distinguish mocks, local tests, staging checks, and production read-only evidence.

4. If Supabase/staging remains unavailable, finish the local repair and tests that do not depend
   on it, document the exact blocker, and leave live acceptance unchecked. Do not spend the entire
   request retrying an unavailable service. Never apply broad supabase db push: this repository
   has known migration-history drift.

5. Update the roadmap's date, current milestone, next item, per-slice status, and evidence. Only
   check off implementation items after their acceptance gates pass. Record commands, results,
   source commit/PR, outstanding checks, and the precise next task so a new chat can resume.
   Commit the focused changes, push the branch, and open a PR with a clear problem/change/testing
   description. Do not merge, deploy, alter production configuration, apply production migrations,
   purchase services, or send real messages/emails in this request.

Stop after these slices and their verification/handoff. Do not begin P0-013C/D, entitlements,
workout UX, messaging, AI removal, or new integrations. If A/B are already complete on GitHub,
report their evidence and the next bounded slice instead of repeating completed work.

Finish with: what changed; what passed; what remains unverified; the PR link; and the exact next
roadmap item. Do the implementation and verification, not just a plan.
```
