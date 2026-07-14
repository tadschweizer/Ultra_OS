# Plan 10 — Admin read-only impersonation + data-health dashboard

**Priority: 10 of 10. MULTIUSER_ROADMAP Phase 3 items 11–12. This is how you verify "things look correct on their end" once the first cohort is in. Do AFTER plans 01–02 (it builds on the signed cookie and shared guards — done earlier it would widen the security hole).**

> **Status: IMPLEMENTED.** `view_as` cookie is httpOnly + HMAC-signed WITH an embedded expiry (2h, enforced server-side, not just maxAge); `resolveEffectiveAthleteId` re-verifies `is_admin` on every request and only ever applies on GET; applied across 25 data-read routes (athlete + coach GETs, incl. Strava-token routes so the admin sees the target's real view). Writes during impersonation are blocked at ONE choke point — `middleware.js` 403s every non-GET `/api/*` (and `/api/billing/*` in both directions, since `portal.js` is a GET redirect) while a validly signed cookie is present; forged cookies fail verification and have zero effect; `/api/admin/impersonate` (stop) and `/api/auth/*` are exempt. `POST/DELETE /api/admin/impersonate`, amber banner via `/api/me`'s `impersonating` block (`components/ImpersonationBanner.js` in `_app`), `threshold.me.v1` cache busted on start/stop. `admin/athletes.js` N+1 replaced with exactly 2 batched queries + data-health stats (active 7d, dormant 14+, check-ins/week ×4, top-5 types, dormant list). 5 new tests in `tests/auth-regression.test.mjs` (forged cookie, demoted admin, GET-vs-POST resolution, signed expiry, tamper).

## Goal

Two admin capabilities:
1. **Read-only impersonation**: as admin, append `?view_as=<athleteId>` and see exactly what that athlete sees, with all writes blocked.
2. **Data health view** on `/admin`: active vs dormant athletes, check-ins/week, most-logged intervention types — plus fix the N+1 query pattern already in `pages/api/admin/athletes.js` (one query per athlete).

## Files to touch (exact)

1. `webapp/lib/auth/requireAthlete.js` (from plan-02) — add `resolveEffectiveAthleteId(req, res, adminClient)`: returns `{ athleteId, isImpersonating }`
2. `webapp/lib/auth/sessionCookies.js` — add a second cookie `view_as` (signed with the same HMAC helper, httpOnly), plus set/clear helpers
3. `webapp/pages/api/admin/impersonate.js` (new) — POST `{ athleteId }` starts, DELETE stops; admin-only
4. `webapp/pages/admin.js` — "View as athlete" button per row; banner state
5. `webapp/components/AppShell.js` (or `NavMenu.js` — whichever wraps every page; read both) — persistent amber banner "Viewing as {name} — read-only. Exit" when impersonating
6. Every data-READ API route (the plan-02 list) — swap `requireAthleteId` for `resolveEffectiveAthleteId` on GET handlers only
7. `webapp/pages/api/admin/athletes.js` — replace the per-athlete loop with two batch queries
8. `webapp/pages/api/me.js` — include `{ impersonating: { athleteId, name } }` so the client banner knows
9. `webapp/tests/auth-regression.test.mjs` — impersonation guard tests

## Steps in order

1. Cookie mechanics: `setViewAsCookie(res, athleteId)` stores `sign(athleteId)` in a `view_as` cookie (httpOnly, path `/`, maxAge 2h). `POST /api/admin/impersonate` verifies the SESSION athlete `is_admin` (via `requireAdmin` from plan-02), verifies the target athlete exists, sets the cookie. DELETE clears it.
2. `resolveEffectiveAthleteId(req, res, adminClient)`:
   - Get the real session athlete id (signed cookie). If none → 401 as usual.
   - If a `view_as` cookie exists and verifies: load the REAL athlete's row; if `is_admin`, return the target id with `isImpersonating: true`. If not admin, ignore the cookie entirely (and clear it).
3. Apply to read routes: in each API route from the plan-02 list, use `resolveEffectiveAthleteId` for `GET` handlers. For any non-GET method, ALWAYS use the real athlete id AND reject the request outright when impersonating (403 `"Read-only impersonation"`) — a POST while impersonating must never write to either account silently.
4. Admin UI: button per athlete row on `/admin` calls the impersonate endpoint then `window.location = '/dashboard'`. Banner: `/api/me` now reports impersonation; render the banner in the shared shell with an Exit button (DELETE endpoint, then redirect to `/admin`). Also purge the `meClient.js` sessionStorage cache (`threshold.me.v1`) on start/stop, or the old profile sticks.
5. Fix the N+1 in `admin/athletes.js`: replace the `Promise.all(athletes.map(...))` with one grouped query — fetch `interventions` `select('athlete_id, inserted_at, intervention_type')` ordered desc (or a Postgres RPC with `count(*) group by athlete_id` via `lib/postgresAdmin.js` if row volume is high; check that lib — it exists for raw SQL) and reduce in JS to `{ count, lastAt }` per athlete. NOTE (review finding, since fixed): the `interventions` table has `inserted_at` and `date` — there is NO `logged_at` column; the admin endpoints previously queried `logged_at` and were corrected to `inserted_at` (recent-logs aliases it back as `logged_at:inserted_at` for the client). `intervention_type` is also needed here for the top-5 type stats in step 6.
6. Data health section on `/admin`: from the same batch data compute — active last 7 days, dormant 14+ days, check-ins per week (last 4 weeks), top 5 intervention types by count. Render as simple stat cards + a dormant-athletes list. No new tables.
7. Tests: (a) non-admin with a forged-but-unsigned `view_as` cookie → treated as self; (b) non-admin with a VALIDLY signed `view_as` (edge: demoted admin) → ignored; (c) admin impersonating: GET returns target's id, POST returns 403; (d) impersonation cookie expires after 2h.
8. `npm run test:auth:full`, `npm run build`, manual pass.

## Edge cases a weaker model would miss

- **Writes while impersonating are the whole risk.** It is not enough to route writes to the admin's own id — that corrupts the ADMIN's data with the athlete's context. Block non-GET entirely during impersonation (403), except `POST /api/admin/impersonate` (DELETE/stop) and `/api/auth/logout` themselves.
- The `view_as` cookie must be signed too, or any user could set `view_as` and (combined with a future bug in the admin check) escalate. Sign it and re-verify `is_admin` on EVERY request — never trust that the cookie's existence implies admin (admins can be demoted mid-session).
- `meClient.js` caches `/api/me` in sessionStorage per tab — stale cache means the banner won't show and plan-gating uses the wrong tier. Bust the cache on start/stop (find its exported invalidation function or clear key `threshold.me.v1`).
- Billing routes (`api/billing/checkout.js`, `portal.js`) during impersonation would create Stripe sessions against the ATHLETE's customer — they're POSTs, so the blanket non-GET block covers them; double-check `portal.js` isn't a GET (if it is, exclude it explicitly).
- Strava-token-using routes (`api/activities.js`, `activity-details.js`) will fetch with the TARGET athlete's tokens — that's desired (admin sees their real view) but wrap token refresh in the same code path so an expired target token doesn't 500 the whole page.
- Coach routes resolve a coach profile from the effective id — impersonating a coach-tier athlete should show their coach view; make sure `resolveEffectiveAthleteId` is used there too, not a second cookie read.
- Sentry: impersonated requests should tag `impersonated_by` so error reports aren't attributed to the athlete (check `sentry.server.config.js` for how user context is set; skip if none is set).

## Acceptance criteria

1. As admin: click "View as" on an athlete → land on their dashboard with their data and the amber banner; `/insights`, `/calendar`, `/history` all show the target's data.
2. While impersonating, submitting a log-intervention form fails with a visible "read-only" error and writes nothing to either account (verify DB).
3. Exit banner returns you to `/admin` as yourself; a subsequent `/api/me` shows your own profile (cache busted).
4. As a non-admin, hand-crafting a `view_as` cookie has zero effect.
5. `/admin` loads in one round-trip regardless of athlete count (network tab: no per-athlete requests; server does ≤3 Supabase queries), and shows the data-health stat cards.
6. `npm run test:auth:full` passes with the four new tests.

## Out of scope

- Suspend/remove athlete actions (roadmap item 10 remainder).
- Audit-logging impersonation sessions to a table (console/Sentry breadcrumb is enough for now).
