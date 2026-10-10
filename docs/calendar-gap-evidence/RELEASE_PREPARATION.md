# Latest-main release preparation — 2026-10-10

The user authorized correction and merge of existing PR135–137 after personally merging PR134. PR137 was checked against main, then merged as `5554087624bd48bba2e5bd42ee364655c0101fc6`; Vercel deployment `dpl_E43ZDnhmpVdjiLS6kzpXkmZf4msv` is READY on mythreshold.co and www.mythreshold.co. No manual deployment or production participant test was performed.

PR136 now contains main through that release. Tested runtime commit: `b62ab28a68d773c3b51c90f90903ee5c1addc552`. The merge preserves the reviewed atomic-copy client and all backend privacy/load fixes. Calendar mutation requests use the injected workspace transport; account refresh and retry scope use provider callbacks, preserving isolation for the synthetic demo. WorkspaceTransport and coach-demo/main.jsx match the reviewed PR135 integration blobs exactly (`52fd6e9…` and `159d102…`). The final PR135 combination preserves its accepted TrainingCalendar blob `2af2e61…` and matches independent QA `b10c309` application runtime.

## Local validation

All commands ran in this task's own release checkout with synthetic fixture stores or local PGlite databases; no production participants, credentials, providers or databases were mutated.

- `npm ci --ignore-scripts --no-audit --no-fund`: PASS, locked dependencies.
- `npm run test:auth:full`: PASS, 443/443, including signed handler, private-boundary, atomic-copy and load-source cases.
- `npm run test:integrations`: PASS, 4/4.
- `npm run build`: PASS after clearing this task's inactive generated caches. The first build hit Windows ENOSPC; the retained first-run log identifies the environmental cause.
- `PW_DISABLE_TS_ESM=1 CALENDAR_GAP_REGRESSION=1 TZ=UTC npx playwright test --config playwright.release.gaps.local.mjs e2e/calendar-gaps.spec.mjs e2e/daily-loop.spec.mjs e2e/message-workspace.spec.mjs --workers=1`: PASS, 38/38 at desktop and 390px/320px phone widths, isolated port 3166 and fresh server. The local config adds message-workspace to testMatch and runs the local production build, with synthetic Supabase environment and no reusable server.
- Synthetic demo prior to the PR137 merge: 17 unit tests, Vite build and 21 browser journeys PASS on isolated port 4186. The final PR135 combination receives the accepted combined demo regression suite and separate validation; this result alone does not establish production library behavior.

Local runtime limitation: Playwright 1.51's optional TypeScript ESM transformer stalls under Node 24 on this Windows host. PW_DISABLE_TS_ESM only disables that test transformer for native .mjs tests; application authentication and browser security are unchanged. Hosted CI uses its configured Node runtime.

## Production release hold

Catalog-only reads confirmed that UltraOS project `jzfctjaaowdvubhqswpa` lacks the five new library prescription columns, both new receipt tables/functions, the restrictive private-draft boundary, and the inbox visibility filter. Four exact migration sources require separate production approval before PR135/136 main merges. The parent handoff contains the reviewable operations and source hashes. Do not blanket-push migrations or reapply older pilot sources.

PR136 supplies `20261010030000_private_workouts_and_week_copy.sql` and `20261010030100_private_workout_inbox.sql`. Its library-column prerequisite and atomic library-create migration are supplied by PR135. Apply only the four reviewed sources in chronological order after approval, verify catalog definitions/grants/policies, then merge the checked heads and inspect automatic deployments.

This is local acceptance and release preparation. Physical phones, participant acceptance, fresh-account/provider/mailbox behavior, hosted Data API writes and independent-connection concurrency remain outside this verification.
