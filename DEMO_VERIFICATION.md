# Synthetic demo verification and independent QA handoff

Source base: `fa8ebe2b377784007b4a40b4e982f92a11224075` from online `tadschweizer/Ultra_OS/main`. Dedicated branch: `demo/synthetic-transfer`, [Draft PR #134](https://github.com/tadschweizer/Ultra_OS/pull/134). Corrected runtime: `683a5ebf42a6e86e56b62544f7b79d303a71aeda`, READY deployment `dpl_HGAsRETr6kkg1doGUmdrwqyAZMt4`, [immutable preview](https://ultra-os-tb77-9vifc1i44-tadschweizers-projects.vercel.app). Exact current runtime/build/deployment identities are in `coach-demo/preview-identity.json`; a later evidence-only commit does not change the served artifact. The first runtime `edccc86` was rejected by independent QA and remains available with its evidence. [DEMO_QA_FIXES.md](DEMO_QA_FIXES.md) records the three repairs. New independent retest is pending. This is a static preview; no production service configuration, authentication, Supabase records, providers, email or payments were changed.

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

- Adapter: 15/15 tests pass, including new regressions for full library metadata/private visibility with default production schema unchanged, unknown actual TSS, and consumed/reset failure state. Existing persistence/role/idempotency/compliance/matching/messages/drafts/endpoint/storage checks still pass.
- Production regression: 432/432 pass, including signed handler/integration guard tests. Production Next build passes. No lint script exists in this repository; no separate lint success is claimed.
- Browser: corrected full local suite passes 18/18 (49.7s) and corrected immutable hosted suite passes 18/18 (52.6s), including F1/F2/F3 at 1440, 390 and 320px. The dedicated F1/F2 subset passes 3/3 (15.4s); private-library and failure-retry cases also pass in the full suite. Every scenario asserts no JavaScript page errors and no page requests to API paths or external origins. Hosted JS/CSS SHA-256 hashes match, `connect-src 'none'` is enforced, and planned-workouts, coach/messages, message-drafts and admin/demo probes return 404 using the test request fixture rather than the demo page. Initial 15/15 hosted results are historical only.
- Full sequence: coach creates structured work and a separate next workout; athlete logs 35min/5.2km, RPE 8 and context; coach reviews actuals, comments, sends a message and reduces the next workout from 60 to 40min; athlete sees the adjustment and replies as athlete. Unread clears, role/recipient drafts remain isolated, reload persists changes.
- Additional browser checks: failed save and retry without losing fields, repeated duplicate/copy clicks, structured library assignment, reschedule, private draft visibility, check-in/triage, matching/unlinking, imported activity discussion, missing distance correction, skip/undo, reset confirmation/cancel/focus/Escape, navigation/history, empty new athlete, independent tab seed, local JSON export contents, and no horizontal overflow in five views.
- Anonymous local production probes return 401 for planned workouts/comments; messages/drafts/admin demo return 503 with service configuration absent. They fail closed. The signed handler regression establishes the configured authentication behavior; these local 503s are not described as 401 checks.
- Shared source changes include explicit transport/clock injection with native-fetch defaults, the activity-detail dialog focus ref, mobile copy-week access, target-unit stamping for library saves, a demo-opt-in library payload extension, and honest actual-TSS aggregation/missing-load labels. `_app`, middleware, production API/auth handlers and the production library database schema are unchanged.

Screenshots in `docs/demo-evidence` capture the actual tested hosted desktop and phone-width pages. That directory also includes hosted browser/adapter output, production build output and the production regression totals. Full raw logs, browser HTML report and traces are generated locally and ignored by Git; pass counts and command results are the supporting record, not screenshots alone. A local static build archive is pinned by SHA-256 in `preview-identity.json`.

## Independent acceptance required

Use Robin Vale, who starts with no completed session. Create a workout for October 9, 2026 with duration/distance/structure/instructions, then another for October 10. Switch to athlete, log partial actuals and RPE/comment. Switch back to coach, review both plan and actuals, add feedback, message Robin and reduce the October 10 plan. Switch to athlete, verify the update and correct author, reply, reload and verify persistence. Cancel an edit; save a changed plan; retry the injected failure from Demo boundaries. Try library, duplicate/copy, synthetic match/unlink, River/Jules/Sage context, missing actuals and reset. Repeat the loop at a narrow viewport. Inspect browser network activity and compare the transfer matrix.

Independent QA and a physical-phone test remain open. The browser widths establish responsive emulation only. The local adapter is a coherent single-tab simulation, not simultaneous real participants, delivery, database concurrency, imports or provider synchronization. Check-in/Today/triage/navigation are adapted and the wider product features listed in the matrix are excluded. The existing public Sites v2 identity is preserved; this preview does not replace it. No merge or production publication is authorized.
