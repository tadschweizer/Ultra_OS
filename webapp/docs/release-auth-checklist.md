# Release Auth Gate Checklist

> **Hard gate:** No release ships unless all auth smoke checks pass.

## Required CI gates (every PR)

Run fast smoke checks:

```bash
npm run test:auth:smoke
```

Must include coverage for:
- athlete login request validation
- coach role/login gating behavior
- protected route registry assertions
- invite acceptance input validation
- OAuth redirect URI generation sanity checks

## Extended nightly/full regression

Run broader regression suite:

```bash
npm run test:auth:full
```

Recommended cadence:
- nightly on `main`
- before release candidate cut

## Go / No-Go criteria

### GO
- `test:auth:smoke` is green on latest PR commit.
- `test:auth:full` is green in the most recent nightly run.
- OAuth provider callback URLs are explicitly configured and match runtime values:
  - Google: `https://mythreshold.co/auth/callback`
  - Strava: `https://mythreshold.co/api/strava/callback`
- Manual spot-check confirms OAuth login lands user on `/dashboard` or `/onboarding` (not `/`).

### NO-GO
- Any auth smoke regression fails.
- OAuth providers return redirect URI mismatch errors.
- Login returns to landing page with `#access_token` and does not complete session sync.

## Login incident triage (Google + Strava)

Symptoms reported:
- Strava: `{"message":"Bad Request", ... "field":"redirect_uri","code":"invalid"}`
- Google: redirect to landing URL with `#access_token=...` and no authenticated app transition.

Likely causes and checks:
1. **Strava callback mismatch**
   - Ensure Strava app settings include exact callback:
     - `https://mythreshold.co/api/strava/callback`
   - Confirm `STRAVA_REDIRECT_URI` is either unset (auto-build) or exactly matches the above.
2. **Google/Supabase redirect allow-list mismatch**
   - In Supabase Auth provider settings, include:
     - `https://mythreshold.co/auth/callback`
   - In site URL/redirect URLs, ensure callback URL is permitted; otherwise provider may return to `/` with hash tokens.
3. **Fail-fast validation**
   - Re-run `npm run test:auth:smoke` after any env/config changes.

## Actionable failure output standard

- Validation failures must return explicit 4xx with clear `error` strings.
- Test assertions must include remediation context (example: missing protected route implies auth guard bypass risk).
