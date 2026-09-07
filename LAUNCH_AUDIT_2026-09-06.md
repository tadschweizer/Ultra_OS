# Threshold launch audit — 6 September 2026

## Recommendation

Launch a small, supported coach pilot after the daily training loop is reliable. Do not yet position Threshold as a TrainingPeaks replacement. Keep the existing roadmap, but promote workout logging, messaging, core interface consistency, and AI deferral into M0. A fresh visual treatment will help; reliability and fewer steps will matter more for retention.

The intended loop is: coach creates and assigns a workout → athlete finds it on a phone → athlete logs or imports completion → coach reviews and replies → athlete receives the reply. Every stage needs a clear saved state, failure recovery, and appropriate permissions.

## Evidence and limits

- Fetched GitHub origin. `origin/main` is `7336511`, P0-003 / PR #111. Local branch is `feature/p0-003-role-aware-access` at `27ee0e5`. `git diff HEAD origin/main --stat` is empty: the committed source trees match. The pre-existing local `AGENTS.md` edit was preserved.
- Vercel lists production deployment `dpl_CqSxKNoaLjeBndJ4BiK1nXSiEBYr` as READY, promoted from P0-003 commit `27ee0e5`. The roadmap's statement that no production deployment occurred is stale. This does not prove its database migration or acceptance criteria passed.
- Supabase's connected API reports project `jzfctjaaowdvubhqswpa` / UltraOS as INACTIVE. A read-only migration-history query timed out. Security advisors returned an empty lint list; given the inactive state and failed SQL access, that is insufficient evidence of database security.
- Vercel's runtime-error summary reports six `/api/me` errors involving missing backend configuration, most recently 6 September. The summary includes another deployment and an older first-seen timestamp despite the requested seven-day range. Treat this as a deployment-scoping investigation, not proof that the current production secret is missing.
- Live desktop homepage and 390 × 844 mobile login rendered. Anonymous `/api/me` returned 401, which is expected without a session. No authenticated production writes, messages, billing actions, deployment, or service changes were performed.
- Node 22 focused tests passed 70/70: role access, workout comments, workout compliance, and activity sync. These do not establish live end-to-end correctness.
- Existing role-aware Playwright tests passed 5/5 across desktop and 390 px mobile Chromium, with three intentional project-specific skips. These mock API accounts and verify navigation/hydration, not real database persistence. `git diff --check` passed after the documentation amendments. No production build was rerun for this documentation-only change.
- Authenticated calendar, messaging, and dashboard findings below come from source inspection. Their visual layout and live persistence still require a working staging environment and representative accounts. This is a focused launch audit, not a penetration test or complete accessibility certification.

## Findings ranked by launch impact

| Priority | Finding and evidence | Required change |
| --- | --- | --- |
| Blocker | Backend readiness is unverified: inactive Supabase and migration query timeout. `/api/health` always returns 200 without checking dependencies (`webapp/pages/api/health.js`). | Resolve project availability with owner approval; verify P0-003 schema and fresh-account journeys. Separate basic liveness from bounded database readiness and alert on failure. |
| Blocker | Research administration checks only for a signed-in athlete before using the service-role client for GET/POST/PUT/DELETE (`webapp/pages/api/research-library/admin.js:12,58`). | Enforce a server-side administrator check before privileged access, or disable this API during the pilot. Hiding the page alone is insufficient. Test anonymous, athlete, coach, and admin cases without modifying production research. |
| Blocker if billing exposed | Checkout has no method gate and can update an existing subscription with `always_invoice` proration (`webapp/pages/api/billing/checkout.js:65,114`). | Complete P0-010, or make billing mutations unavailable throughout the pilot. Require POST, origin/CSRF protection, explicit price confirmation, and replay-safe behavior. |
| High | Calendar completion/update/delete/library-apply paths only act on successful HTTP responses; failed responses have no useful feedback. `WorkoutDetail.submit` lacks catch/finally, so a network rejection can leave Busy set (`TrainingCalendar.js:754,1577`). | Standardize mutation results, catch/finally, field errors, retry, preserved drafts, duplicate-submit protection, and visible confirmation after persistence. |
| High | Completion defaults actual duration/distance to planned values; the completion form disappears once completed (`TrainingCalendar.js:745,842`). | Label any copied plan values explicitly; distinguish actual, imported, and assumed values. Add a direct Edit completion / Undo completion path and partial completion. Do not require modifying the coach's prescription to correct an athlete log. |
| High | Free athletes get three check-ins per week, without a linked-coach entitlement check (`subscriptionTiers.js:24`; `api/log-intervention.js:32–76`). | Implement P0-004/005 together so a pilot coach's athletes can supply daily feedback. Keep abuse limits separate. |
| High | Athlete mobile tabs are Home, Log intervention, History, Research, Profile (`lib/siteNavigation.js:91`). Calendar and Messages are absent. | Use Today, Calendar, Log workout, Messages, Profile. Put a separate quick check-in on Today; keep interventions secondary. Coach mobile navigation already includes Roster/Calendar/Messages: preserve the P0-003 improvement and verify remaining actions. |
| High | Full Messages page loads on entry/selection/send, with no incoming refresh or read acknowledgement. The floating MessageCenter separately polls every 60 seconds and marks read (`pages/messages.js:54`; `components/MessageCenter.js:70,106`). | Share thread state and read logic. Refresh an open conversation promptly, retain per-recipient drafts, paginate history, provide retry and notifications. Test full-page and floating-panel unread counts together. |
| High | Connections displays literal TrainingPeaks 'transferred' and 'partial' states without a migration job (`pages/connections.js:123`). | Remove these states until real job results exist. Display provider capability, last successful sync, connection errors, and retry honestly. Token expiry is not last sync. |
| High | Homepage says to keep using TrainingPeaks and describes Threshold as the layer above it (`pages/index.js:451`). Dashboard still has AI Readiness and AI Insights + Fun Facts (`pages/dashboard.js:1166,1209`). | Align pilot positioning and the interface with manual coaching and training. Complete AI deferral below before inviting users. |
| Medium | Calendar reads await activity sync before returning stored activities (`api/planned-workouts.js:108`). Several mutations reload calendar data. | Return stored data first; refresh providers asynchronously with visible sync state. Measure latency before and after. Use targeted updates and preserve calendar position. |
| Medium | Current CI runs auth smoke and invitation E2E, but not build, the full regression suite, or the role browser suite (`.github/workflows/auth-smoke.yml`). | Make the launch journeys and build required checks. Add failure-path, role-isolation, and accessibility coverage to staging. |

## What already exists and should be improved, not rebuilt

The app has a shared coach/athlete calendar, structured step fields, a workout library, copy-week support, completion logging, workout and imported-activity discussions, general messages, planned/actual matching, and timezone-aware activity handling. The 70 passing focused tests support parts of these foundations. This is more than a blank MVP.

What is still missing for a credible daily replacement is the complete interaction contract: fast move/duplicate/undo, reliable multi-week plan application, expressive repeat groups, easy correction of actuals, timely conversations, and verified device delivery. TrainingPeaks' current builder supports duration/distance and power, heart rate, pace, and perceived-exertion targets; its plan workflow includes reusable plans and workouts. Use real representative sessions as the benchmark, not a count of controls. [Builder](https://help.trainingpeaks.com/hc/en-us/articles/235164967-Structured-Workout-Builder), [coach workflow](https://www.trainingpeaks.com/get-started-coach/).

## Cleaner interface direction

Keep the navy, warm neutral background, and restrained amber identity. The live mobile login already has a readable hierarchy and comfortably sized controls. Avoid a total brand reset.

- **Athlete Today:** today's workout, its instructions, one Log workout action, a 30-second check-in, and the latest coach reply. Put research, intervention exploration, and long analytics below the daily tasks or in secondary navigation.
- **Coach workspace:** roster list with last activity, unanswered messages, missing check-ins, and next workout; select an athlete to open their week without losing roster filters or calendar position. Every alert should lead to its supporting data and an action.
- **Calendar:** compact week on desktop, agenda/day view on phones, visible planned versus actual, and a persistent Add workout button. Open a side panel on desktop and a full-height editor on phones. Include tap-based Move/Duplicate actions alongside desktop drag and drop.
- **Builder:** begin with sport, title, date, and duration; reveal advanced targets progressively. Offer reusable recent sessions, duplicate step/group, clear units, calculated totals, and an interval preview. Strength sessions need sets/reps/load/rest rather than endurance fields alone if strength is in the pilot.
- **Messages:** one recognizable inbox. Keep workout discussions attached to the session but discoverable from that inbox. Make templates optional and replace internal explanations about IDs and triage parameters with a short empty-state instruction.
- **Visual system:** 28–32 px app titles, readable 14–16 px functional text, fewer uppercase micro-labels, restrained shadows, consistent 8/12/16/24 spacing, and 12–16 px card radii. Reserve oversized serif heroes and decorative gradients for marketing. These are proposed design targets, not measured current violations.
- **Accessibility:** persistent field labels, keyboard focus and return focus for dialogs, Escape behavior, screen-reader announcements for saves, reduced motion, text-plus-color status, and comfortable touch controls. Measure contrast rather than relying on opacity values.

## AI deferral scope

Create one server-controlled release capability, disabled for the pilot. Hide AI-labelled panels, automated recommendation entry points, generation controls, and related sales claims; block any corresponding generation endpoints and scheduled work. Verify network traffic contains no generation requests from pilot routes.

Do not remove normal calculations just because their current label says AI. Source inspection shows deterministic calculations/templates in this app; inventory model calls, Exa search/enrichment, rule-based triage, and manual tools separately. Retain workout totals, explicit zones, planned/actual comparisons, and coach-written feedback. Keep race information editable manually if search/enrichment is deferred. Preserve stored data so AI can return later without a destructive migration.

## Integration choices

| Order | Integration | Product value and conditions |
| --- | --- | --- |
| Now | Existing Supabase + transactional email | Use existing persistence and email first. Supabase Realtime can improve incoming messages, but requires a compatible authenticated client identity, relationship-scoped private channels, reconnection reconciliation, and durable database writes. Never expose the service-role key. Polling is an acceptable interim implementation. [Authorization](https://supabase.com/docs/guides/realtime/authorization). |
| Now | Existing Vercel + Sentry | Keep one app runtime. Verify error capture, deployment environment consistency, and alerts before adding another monitoring product. Track workout-save failures and coach/athlete activation without recording message bodies or private training details. |
| Start access evaluation now; implement after builder | Garmin, then the provider used most by pilot athletes | Garmin Training API supports publishing workouts/plans to Garmin Connect and requires approval. Inbound activity sync and outbound workouts are separate capabilities. Test one physical device round trip. COROS/Wahoo expansion should follow actual demand and confirmed API access. [Garmin Training API](https://developer.garmin.com/gc-developer-program/training-api/). |
| Before relying on coach-visible imports | Existing Strava integration | Verify the current approved application terms and permitted coach display before treating Strava as a universal source. Prove refresh, incremental imports, deletion/correction, duplicate handling, and disconnect. An OAuth button is not integration readiness. [Developer portal](https://developers.strava.com/). |
| Later, if coaches request video | Cloudflare Stream | Exercise demonstrations or private form-review clips are relevant. Stream handles video upload/encoding/playback; use authorized uploads and signed playback access. Avoid public athlete clips by default. [Stream](https://developers.cloudflare.com/stream/), [signed URLs](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/). |
| Later, optional differentiation | Route data + Mapbox terrain | A real race-course preview with climbs, aid stations, pacing sections, and coach notes is a useful analogue to the 3D walkthrough idea. Start with a clear 2D route/elevation profile, then add optional terrain. Use real course data; validate mobile performance and map usage costs. [Terrain example](https://docs.mapbox.com/mapbox-gl-js/example/add-terrain/). |

Zillow/property walkthrough integrations do not serve the training loop. I would defer Higgsfield-style generated flythroughs: realistic-looking imagery does not establish an accurate race route or improve workout logging. There is no need to add another hosting platform or replace the existing backend to refresh the interface.

## Execution order and acceptance

1. **Establish a trustworthy pilot environment:** availability, P0-003 migration evidence, admin authorization, billing isolation/fix, seed accounts, dependency readiness, and required CI. No release based only on a green homepage.
2. **Make the manual daily loop reliable:** P0-004/005 entitlements, workout save/error recovery, actuals editing, unplanned workout logging, one reliable inbox, truthful connections, and AI deferral.
3. **Refresh the five frequent surfaces:** athlete Today, coach roster, calendar, workout editor/logging, Messages. Apply shared components as these workflows ship; move this portion of M7 forward.
4. **Moderated pilot:** one coach and up to five athletes for two weeks. Record completion times, help requests, abandoned tasks, data corrections, and missed notifications. Observe both phone and desktop use.
5. **Planning/device beta:** calendar operations and reusable plans, then advanced structured workouts and one approved device round trip. Keep the broader parity gates intact.

Suggested acceptance targets (proposed, not current measurements): a returning athlete finds today's session in two taps or fewer; logs completion in 30 seconds excluding written notes; a coach creates a simple session in 60 seconds and a representative repeat session in two minutes; incoming messages appear within five seconds in an open thread; every failed write preserves input and offers retry. Run the same coach planning tasks in TrainingPeaks with the same people before claiming comparable speed.

Release tests must cover double submission, offline save/reconnect, expired session, conflicting edits, two workouts on one day, midnight/timezone changes, manual log plus later device import, incorrect automatic matching and correction, unread persistence, and revoked coach relationships. No duplicate completions or cross-athlete access is acceptable. A new coach and athlete must finish signup → invite → plan → log → reply without an administrator repairing records.
