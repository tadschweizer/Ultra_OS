# Athlete invitation and onboarding simplification

Updated: October 19, 2026. Status: implemented and tested locally; not deployed.

## Problem and resulting flow

The old onboarding initialized coachConnection to null and never loaded existing links. An athlete who had accepted a personal invitation could therefore be asked for a coach code again. Invitation signup also still displayed role choices. The athlete wizard counted up to five steps and put race selection before connections.

The revised flow is: personal invitation → athlete account → explicit invitation acceptance → Connections → optional About you → Calendar. Returning athletes go from acceptance directly to Calendar. Coach setup still opens the coach roster.

- Personal invitation signup fixes the athlete role and removes redundant choices.
- Connections reads active and pending links from the existing authenticated API. It shows the coach name and accurate status, with a retry when lookup fails. Manual codes still require coach approval.
- Optional activity accounts appear first. Strava uses server-reported availability and an OAuth destination that returns incomplete accounts through onboarding. Garmin and COROS are labeled unavailable; no new provider support or production configuration is introduced.
- Race entry, years-racing requirements, elevation entry, and automatic geolocation are removed from onboarding. Existing saved race, experience and elevation values are carried through completion.
- About you has optional sports and training hours, with additional sport groups expandable. Back preserves entered answers. Failed saves preserve inputs and offer another submission.
- Completion clears the shared account cache before opening training, preventing stale onboarding state from sending the athlete back. A Strava query parameter never completes setup automatically.
- Google signup now recovers from network exceptions instead of leaving the button busy indefinitely.

## Verification

Commands run from `D:\UltraOS\Ultra_OS\webapp` using Node 22:

```powershell
npx --yes node@22 node_modules/@playwright/test/cli.js test e2e/onboarding-streamlined.spec.mjs e2e/coach-invitation.spec.mjs e2e/pilot-ux.spec.mjs --workers=1
npx --yes node@22 --test tests/coach-invitation-api.test.mjs tests/role-access.test.mjs tests/auth-password-reset.test.mjs tests/strava-lifecycle.test.mjs
```

- Final combined browser run: 36 passed, desktop and mobile Chromium.
- Focused regression run: 57 passed.
- WCAG A/AA automated checks on both new onboarding screens passed in both viewport projects; insufficient small-text contrast found on the first run was fixed.
- Browser coverage includes email signup/login invitation return, duplicate acceptance suppression, invalid/expired/used invitations, coach persistence through signup and setup, pending manual requests, failed lookup/retry, optional profile completion, retained answers after failed save, Back, existing-race preservation, server-confirmed Strava state, and coach finish routing.
- Inspected desktop and phone screenshots. No horizontal overflow in tested onboarding screens. Screenshots: `webapp/output/playwright/onboarding-{connections,profile}-{desktop,mobile}-chromium.png`.
- Scoped `git diff --check` passed.

Browser tests use intercepted API fixtures; API regressions use isolated fixtures. They do not prove real signup/email delivery, Google/Strava provider authorization, production database linking, or physical-phone usability. A full production build was not run in this session. No provider or production service configuration changed.

## Release handoff

Changes remain uncommitted in the existing mixed working tree on `codex/m0-reliability-billing-persistence`. No PR/commit or deployment is claimed. Changed application files: `webapp/pages/onboarding.js`, `webapp/pages/signup.js`, `webapp/pages/join.js`. Tests: `webapp/e2e/onboarding-streamlined.spec.mjs` and `webapp/e2e/pilot-ux.spec.mjs`. Roadmap updated without closing M0 gates.

Before release, isolate these changes from unrelated work, run release checks on that exact branch, and obtain the owner's production authorization. After authorized deployment, use one real new athlete invitation to verify account creation, consent, connected coach, provider return, and first calendar visit on a physical phone. Preserve completed-session analysis and existing participant gates as separate work.
