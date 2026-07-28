# Auth Stability Contract

## Protected subsystem scope
- UI entry points: `pages/login.js`, `pages/signup.js`, `pages/auth/callback.js`,
  `pages/forgot-password.js`, `pages/reset-password.js`
- API auth endpoints: `pages/api/auth/` — `login.js`, `signup.js`, `session.js`,
  `logout.js`, `request-password-reset.js`, `reset-password.js`,
  `change-password.js`, `sign-out-everywhere.js`, `resend-verification.js`
- Session reader: `pages/api/me.js`
- Core auth modules: `lib/auth/*`, `lib/authServer.js`
- Transactional email: `lib/email/transactional.js`

## Do-not-break checklist
1. Keep the cookie name stable (`athlete_id`). The value is an HMAC-signed
   token `<athleteId>:<sessionVersion>:<expiresAtMs>.<signature>` (secret:
   `SESSION_COOKIE_SECRET`, falling back to `SUPABASE_SERVICE_ROLE_KEY`) and
   the cookie is httpOnly — never read it from client-side JS (use `/api/me`
   via `lib/meClient.js`) and never accept an unsigned or expired value.
2. **Identity merging requires a verified email.**
   `findOrCreateAthleteForAuthUser` may only adopt an existing athlete row when
   the incoming identity has a confirmed address AND the row's
   `supabase_user_id` is null. Relaxing either condition reopens an account
   takeover: athletes created through Strava have an email and no password, so
   an unverified signup on that address would be handed their account.
3. **Never auto-confirm an email.** `email_confirm: true` on user creation
   marks an address verified without anyone proving they own it. Signup mints a
   real confirmation link via `generateLink`.
4. **`session_version` is the revocation mechanism.** Bump it (via
   `bumpSessionVersion`) on password change, password reset, and
   sign-out-everywhere. Anything that issues a cookie must pass the athlete's
   current version, or it hands out a token that verifies as revoked.
5. Guard choice matters:
   - `getAthleteIdFromRequest` (sync) checks signature and expiry only.
   - `getAthleteIdFromRequestAsync` / `requireLiveAthleteId` /
     `resolveEffectiveAthleteId` also check revocation against the database.

   Use the async form on anything sensitive. Do **not** make the sync one
   async — a forgotten `await` returns a truthy Promise, which turns a missing
   keyword into an authentication bypass.
6. **Every OAuth start needs a random `state`** stored via
   `lib/auth/oauthState.js` and verified in the callback. A static or absent
   state allows account-linking CSRF.
7. Never inline auth validation into feature pages; use `lib/auth/contracts.js`
   and `lib/auth/sessionCookies.js`. Password rules live in `validatePassword` —
   client and server must share the one definition.
8. **No public email-send route.** Transactional mail is server-only via
   `lib/email/transactional.js`. An HTTP endpoint that mails an address taken
   from the request body is an open relay.
9. Coach tables (`coach_profiles`, `coach_athlete_links`,
   `coach_protocol_assignments`) have RLS on and no anon grants — reach them
   with the service-role client and authorise from the session athlete id.
10. Coach ↔ athlete linking is two-sided. A coach code raises a pending request
    the coach approves; a coach invitation is accepted by the invited athlete,
    whose account email must match the invite.
11. Treat auth error messages/status values as public contract for UI flows.
12. Any auth endpoint change must run the auth regression tests.
13. Redirect targets from `?next=` must go through `safeNextPath`
    (`lib/auth/redirects.js`), or the login page becomes an open redirect.

## Why this prevents regressions
- Centralized cookie parsing/writes remove duplicate behavior across endpoints.
- Shared request method + UUID/session validation prevents drift between handlers.
- Role-guard utilities create one policy boundary for athlete/coach/admin access.
- Regression tests lock the core invariants: signature enforcement, expiry,
  revocation, fail-closed behaviour, redirect safety, and filesystem scans that
  catch a route reading the cookie raw or reaching for the anon client.

## Deploy notes
- `SESSION_COOKIE_SECRET` — rotating it signs everyone out.
- `RESEND_API_KEY` — without it, verification and reset emails silently no-op
  (sends are best-effort by design), so **password reset will not work**.
- The session token format changed; cookies issued before it are not accepted,
  so everyone signs in once more after the deploy.

## CI-friendly command
```bash
npm run test:auth
```
