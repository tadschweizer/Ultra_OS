# P0-007, P0-008, P0-009 implementation checkpoint

Date: October 1, 2026. Branch: `feature/p0-007-009-mobile-onboarding`.

## Verified GitHub baseline

[PR #124](https://github.com/tadschweizer/Ultra_OS/pull/124) is merged at `e840f43`.
Its three review findings were addressed in `82de2dc`: derive coach readiness from fast
check-ins, exclude lightweight logs from daily completion, and gate the check-in form on
entitlement. GitHub auth-smoke and Vercel checks passed. The roadmap names P0-007 as the
next implementation item after the P0-006 human timing gate. P0-008/009 are the requested
adjacent truth/onboarding work.

Local `main` was fast-forwarded to `e840f43`; the older pilot branch, its three distinct
commits, the pre-existing AGENTS.md edit, and output files were preserved. The AGENTS.md
edit is not part of this implementation commit.

## Changes

- P0-007: visible basic-workspace invitation action; invitation form can be reached from
  role-aware navigation without memorizing a URL; mobile groups link.
- P0-008: public read-only integration availability endpoint returns only a boolean;
  Strava connect links fail closed on unavailable configuration; one entry per provider;
  unfinished wearable logins stop before OAuth; callback errors omit configuration names;
  fictional TrainingPeaks migration progress removed; onboarding confirms stored Strava
  identity before displaying success or automatically completing setup.
- P0-009: canonical ongoing coach linking at `/account#coach-connection`; honest approval
  state; corrected empty-state directions; groups included in protected routes; actionable
  missing-field errors and retained answers/step on save failure; corrected import follow-up
  copy after removing the fictional migration screen.
- New regression coverage runs in GitHub Auth Smoke. Next.js's development badge is disabled
  only under `PLAYWRIGHT_TEST=1` because it otherwise covers the mobile Roster tab.

## Local evidence

Commands run from `webapp` with Node 22:

```powershell
npx --yes --package=node@22 node --test tests/*.test.mjs
npx --yes --package=node@22 node node_modules/@playwright/test/cli.js test --workers=1
npx --yes --package=node@22 -c "npm run build"
```

- Node tests: 270 passed, zero failures.
- Full Playwright suite: 48 passed, four intentional viewport-specific skips, zero failures.
  Includes first invitation, coach mobile navigation, groups, safe unavailable integration
  states, unique providers, configured Strava link, incomplete onboarding fields, failed-save
  retention, forged connection-success query, plus earlier invitation/role/pilot/check-in suites.
- Production build: succeeded, 37 static pages generated.
- `git diff --check`: passed.
- `scripts/qa-browser.ps1 -Mobile`: both real production logins succeeded; `/api/me` verified
  the correct account IDs and primary roles after clearing browser cookies and logging in again.

These browser regression tests use isolated/mocked data, not production persistence.

## Approved real production QA

The owner explicitly approved the labeled coach/athlete pair. See `QA_ACCOUNTS.md` for
the scope and repeatable login command. Real browser logins, athlete-initiated coach request,
coach approval, active relationship persistence, and an athlete daily check-in succeeded.
Read-only `/api/me` confirmed the saved date. Both roles were verified again in separate
390 px sessions; Command Center, coach Calendar, Messages, Account, and Groups showed the
Roster tab and no horizontal overflow.

Live blockers (before deploying this branch):

| Route | Observed result | Next investigation |
| --- | --- | --- |
| `/api/coach/messages?mode=coach` | 500, missing `public.coach_messages` | Trace the historical message migration and prepare a targeted schema repair |
| `/api/athlete/shared-docs` | 500, missing `public.coach_shared_docs` | Trace the shared-document migration and schema prerequisites |
| `/api/current-protocol-assignment` | 500, nonexistent `athletes.target_race` | Align the query with canonical race storage after checking legacy fallback behavior |

No messages were sent, no real users were changed, and no production schema/configuration
repair was applied. Full workout/protocol/document/message acceptance is still open.
P0-006 also still needs a returning human athlete's timing; automated test completion does
not close that criterion. P0-007/008/009 remain unchecked pending review, release, and live acceptance.
