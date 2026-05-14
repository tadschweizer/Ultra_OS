# Auth Stability Contract

## Protected subsystem scope
- UI entry points: `pages/login.js`, `pages/signup.js`, `pages/auth/callback.js`
- API auth endpoints: `pages/api/auth/login.js`, `signup.js`, `session.js`, `logout.js`
- Session reader: `pages/api/me.js`
- Core auth modules: `lib/auth/*`, `lib/authServer.js`

## Do-not-break checklist
1. Keep cookie name and semantics stable (`athlete_id`).
2. Never inline auth validation logic into feature pages; use `lib/auth/contracts.js` and `lib/auth/sessionCookies.js`.
3. Treat auth error messages/status values as public contract for UI flows.
4. Any auth endpoint change must run auth regression tests.
5. Any route requiring role checks should use `lib/auth/roleGuards.js`.
6. Do not couple auth flows to unrelated feature data-fetch paths.

## Why this prevents regressions
- Centralized cookie parsing/writes remove duplicate behavior across endpoints.
- Shared request method + UUID/session validation prevents drift between handlers.
- Role-guard utilities create one policy boundary for athlete/coach/admin access.
- Regression tests lock core invariants (method guard, cookie lifecycle, route guard primitives, logout behavior).

## CI-friendly command
```bash
npm run test:auth
```
