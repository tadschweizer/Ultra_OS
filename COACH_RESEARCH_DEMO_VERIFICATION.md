# Coach demo verification — updated 2026-10-09

## October 9 product-fidelity revision

Reference source: fetched remote main `1830b14`, with `DesktopSidebar.js`, `MobileBottomNav.js`, `siteNavigation.js`, `globals.css`, `tailwind.config.js`, and coach / athlete page source. The demo remains in `demo/coach-research`; unrelated local application work was left untouched.

| Product area | Demo coverage | Boundary |
| --- | --- | --- |
| App shell | Actual mountain favicon, grouped Coaching / My Training / Platform / Help / Account navigation, cream sidebar, amber accents, pill buttons, rounded cards, race countdown, mobile bottom tabs and Navigation menu | Static shell adapted from the source, not a production signed-in session |
| Command Center | Triage questions/feed/roster, Load Trends, Notes, Alerts, KPIs, Basic/Advanced depth | Historical metrics and alerts are fictional fixtures |
| Advanced workspace | Protocols with dates/targets/status, invitation preview, template links, shared text documents, coach profile | No email delivery or account creation |
| Coach Groups | Create group, edit membership, assign a workout or protocol to each group member | Assignments affect only the visitor’s demo calendar |
| Coach Tools | HR zones (three methods), Riegel prediction, training paces, cycling power, swim CSS, pace conversion, fitness ramp planner | Product formulas with editable sample inputs; no automated prescription |
| Athlete file | Training, notes, messages, check-ins, readiness domains, shared documents, sample TrainingPeaks import report | No real athlete or file import |
| Training / races | Dashboard, check-in, intervention logs/history, progress, exploratory sample comparison, race creation/editing, saved race strategy | Demo-depth forms; no causal inference from fixtures |
| Research / connections | Search sample reading, save and read summaries, inspect provider and import status | Entries are explicitly illustrative; no live PubMed or device connection |
| Account / help | Persist profile/baselines/preferences, mark notifications read, pricing reference, support, feedback export | No purchase, deletion of real accounts, or real notification delivery |

Final browser verification passed **128 checks**: 45 existing daily-loop checks plus 83 added feature and viewport checks. The latter cover group assignments, literal document rendering, invitation non-delivery, calculator results and invalid input, race/blueprint persistence, intervention history, daily check-in, saved reading, profile and notification preferences, reset of new fixtures, and all 27 routes at 390 px and 320 px. No browser JavaScript errors or remote application requests occurred. A calculator-grid overflow at 320 px was corrected and the complete checks rerun successfully. Desktop and mobile screenshots were visually inspected.

Evidence: `scripts/coach-demo-feature-check.js` and updated `scripts/check-coach-demo.ps1`; raw log `output/coach-demo/browser-check-v2.log`; screenshots `desktop-v2.png` and `mobile-v2.png`. Syntax checks on both JavaScript bundles and `git diff --check` pass. This is desktop/mobile-browser verification, not a physical-phone test.

Sites confirmed version 2 deployment **succeeded** on October 9 at https://threshold-coach-research.tadschweizer.chatgpt.site, using pushed source `fe93e2015d3f255e8e401752b32aae7947238a01`. The exact seven-file archive was saved against that commit. Publication IDs are recorded in `coach-demo/site-hosting.json`. The existing public audience and URL are preserved. This is demo publication evidence, separate from real-product acceptance.

## Original October 7 baseline

Scope: `coach-demo/` only, based on remote main `a9d83c2` in the separate `demo/coach-research` worktree. The main application and its authentication are unchanged. Browser validation used Node 22 and the Playwright CLI against the standalone local static server.

## Local evidence

- `node --check coach-demo/app.js` passed.
- `git diff --check` passed.
- Browser verification passed **45 checks**, with **zero JavaScript errors** and no outbound application requests to remote services.
- Verified roster search and filtering, check-in reviewed state, note persistence on reload, safe literal rendering of markup in notes/comments, dialog opening and Escape dismissal, moving a workout from Thursday to Friday, adding a workout in another week, editable message starters, separate athlete conversations, library assignment, protocol assignment, and athlete completion reflected in shared demo state.
- Feedback autosaves across reload. Download creates `threshold-coach-feedback.txt` with the answers. Exploration counts are excluded by default and included only after checking the participant's sharing option. The actual downloads were inspected as text.
- All ten views fit within **390 px** and **320 px** viewport widths. Desktop and mobile screenshots were visually inspected. This is browser verification, not a physical-phone test.
- Reset cancellation retains answers; confirmed reset restores the 24 seeded workouts and clears reviews and feedback.
- Final rerun passed after adding mobile feedback navigation, the skip-link correction, scrollable desktop navigation, and static content-security policy.

Reproducible browser check: `scripts/coach-demo-browser-check.js`, invoked through `scripts/check-coach-demo.ps1` against an open `coach-demo` Playwright CLI session. The wrapper uses this machine's cached CLI and Node 22 locations. Raw log and screenshots are local ignored artifacts in `output/coach-demo/`.

## Publication

The Vercel CLI sign-in was expired and its former no-auth fallback endpoint no longer accepts deployments. Publication uses the connected Sites plugin instead, with a separately registered public demo site. The demo's source is synchronized to its dedicated Sites repository from `C:\Users\BAS\Desktop\UltraOS\coach-research-published`; the exact pushed source was packaged by the Sites workflow helper. Git Bash and `TAR_OPTIONS=--force-local` resolve the helper's Windows packaging issues.

Publication identity and final evidence are recorded in `coach-demo/site-hosting.json`. This file contains no credentials. Do not create another Site when updating it: reuse the exact project ID and existing public audience.

Sites confirmed deployment **succeeded** at https://threshold-coach-research.tadschweizer.chatgpt.site for version 1, source `14588adfbea8c821efbbabfedcbfc96ce9e49b8d`. Public access was confirmed by the native access-update result. This is separate demo-hosting evidence, not acceptance of the real product.

## Practical limits

The demo is a research prototype. Historical metrics are illustrative, athlete messages are simulated locally, and connections are labeled illustrations. No real message delivery, watch connection, billing, or production data is tested. Participant feedback is manually returned as a downloaded file, rather than silently collected. Browser-local changes are isolated per visitor and can be cleared with Reset demo.
