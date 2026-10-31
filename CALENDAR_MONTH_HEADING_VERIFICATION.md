# Mobile calendar month headings

October 31, 2026. Implementation d95d7781257fd3fe658de7b285252070fa05add9, isolated branch codex/calendar-month-headings from main 72a2f63.

The phone list reused the desktop week-level month divider. A week crossing a month boundary therefore displayed the new month's heading before the previous month's final days. Empty phone days are hidden, so positioning a heading only on calendar day one would also lose it when that day has no entries.

Phone headings now precede the first visible entry of each month, considering workouts, imported activities, notes and events across all loaded weeks. Calendar data and empty-day behavior are retained. At 640 pixels and wider, the existing week divider and seven-column grid remain in place; the mobile divider is hidden and adds no grid cell. Headings recompute when visible calendar data changes or earlier weeks load. No database, permission, provider or training-record mutation is required.

Local verification on Node 22.23.4:

- All eight new browser cases failed against the original presentation: October appeared before September 29/30 and irrelevant empty-month headings were present in the phone list.
- Ten month-heading/load-layout cases passed after the change. Final eight month cases passed again with explicit seven-cell row geometry at 768 and 1440 pixels, alongside 320/390-pixel month/year ordering, coach and athlete paths, hidden first days and reload/no-duplicate assertions. A hidden/visible duplicate-text test selector was corrected; assertions were retained. An overlapping test-start attempt was rejected by the isolated port and discarded; accepted runs use a fresh isolated server, never the unrelated local analysis server.
- 531 authentication/critical regressions, webpack production build, whitespace and detector checks passed. Phone screenshots were inspected: September 29 and 30 precede the October divider and October 3.

Commands from webapp using the repository's Node runtime: npm run test:auth:full; npm run build -- --webpack; Playwright runs e2e/calendar-month-headings.spec.mjs and e2e/calendar-load-layout.spec.mjs with a temporary repository-derived config on isolated port 3174, reuseExistingServer=false. CI has a dedicated month-heading step in Auth Smoke.

Release requires passing exact-head CI and independent review, normal merge/deployment, then read-only live responsive checks. Do not claim local synthetic checks as physical-phone or owner acceptance. This focused presentation fix is covered by the standing owner-feedback release authority; it does not authorize the separate uploaded-review database migration or local-only analysis release. No production records or third-party messages are used for testing. Final owner acceptance stays open.
