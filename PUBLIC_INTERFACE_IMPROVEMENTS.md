# Public interface improvements

Updated October 20, 2026. Owner authorized all five findings from the October 19 Impeccable review. Implementation commit: `d485634`, on `codex/public-interface-improvements`, based on current main `c04c814`, in the managed `public-interface-improvements` worktree. The older D: working checkout and its unrelated uncommitted work were preserved.

## Changes

1. **Consistent athlete access:** home, the free-access page and signup share `athleteAccessMessage()`, which follows the existing `NEXT_PUBLIC_ATHLETE_OPEN_ACCESS` release switch. The switch-off explanation retains normal tier limits. Coach approval remains separate. No entitlement, billing, relationship or provider behavior changed.
2. **Accessible forms and mobile menu:** signup Name/Email and login Email have associated labels; signup roles use native radios and a fieldset/legend. Errors announce through an alert, session checks have a visible status, and failed network requests preserve entries. The native mobile dialog makes background content inert, moves focus into the menu, wraps Tab/Shift+Tab, restores focus on close, and closes when entering the desktop layout. Signed-in athlete/coach destinations are retained.
3. **Coaching walkthrough:** the Guide now follows planning, completion, feedback and the next coaching decision. PublicHeader provides consistent home/public links across the reviewed pages. Optional research, interventions and related reference links remain available in expandable sections.
4. **Actual product evidence:** the home and guide use a screenshot of the real `TrainingCalendar` workout-detail interface, populated entirely with fictional intercepted API responses. It shows planned duration, actual completion, athlete feedback and a coach reply. The screenshot is labelled, has a text alternative, and opens at full size. Repeated workflow prose was removed; the athlete entry link and current free-access explanation appear before the screenshot on mobile.
5. **Relevant public mobile navigation:** anonymous visitors receive coach-pilot, athlete and sign-in actions; intervention logging stays in the signed-in athlete menu. The public menu is compact. Duplicate trust footers on the home/free-access page were removed and shared trust links have comfortable touch targets.

The original visual identity is retained: restrained navy/neutral surfaces, existing display typography and familiar controls. Decorative hero framing was simplified around the real product example.

## Verification

All verification used Node 22.23.3 and local test/build credentials. No production submissions or configuration changes occurred.

| Check | Result |
|---|---|
| Complete `test:auth:full` regression suite | 493 passed |
| Existing onboarding and role-aware browser coverage | 15 passed, 3 intentional viewport-specific skips |
| Public-interface and existing free-access browser checks | 14 passed across desktop/mobile Chromium |
| Release switch disabled: public pages and signup | 2 passed; paid-tier fallback remains available |
| Production build, open-access mode | Passed; 41 static pages generated |
| Production-bundle page/navigation and mobile-menu smoke | 2 passed |
| Impeccable detector across 14 changed markup files | Zero findings |
| Whitespace/diff check | Passed |

New tests cover anonymous and authenticated menus; forward/reverse focus containment, Escape, route changes and desktop resize; native roles and accessible names; failed auth submissions and retained inputs; access-copy consistency; screenshots loading; navigation and headings; layouts at 320, 390, 768 and desktop widths. Automated axe checks report no violations in the tested public views, forms or open menu. A cached-account hydration issue found during verification was fixed and now has a browser error regression assertion.

Visual inspection included the desktop homepage and guide, the mobile homepage, signup error state and open menu. The full screenshot asset is 576 x 1110 pixels and approximately 56 KB.

Local evidence:

- `webapp/output-public-regression.log`
- `webapp/output-public-open-final.log`
- `webapp/output-public-paid.log`
- `webapp/output-public-build.log`
- `webapp/output-public-built-browser.log`
- `webapp/output-public-detector.json`
- `webapp/output/public-interface/`

Initial browser checks exposed an ambiguous test selector (Next's own route-announcer also has alert semantics), a dialog Tab-boundary issue, and cached-account hydration mismatch. These were corrected; final results above refer to the corrected implementation. The preserved early logs are diagnostic history, not the final acceptance record.

## Reproduce

From this branch's `webapp` directory:

```powershell
npm ci
npm run test:auth:full
npm run test:e2e:public-interface
```

The dedicated browser configuration starts and stops its own server on `127.0.0.1:3040` with dummy local credentials and free access enabled. To check the switch-off path:

```powershell
$env:PUBLIC_INTERFACE_PAID_MODE = '1'
npx playwright test e2e/public-interface.spec.mjs --config playwright.public-interface.config.mjs --project desktop-chromium --grep 'public pages|signup has' --workers=1
Remove-Item Env:\PUBLIC_INTERFACE_PAID_MODE
```

To regenerate the fictional product screenshot from actual application components:

```powershell
$env:CAPTURE_COACHING_EXAMPLE = '1'
npx playwright test e2e/capture-coaching-example.spec.mjs --config playwright.public-interface.config.mjs --project desktop-chromium --workers=1
Remove-Item Env:\CAPTURE_COACHING_EXAMPLE
```

The capture test intercepts every API request. It neither signs in to a real account nor alters athlete records. The new public-interface suite is included in the Auth Smoke workflow.

## Release boundary

Implementation and local verification do not establish deployed behavior, physical-phone acceptance, or screen-reader usability with actual assistive technology. No production deployment or service change was authorized by this work. Real invited-athlete, mailbox/provider and participant gates remain open.

The test-managed local servers completed and stopped normally. Automatic approval review subsequently blocked a persistent local preview-server launch without a more specific reason. Verified screenshots remain available under `webapp/output/public-interface/`.
