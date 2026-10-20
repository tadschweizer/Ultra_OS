# Completed-session analysis

October 18, 2026. Local implementation; no production deployment, migration, or service configuration change. Existing uncommitted work was preserved. No commit or PR was created from this mixed working tree.

Open Calendar, then select a completed workout or an imported activity without a plan. Both athlete and linked-coach calendars use the same Workout analysis panel.

Implemented:

- Synchronized pace (running/walking/hiking), speed (other sports), heart rate, power, cadence and elevation charts when recorded channels exist. Pointer inspection and a keyboard/touch slider share the same timestamp.
- Numeric start/end selection and full-session reset, with time-weighted statistics, distance, pace, channel coverage and missing-data states.
- Kilometer/mile splits with interpolated distance boundaries and a labelled partial final split; recorded provider laps select the corresponding chart range.
- Highest average power (or speed if power is absent) over 30 seconds, 1 minute, 5 minutes and 20 minutes. Windows start at recorded samples, include stops and require complete channel coverage.
- Heart-rate time distribution using the athlete's explicitly saved thresholds; absent or unordered thresholds do not produce assumed zones.
- Assigned workouts compare planned and actual duration/distance. Fixed-duration, non-repeating steps can be inspected against elapsed recording time, with original targets displayed. No automatic execution or compliance score is inferred.
- Manual completions retain their actual values and plan comparison, with an explicit explanation that no recording exists.
- A private, no-store API authorizes the activity owner or an active linked coach, checks private-workout visibility and the linked activity's owner before accessing provider credentials. Only normalized sensor channels, lap boundaries, three HR thresholds and minimal activity totals leave the server.

Calculation rules: each sample represents the interval until the next sample. Intervals longer than 30 seconds are missing coverage, not interpolated effort. Distance uses interpolated cumulative-distance differences. Missing/blank sensor readings stay missing, and zero power stays zero. Statistics use elapsed recorded time, not moving-only time. Chart drawing is reduced to approximately 1,200 points per channel; calculations retain the original samples up to the explicit 200,000-sample input limit. Recordings exceeding that limit show a warning.

Limits and release acceptance:

- Detailed recordings currently load through the existing Strava connection when its configuration is available. Other-provider and disconnected records keep their saved summaries with a missing-samples explanation. This work does not enable a provider.
- Live participant recordings, a physical phone, and production coach access have not been exercised. Browser tests use labelled synthetic fixtures and API tests inject the data source. Those tests do not establish live provider availability.
- Planned steps are aligned by elapsed time from recording start; pauses, a late start, distance-based steps and repeated/open blocks require manual lap review. There is no automatic interval detection or claim of structured execution matching.
- No route map, FIT-file ingestion, FTP/power-zone model, normalized power, TSS, training recommendation, or full Intervals.icu/TrainingPeaks parity is claimed. Existing `trainingLoad.js` uses TRIMP under legacy TSS names, so this panel does not reuse those values as comparable TSS or IF.
- Release remains subject to owner authorization. M0 participant, mailbox and phone acceptance gates remain open.

Verification:

- Node 22.23.3 full regression suite: 492 passed, zero failed, including 11 new session-analysis tests. `webapp/output/session-analysis-regression.log`.
- Focused calculation, stream, comment and workout-match suite: 62 passed, including isolated PostgreSQL match tests.
- Desktop and 390px mobile browser suite: 16 passed across session analysis and existing weekly planning/review; final focused session-analysis rerun passed all 6 checks after pace-chart and wrapping changes, recorded in `webapp/output/session-analysis-browser.log`. Desktop and mobile screenshots were visually inspected.
- Final-source production compilation/build passed locally; log at `webapp/output/session-analysis-build.log`. All 11 focused calculation/API tests passed again on Node 22 after the final changes. Scoped diff whitespace check passed.
- Screenshots: `webapp/output/session-analysis/assigned-desktop-chromium.png`, `assigned-mobile-chromium.png`, `unassigned-desktop-chromium.png`, `unassigned-mobile-chromium.png`.

Reproduce from PowerShell in `D:\UltraOS\Ultra_OS\webapp`:

```powershell
npx -y node@22 --run test:auth:full
npx playwright test e2e/session-analysis.spec.mjs e2e/weekly-workflow.spec.mjs --workers=1
npx -y node@22 node_modules/next/dist/bin/next build
```

Reference workflows: [Intervals.icu activity analysis](https://www.intervals.icu/features/analyze/) and [TrainingPeaks file analysis](https://help.trainingpeaks.com/hc/en-us/articles/208916857-How-to-Analyze-a-file-in-TrainingPeaks). These informed synchronized channel inspection, interval selection and distribution views; they are not evidence of feature parity.

## October 20 release preparation

Owner authorized deployment. Release branch: codex/completed-session-analysis-release, based on current main c04c814 in D:\UltraOS\session-analysis-release. Only this feature is transferred; newer copy-week, onboarding and free-access changes remain intact. Session analysis tests are included in both full regression and critical browser CI scripts. No database migration or provider enablement is included. Exact-head CI and production evidence follow after verification.


## October 20 production release

Owner-authorized release merged in PR #145, merge 9da585458e3f3d4c8860028d0235cfbb2553ecc4. Exact PR head cd70016408b4c3494a5f417c2c9fc0bba28facbe passed Auth Smoke run 39451538194: 504 regression tests, 4 integration checks, 207 desktop/mobile journeys (3 skipped), 6 calendar acceptance checks, 2 free-access/public-copy checks, and the production build. The initial run exposed an ambiguous completion-test status locator; the test now specifically identifies Saved while preserving the accessible analysis loading status.

Vercel production deployment dpl_8MPcctvLJzoUQyiKaSjc2zVvJmNF is READY. GitHub deployment 7204670897 maps the exact merge SHA to https://ultra-os-tb77-agvzui02b-tadschweizers-projects.vercel.app; mythreshold.co and www.mythreshold.co resolve to this release in Vercel. No migrations, provider enablement, or service configuration changes were made.

Read-only signed-in production verification: an existing unassigned Strava session loaded real pace, HR, power, cadence and elevation timelines, selected-session statistics, best efforts and saved-threshold HR distribution. The recording had gaps and correctly withheld continuous-distance splits. Two existing assigned sessions displayed planned-versus-actual comparisons but were unconfirmed suggested matches; the server correctly rejected completed-workout analysis because the saved workouts are not completed. Follow-up: reconcile the suggested-match UI with the completed-analysis state so it explains confirmation clearly. No matches, completions or feedback were changed during verification. Confirmed assigned completion is covered by fixture tests, not a real production participant check. Physical-phone and separate linked-coach acceptance remain open.

Previous production rollback target: dpl_9hapxUo3FvFHDjz6749tQ1y3Ya6U. M0 participant, mailbox and phone gates remain open.