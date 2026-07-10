# Plan 01 — Sign and harden the session cookie (CRITICAL, do first)

**Priority: 1 of 10. Ship before any other work and before sharing the app with anyone.**

> **Status: IMPLEMENTED in this PR.** Deviations from the plan as written, adopted from code review:
> - No legacy unsigned-cookie compatibility window (the review correctly noted it would keep the impersonation hole open) — existing sessions are invalidated and users simply log in again.
> - The signing secret falls back to `SUPABASE_SERVICE_ROLE_KEY` when `SESSION_COOKIE_SECRET` is unset, so existing deploys are secure with zero new configuration.
> - `pages/api/strava/callback.js` set its own unsigned, non-httpOnly cookie and was migrated too (the review caught that the original plan wrongly excluded it).

## Goal

Today the entire auth system is a plaintext cookie: `athlete_id=<uuid>`, set with `httpOnly: false` and no signature (`webapp/lib/auth/sessionCookies.js`). Every API route trusts it blindly and then queries Supabase **with the service-role key**, which bypasses RLS. Coach endpoints (e.g. `pages/api/coach/dashboard.js`, `coach-roster.js`) return athlete UUIDs in their JSON responses, so **any coach can copy an athlete's UUID into their own cookie and fully impersonate that athlete** — read, write, and delete their data. Same for anyone who ever sees a UUID in a log, a shared screenshot, or a Sentry event.

Fix: make the cookie value a signed token `<athleteId>.<hmac>` using an HMAC-SHA256 over the athlete id with a server-only secret. Verify the signature on every read. Make the cookie `httpOnly`.

## Files to touch (exact)

1. `webapp/lib/auth/sessionCookies.js` — sign on write, verify on read (the core change)
2. `webapp/lib/auth/contracts.js` — no change to `AUTH_COOKIE_NAME` (keep `athlete_id` per `webapp/docs-auth-stability.md`); add error message constant if needed
3. `webapp/pages/pricing.js` (line ~101) — reads `document.cookie.match(/athlete_id=/)`; replace with `/api/me` via `lib/meClient.js`
4. `webapp/pages/connections.js` (line ~100) — same replacement
5. `webapp/pages/signup.js` (lines ~81–82) and `webapp/pages/login.js` (lines ~40–41) — these clear the cookie via `document.cookie`; once httpOnly they can't. Replace with a call to `POST /api/auth/logout`
6. `webapp/pages/api/auth/logout.js` — confirm it clears via `clearAthleteCookie` (server-side clearing still works with httpOnly)
7. `webapp/tests/auth-regression.test.mjs` and `webapp/tests/auth-oauth-regression.test.mjs` — update/extend
8. `webapp/.env.local.example` — document new `SESSION_COOKIE_SECRET` variable

## Steps in order

1. Add `SESSION_COOKIE_SECRET` to `.env.local.example` with a comment: "32+ random bytes, e.g. `openssl rand -hex 32`. Rotating it logs everyone out." The deployer must set it in Vercel env vars before deploy.
2. In `sessionCookies.js`, add two pure functions using Node's `crypto` module:
   ```js
   import crypto from 'crypto';
   function sign(athleteId) {
     const secret = process.env.SESSION_COOKIE_SECRET;
     if (!secret) throw new Error('SESSION_COOKIE_SECRET is not set');
     const mac = crypto.createHmac('sha256', secret).update(athleteId).digest('base64url');
     return `${athleteId}.${mac}`;
   }
   function verify(value) {
     if (!value || !value.includes('.')) return null;
     const idx = value.lastIndexOf('.');
     const athleteId = value.slice(0, idx);
     const mac = value.slice(idx + 1);
     const expected = crypto.createHmac('sha256', process.env.SESSION_COOKIE_SECRET).update(athleteId).digest('base64url');
     const a = Buffer.from(mac); const b = Buffer.from(expected);
     if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
     return athleteId;
   }
   ```
3. Change `setAthleteCookie(res, athleteId)` to store `sign(athleteId)` and set `httpOnly: true`.
4. Change `getAthleteIdFromRequest(req)` to run `verify()` and return the verified athlete id or `null`. Also validate the extracted id with `isValidAthleteId` from `contracts.js` before returning.
5. **No backwards-compat window.** Accepting bare legacy UUIDs — even behind an env flag — would keep the impersonation hole open for the whole window, since an attacker can present a bare UUID exactly like a legacy user. Force re-login: unsigned cookies simply verify to `null` and the user signs in again.
6. Update `pricing.js` and `connections.js`: replace the `document.cookie` regex with the athlete id from `fetchMe()` in `lib/meClient.js` (it already caches `/api/me`). Search each file for every use of the variable that held the cookie match and update all of them.
7. Update `signup.js` and `login.js`: replace the two `document.cookie = 'athlete_id=; Max-Age=0...'` lines with `await fetch('/api/auth/logout', { method: 'POST' })` (check `logout.js` for its accepted method first and match it).
8. Run `npm run test:auth:full` in `webapp/`. Fix any failures. Add new tests (see acceptance criteria).

## Edge cases a weaker model would miss

- **Do not rename the cookie.** `docs-auth-stability.md` declares the name `athlete_id` a stable contract; the signed value goes in the same cookie name.
- The UUID contains no `.`; use `lastIndexOf('.')` anyway so the code survives future id formats.
- `timingSafeEqual` throws if buffer lengths differ — check lengths first (done in snippet above).
- Every API route that does its own `cookie.parse(req.headers.cookie).athlete_id` (about 30 files, see plan-02) will STILL read the raw signed value and treat `"uuid.mac"` as an id — those queries will simply match nothing and return 401/empty, which is safe but breaks the app. **Plan-02 must land in the same deploy as this plan**, or as a minimum, do plan-02's step 2 (mechanical replacement of ad-hoc parsing with `getAthleteIdFromRequest`) as part of this change.
- `middleware.js` does not exist in this repo, but grep the whole `webapp/` tree for `athlete_id` before finishing to catch any reader you didn't migrate (`grep -rn "athlete_id" pages lib components --include=*.js | grep -v api/` for client-side, and the API list in plan-02).
- `pages/api/set-invite-cookie.js` sets a different cookie (invite token) — leave it alone.
- The Stripe webhook (`api/billing/webhook.js`) and COROS webhook (`api/webhooks/coros/activities.js`) must NOT require the session cookie — they authenticate by signature/secret. Don't break them.
- Local dev: `secure: true` is already conditional on `NODE_ENV === 'production'` — keep that, or local HTTP dev breaks.
- If `SESSION_COOKIE_SECRET` is missing the app should fail loudly at cookie write/read time (throw), not silently accept unsigned cookies.

## Acceptance criteria

1. `npm run test:auth:full` passes.
2. New test in `tests/auth-regression.test.mjs`: `getAthleteIdFromRequest` returns `null` for (a) a bare UUID cookie when legacy mode is off, (b) a tampered signature (`uuid.wrongmac`), (c) a valid signature for a different secret. Returns the id for a properly signed value.
3. Manual check: log in on the deployed app, inspect DevTools → Application → Cookies: `athlete_id` is `HttpOnly` and its value contains a `.` followed by a base64url MAC.
4. Manual attack check: in DevTools, overwrite the cookie with a bare athlete UUID (grab your own), reload `/dashboard` → you are treated as logged out (redirect to login), not logged in.
5. `/pricing` and `/connections` still detect logged-in state correctly (they no longer read `document.cookie`).
6. Logout from `/login` and `/signup` flows still clears the session (verify by reloading `/dashboard` → redirected).

## Out of scope

- Migrating to full Supabase JWT sessions (bigger refactor; the signed cookie closes the hole now).
- Route-by-route guard consolidation beyond what's needed to keep the app working — that's plan-02.
