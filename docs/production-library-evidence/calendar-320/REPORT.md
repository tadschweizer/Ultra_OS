# Athlete calendar load strip: narrow responsive correction

Baseline: PR135 `17ad6dbbe49cad27f8ca6e49ee4d428012c66280`, tree `c3596f79ea18ff6022029b697d25a0d1b68170cf`, main `5554087624bd48bba2e5bd42ee364655c0101fc6`. Independent QA had cleared both messaging follow-ups and identified this unchanged adjacent layout defect. This session used its own task4 checkout; canonical, demo-owner and independent-QA files were not modified.

## Reproduction and result

Production bundle, Chromium desktop/mobile, real signed `/api/me` and `/api/planned-workouts` handlers with isolated PGlite. No external database/provider/account. Unknown API calls return 501; external requests are blocked and asserted absent. Empty actuals and 35 min / 5.1 km / RPE 7 completion are database fixtures. The long label is a disclosed display-only synthetic response override; calculated load values remain unchanged.

| Requested width | Fixture | Before page width / last card edge | After page width / last card edge |
| --- | --- | --- | --- |
| 320 | Empty actuals | 348 / 347.52 | 320 / 264.66 |
| 320 | Recorded actuals | 362 / 361.03 | 320 / 264.66 |
| 320 | Long unbroken status | 684 / 683.59 | 320 / 279 |
| 390 | Empty actuals | 390 / 349 | 390 / 305.25 |
| 390 | Recorded actuals | 390 / 361.03 | 390 / 264.66 |
| 390 | Long unbroken status | 685 / 683.59 | 390 / 349 |
| 1440 | All three cases | 1440; cards inside viewport | 1440; cards inside viewport |

Baseline: one desktop test PASS, one mobile test FAIL (expected negative reproduction), covering all nine cases. Fixed: eight browser tests PASS, comprising two new layout tests and six existing calendar copy/privacy/load tests. Production build PASS. Values/text exactly match fixture-handler responses; all four cards are visible and within the requested width. Fixed labels have no internal horizontal text overflow, hidden ancestor, clipping or truncation. Screenshots visually checked at 320px with recorded actuals.

`webapp/pages/calendar.js` changes only three className strings: wrap the strip, allow shrinking, cap card width and wrap unbroken text. No load calculation, status label, API, auth, schema or feature change. `webapp/e2e/calendar-load-layout.spec.mjs` reproduces the above cases and joins the existing critical browser suite without removing any prior tests.

## Commands

From `webapp`, `npm run build`; then `PW_DISABLE_TS_ESM=1 CALENDAR_LAYOUT_STAGE=baseline npx playwright test --config playwright.calendar-layout.local.mjs e2e/calendar-load-layout.spec.mjs --workers=1 --output ../output/calendar-load-layout/baseline`. Repeat build after the CSS change, then stage=fixed and include `e2e/calendar-gaps.spec.mjs`. Local config is an uncommitted copy of the normal Playwright config: fresh server on 127.0.0.1:3169, `reuseExistingServer:false`, `npm run start -- --hostname 127.0.0.1 --port 3169`, synthetic local environment.

Evidence beside this report includes baseline/fixed logs, measurements and selected screenshots. Traces remain in the task4 ignored output directory. The first harness attempt used the wrong missing-value dash; corrected before the meaningful baseline. Mobile `innerWidth` expands under overflow, so assertions correctly compare to the requested viewport width.

Acceptance: all nine scenarios fit, complete label/value content remains readable, existing calendar semantics pass, build and fresh published-head CI pass. Independent new-head QA and physical-device acceptance remain separate. Production database approval is pending; no merge, migration, production deployment/configuration or participant operation was performed.
