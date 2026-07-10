# Plan 02 — One shared auth guard for every API route

**Priority: 2 of 10. Land in the same deploy as plan-01 (plan-01 changes the cookie format; routes that parse the cookie by hand will break until they use the shared reader).**

## Goal

~30 API routes each do their own `cookie.parse(req.headers.cookie || '').athlete_id` instead of using `getAthleteIdFromRequest` / `getAthleteByCookie` from `webapp/lib/auth/sessionCookies.js` and `webapp/lib/authServer.js`. This is exactly the drift `docs-auth-stability.md` rule 2 forbids ("Never inline auth validation logic into feature pages"). Consolidate every route onto one helper so the signature verification from plan-01 applies everywhere, and audit every route that accepts an `athlete_id` from the client (query/body) to confirm it checks authorization.

## Files to touch (exact)

Create one new helper:

- `webapp/lib/auth/requireAthlete.js` (new)

Migrate these routes (every file under `pages/api/` that currently references `athlete_id` from a cookie — verify with `grep -rln "cookie.parse" webapp/pages/api`):

```
pages/api/activities.js            pages/api/coach/notes.js
pages/api/activity-details.js      pages/api/coach/profile-update.js
pages/api/admin/athletes.js        pages/api/coach/protocols.js
pages/api/admin/integration-interest.js  pages/api/coach/relationships.js
pages/api/admin/recent-logs.js     pages/api/coach/shared-docs.js
pages/api/athlete/shared-docs.js   pages/api/coach/templates.js
pages/api/billing/checkout.js      pages/api/current-protocol-assignment.js
pages/api/billing/sync.js          pages/api/delete-account.js
pages/api/calendar-notes.js        pages/api/exa/news-feed.js
pages/api/coach-assignments.js     pages/api/exa/race-enrich.js
pages/api/coach-connection.js      pages/api/exa/race-search.js
pages/api/coach-profile.js         pages/api/exa/training-content.js
pages/api/coach-roster.js          pages/api/integration-interest.js
pages/api/coach/athlete-detail.js  pages/api/interventions.js
pages/api/coach/dashboard.js       pages/api/invites.js
pages/api/coach/groups.js          pages/api/log-intervention.js
pages/api/coach/invitations.js     pages/api/me.js
pages/api/coach/messages.js        pages/api/message-center.js
pages/api/notifications.js         pages/api/onboarding.js
pages/api/planned-workouts.js      pages/api/race-events.js
pages/api/race-outcomes.js         pages/api/races.js
pages/api/research-library.js      pages/api/research-library/admin.js
pages/api/research-library/draft.js  pages/api/settings.js
pages/api/workout-comments.js      pages/api/workout-export.js
pages/api/workout-library.js
```

Do NOT touch (they auth differently, by design):
- `pages/api/billing/webhook.js` (Stripe signature)
- `pages/api/webhooks/coros/activities.js` (webhook secret)
- `pages/api/auth/*` (they CREATE the session), `pages/api/strava/callback.js` and other OAuth callbacks (they set the cookie via `setAthleteCookie`)
- `pages/api/health.js`, `pages/api/set-invite-cookie.js`, `pages/api/research-library/pubmed-search.js` if it's public

## Steps in order

1. Create `webapp/lib/auth/requireAthlete.js`:
   ```js
   import { getAthleteIdFromRequest } from './sessionCookies.js';

   // Returns the verified athlete id or null. If null, it has already
   // written the 401 response — callers must `return` immediately.
   export function requireAthleteId(req, res) {
     const athleteId = getAthleteIdFromRequest(req);
     if (!athleteId) {
       res.status(401).json({ error: 'Not authenticated' });
       return null;
     }
     return athleteId;
   }
   ```
   Also add `requireAdmin(req, res, adminClient)` (looks up `is_admin` on the athletes row and 403s otherwise) since three `api/admin/*` routes repeat that block, and `requireCoachProfile(req, res, adminClient)` for the repeated `coach_profiles` lookup in the coach routes (copy the existing lookup logic from `pages/api/coach/dashboard.js` `ensureCoachProfile`).
2. Migrate routes one directory at a time (api root, then `coach/`, then `admin/`). In each file: delete the local `cookie.parse(...)` + null-check lines, import `requireAthleteId`, and replace with:
   ```js
   const athleteId = requireAthleteId(req, res);
   if (!athleteId) return;
   ```
   Remove the now-unused `import cookie from 'cookie'` if nothing else in the file uses it.
3. After the mechanical pass, do the **authorization audit** on every route that reads a target athlete id from the client (`req.query.athlete_id` / `req.body.athlete_id`). Known ones: `coach-roster.js:201`, `calendar-notes.js:40`, `coach/shared-docs.js:51`, `coach/messages.js:108`, `coach/athlete-detail.js:74`, `coach/protocols.js:68`, `coach/notes.js:73`, `planned-workouts.js:125`, `coach-assignments.js:93`. For each, confirm the code verifies an ACTIVE row in `coach_athlete_relationships` linking the session coach to that athlete before returning data (pattern already exists in `pages/api/planned-workouts.js` lines ~50–65 — reuse it). If any route filters only by the client-supplied id without a relationship check, add the check.
4. Run the full test suite: `cd webapp && npm run test:auth:full`.
5. Add a regression test that fails if new ad-hoc parsing appears: a test that greps `pages/api` for `cookie.parse` and asserts only an allowlisted set of files (the webhook/OAuth files above) contain it. Model it on the existing style in `tests/auth-regression.test.mjs` (node:test + `fs.readFileSync`).

## Edge cases a weaker model would miss

- Some routes return errors in a slightly different shape (`{ error: { status, message } }` in `activity-details.js`). Preserve each route's external response shape; only the auth-extraction changes.
- `pages/api/me.js` may intentionally return `{ athlete: null }` with a 200 for logged-out users instead of a 401 — read it first and keep its contract (the client `meClient.js` depends on it).
- `admin/athletes.js` uses its own service-role client factory; keep using `getSupabaseAdminClient()` from `lib/authServer.js` instead of creating another client.
- The coach guard must handle the case where the session user has no `coach_profiles` row — some routes auto-create one (`ensureCoachProfile` in `coach/dashboard.js`), others must 403. Preserve each route's current behavior; don't force auto-create everywhere.
- Two routes (`races.js`, `research-library.js`) may serve public data when logged out — check whether they currently 401 or degrade gracefully, and preserve that.
- Don't convert `strava/callback.js`, `coros/callback.js`, `garmin/callback.js`, `oura/callback.js`, `ultrahuman/callback.js` — OAuth callbacks read/write cookies differently.
- `delete-account.js` clears the cookie with its own inline `cookie.serialize` — switch it to `clearAthleteCookie(res)` from `sessionCookies.js`.

## Acceptance criteria

1. `grep -rn "cookie.parse" webapp/pages/api` returns matches ONLY in webhook/OAuth-callback/auth files.
2. `grep -rn "cookies.athlete_id\|\.athlete_id;" webapp/pages/api | grep -v requireAthlete` shows no route reading the auth cookie by hand.
3. `npm run test:auth:full` passes, including the new no-ad-hoc-parsing regression test.
4. Manual: logged out, `curl https://<app>/api/interventions` → 401. Logged in via browser, dashboard/calendar/coach pages all load their data as before.
5. Manual coach-authorization check: as coach A with no relationship to athlete X, `GET /api/coach/athlete-detail?athlete_id=<X>` returns 403/404, not data.

## Out of scope

- Changing RLS policies (server uses service-role; RLS hardening is a separate DB concern).
- The cookie signing itself (plan-01).
