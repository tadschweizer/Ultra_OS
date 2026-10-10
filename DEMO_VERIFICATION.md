# Synthetic demo verification and independent QA handoff

Source base: `fa8ebe2b377784007b4a40b4e982f92a11224075` from online `tadschweizer/Ultra_OS/main`. Dedicated branch: `demo/synthetic-transfer`, [Draft PR #134](https://github.com/tadschweizer/Ultra_OS/pull/134). The final F4/F5 runtime will be pinned below after publication; the intermediate `20113c37` preview remains immutable but is superseded before independent handoff. Exact runtime/build/deployment identities are in `coach-demo/preview-identity.json`; later evidence-only commits do not change the artifact. Independent retest of `683a5eb` clears F1/F2/F3 but holds acceptance on pre-existing F4/F5 (selection refresh and lost matched elevation). Both prior immutable previews and their evidence remain available. [DEMO_QA_FIXES.md](DEMO_QA_FIXES.md) records all five repairs; independent retest of the current runtime remains required. This is a static preview; no production service configuration, authentication, Supabase records, providers, email or payments were changed.

## Reproduce

```powershell
cd coach-demo
npm ci
npm run build
npm test
npm run test:browser
npx vite preview --host 127.0.0.1 --port 4173
```

No login or secrets are needed. `DEMO_CHROME` can select an installed Chromium executable. `DEMO_BASE_URL` selects the immutable hosted preview for the same browser suite. The suite compares the hosted JS/CSS SHA-256 hashes to the local build, checks CSP, and verifies protected API paths do not exist on the static host.

The deployment payload contains only `dist` files and the header configuration. Set `$env:DEMO_VERCEL_ROOT='webapp'` and run `node scripts/preview-files.mjs` to reproduce its base64 file manifest: the existing Vercel project root requires the `webapp/` prefix and a per-deployment `@vercel/static` builder. No project settings or production aliases were changed. The first unwrapped preview failed with `NOW_SANDBOX_WORKER_ROOTDIR_NOT_EXIST` and never served the app; it is superseded by the READY identity above. Direct API publication was used because the CLI had no signed-in account; no credentials were added.

Production regressions, from `webapp`:

```powershell
npm ci
npm run test:auth:full
npm run build
```

## Self-verification

- Adapter/helper suite: 17/17 tests pass, including full library metadata/private visibility with default production schema unchanged, unknown actual TSS, consumed/reset failure state, selection URL context/removal semantics, and the actual shared weekly summary's metric invariance through match/reload/unlink. Raw production `total_elevation_gain` and normalized demo `elevation_gain_m` are both covered. Existing persistence/role/idempotency/compliance/matching/messages/drafts/endpoint/storage checks still pass.
- Production regression: 432/432 pass, including signed handler/integration guard tests. Production Next build passes. No lint script exists in this repository; no separate lint success is claimed.
- Browser: the dedicated F4/F5 subset passes 3/3 (18.3s) at 1440, 390 and 320px. The full suite now has 21 scenarios, retaining F1/F2/F3 plus selection/close/activity/log-cancel refresh and recorded-elevation invariance through matching/reload/unlink. Final local and hosted results are recorded with the new preview identity after publication. Every scenario asserts no JavaScript page errors and no page requests to API paths or external origins. The hosted contract checks JS/CSS SHA-256, `connect-src 'none'`, and 404s for planned-workouts, coach/messages, message-drafts and admin/demo using the test request fixture rather than the demo page. Prior 15/15 and 18/18 hosted results are historical only.
- Full sequence: coach creates structured work and a separate next workout; athlete logs 35min/5.2km, RPE 8 and context; coach reviews actuals, comments, sends a message and reduces the next workout from 60 to 40min; athlete sees the adjustment and replies as athlete. Unread clears, role/recipient drafts remain isolated, reload persists changes.
- Additional browser checks: failed save and retry without losing fields, repeated duplicate/copy clicks, structured library assignment, reschedule, private draft visibility, check-in/triage, matching/unlinking, imported activity discussion, missing distance correction, skip/undo, reset confirmation/cancel/focus/Escape, navigation/history, empty new athlete, independent tab seed, local JSON export contents, and no horizontal overflow in five views.
- Anonymous local production probes return 401 for planned workouts/comments; messages/drafts/admin demo return 503 with service configuration absent. They fail closed. The signed handler regression establishes the configured authentication behavior; these local 503s are not described as 401 checks.
- Shared source changes include explicit transport/clock injection with native-fetch defaults, the activity-detail dialog focus ref, mobile copy-week access, target-unit stamping for library saves, a demo-opt-in library payload extension, honest actual-TSS aggregation/missing-load labels, shallow query-driven selection, and a pure weekly summary retaining linked recorded elevation/work. `_app`, middleware, production API/auth handlers and the production library database schema are unchanged.

Screenshots in `docs/demo-evidence` capture the actual tested hosted desktop and phone-width pages. That directory also includes hosted browser/adapter output, production build output and the production regression totals. Full raw logs, browser HTML report and traces are generated locally and ignored by Git; pass counts and command results are the supporting record, not screenshots alone. A local static build archive is pinned by SHA-256 in `preview-identity.json`.

## Independent acceptance required

Use Robin Vale, who starts with no completed session. Create a workout for October 9, 2026 with duration/distance/structure/instructions, then another for October 10. Switch to athlete, log partial actuals and RPE/comment. Switch back to coach, review both plan and actuals, add feedback, message Robin and reduce the October 10 plan. Switch to athlete, verify the update and correct author, reply, reload and verify persistence. Cancel an edit; save a changed plan; retry the injected failure from Demo boundaries. Try library, duplicate/copy, synthetic match/unlink, River/Jules/Sage context, missing actuals and reset. Repeat the loop at a narrow viewport. Inspect browser network activity and compare the transfer matrix.

Independent QA and a physical-phone test remain open. The browser widths establish responsive emulation only. The local adapter is a coherent single-tab simulation, not simultaneous real participants, delivery, database concurrency, imports or provider synchronization. Check-in/Today/triage/navigation are adapted and the wider product features listed in the matrix are excluded. The existing public Sites v2 identity is preserved; this preview does not replace it. No merge or production publication is authorized.

F4/F5 retest: River athlete Today -> Steady trail -> Close -> Recovery in calendar -> refresh must remain Recovery with `workout=seed-0-2`; close/refresh must show no detail. Imported detail selection must similarly replace the URL and survive refresh. On the October 5 week, match Ridge exploration to Steady, close and refresh: 620m, 58TSS, actual duration/distance must stay unchanged; unlink must preserve the same totals. Repeat at narrow widths and retain the accepted F1/F2/F3 behavior.

