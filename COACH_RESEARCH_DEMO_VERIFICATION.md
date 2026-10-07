# Coach demo verification — 2026-10-07

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
