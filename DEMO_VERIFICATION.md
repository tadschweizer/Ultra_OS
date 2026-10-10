# Synthetic demo verification and independent QA handoff

Source base: `fa8ebe2b377784007b4a40b4e982f92a11224075` from online `tadschweizer/Ultra_OS/main`. Dedicated branch: `demo/synthetic-transfer`. Runtime/deployment identities will be recorded in `coach-demo/preview-identity.json` after publication. This is a static preview; no production service configuration, authentication, Supabase records, providers, email or payments were changed.

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

Production regressions, from `webapp`:

```powershell
npm ci
npm run test:auth:full
npm run build
```

## Self-verification

- Adapter: 12/12 tests pass, including isolated persistence/reset, role restrictions, all planning fields, idempotent requests and mismatched retry keys, compliance/matching, message/draft/read lifecycle, unsupported endpoint rejection and storage failure.
- Production regression: 432/432 pass, including signed handler/integration guard tests. Production Next build passes. No lint script exists in this repository; no separate lint success is claimed.
- Browser: the full local suite exercises the real editor and messages components at 1440, 390 and 320px. Every scenario asserts no JavaScript page errors and no page requests to API paths or external origins. Final local and hosted totals are recorded with the preview identity.
- Full sequence: coach creates structured work and a separate next workout; athlete logs 35min/5.2km, RPE 8 and context; coach reviews actuals, comments, sends a message and reduces the next workout from 60 to 40min; athlete sees the adjustment and replies as athlete. Unread clears, role/recipient drafts remain isolated, reload persists changes.
- Additional browser checks: failed save and retry without losing fields, repeated duplicate/copy clicks, structured library assignment, reschedule, private draft visibility, check-in/triage, matching/unlinking, imported activity discussion, missing distance correction, skip/undo, reset confirmation/cancel/focus/Escape, navigation/history, empty new athlete, independent tab seed, local JSON export contents, and no horizontal overflow in five views.
- Anonymous local production probes return 401 for planned workouts/comments; messages/drafts/admin demo return 503 with service configuration absent. They fail closed. The signed handler regression establishes the configured authentication behavior; these local 503s are not described as 401 checks.
- Shared source changes are explicit transport/clock injection with native-fetch defaults, the missing activity-detail dialog focus ref, and access to the existing copy-week action on mobile. `_app`, middleware and production API/auth handlers are unchanged.

Screenshots in `docs/demo-evidence` capture the actual tested desktop and phone-width pages. Raw logs, browser HTML report and traces are generated locally and ignored by Git; pass counts and command results are the supporting record, not screenshots alone.

## Independent acceptance required

Use Robin Vale, who starts with no completed session. Create a workout for October 9, 2026 with duration/distance/structure/instructions, then another for October 10. Switch to athlete, log partial actuals and RPE/comment. Switch back to coach, review both plan and actuals, add feedback, message Robin and reduce the October 10 plan. Switch to athlete, verify the update and correct author, reply, reload and verify persistence. Cancel an edit; save a changed plan; retry the injected failure from Demo boundaries. Try library, duplicate/copy, synthetic match/unlink, River/Jules/Sage context, missing actuals and reset. Repeat the loop at a narrow viewport. Inspect browser network activity and compare the transfer matrix.

Independent QA and a physical-phone test remain open. The browser widths establish responsive emulation only. The local adapter is a coherent single-tab simulation, not simultaneous real participants, delivery, database concurrency, imports or provider synchronization. Check-in/Today/triage/navigation are adapted and the wider product features listed in the matrix are excluded. The existing public Sites v2 identity is preserved; this preview does not replace it. No merge or production publication is authorized.
