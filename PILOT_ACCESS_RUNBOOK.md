# Closed pilot access

This feature does not create a public trial or change Stripe subscriptions. Pilot grants unlock
Coach Command Center access and daily check-ins for actively linked athletes. Existing role and
relationship authorization still applies. Unrelated athlete premium features remain on the athlete's
own plan. Existing basic coach APIs retain their role/relationship authorization; the pilot does not
turn those existing role capabilities into subscription privileges.

## Production status and remaining acceptance

1. [Baseline #113](https://github.com/tadschweizer/Ultra_OS/pull/113),
   [research #114](https://github.com/tadschweizer/Ultra_OS/pull/114), and
   [pilot #115](https://github.com/tadschweizer/Ultra_OS/pull/115) were merged in that order on
   2026-09-07. Vercel automatically deployed merge `1016373` to production.
2. The exact SQL in
   `webapp/supabase/migrations/20260907025635_pilot_coach_entitlements.sql` was applied to production
   through the Supabase migration API after the automatic app deployment. Supabase recorded version
   `20260907234756` with name `pilot_coach_entitlements`. Post-apply metadata and privileges were
   verified; no broad `supabase db push` was used.
   Post-merge review repairs shipped through
   [PR #117](https://github.com/tadschweizer/Ultra_OS/pull/117), merge `cf55e73`, and production
   deployment `dpl_BTcjsEhdznGe1G6uvShkUCJe8fae`.
   A delayed PR #117 review required one more focused follow-up: protected routes now use a generic
   fail-closed retry screen during entitlement 503s, and validated Individual/Research selections
   survive signup and onboarding while coach billing remains outside the public pilot path.
   [PR #119](https://github.com/tadschweizer/Ultra_OS/pull/119) closes the subsequent review findings:
   a canonical post-auth destination guard rejects crafted coach checkout URLs, incomplete-account
   login retains approved checkout intent, Strava onboarding retains that intent, and the server
   checkout route independently denies coach plans.
   It merged as `b4339f1` and Vercel production deployment
   `dpl_Fw9hoWzgs6fS5mDNLwsMJef7uuWv` reached READY on that exact source. Public desktop/mobile
   routing passed, and the bounded post-deploy window contained no 5xx or runtime error clusters.
3. In a future isolated staging database, apply only
   `webapp/supabase/migrations/20260907025635_pilot_coach_entitlements.sql` after reviewing its diff.
   It creates two service-only tables, a service-only invoker rate-limit function, and an optional
   relationship expiry column. Do not use broad `supabase db push` or repair unrelated history.
4. Deploy matching app source to staging and run the real-account checklist below. Staging and
   real-account acceptance remain open because the connected Supabase organization still exposes no
   development branch. Production is not a substitute for those destructive test journeys.

## Administrator provisioning and revocation

The closed pilot is one manually approved coach with up to five athletes. The operator verifies this
cohort before granting; this is an operating limit, not a new public roster/billing product.

1. Have the approved coach finish coach signup/onboarding. Signup alone creates no pilot grant.
2. Sign in as an existing administrator. Open **Admin → Pilot access** (`/admin/pilot-access`).
3. Obtain the coach profile ID from the verified coach account's `/api/me` response at
   `account.coach_profile.id`, or a read-only database lookup matching the approved account ID.
   This is the profile ID, not the athlete/account ID. Do not guess IDs or use an email match alone.
4. Paste that ID into **Coach profile ID** and click **Inspect coach**. Verify the displayed name
   and account ID against the approved participant.
5. Choose the agreed future end date (the form uses your local time), enter the reason, and click
   **Grant or renew pilot**. The saved record shows the end time. The coach refreshes the app.
6. To stop access, inspect the same coach, enter the reason, and click **Revoke pilot**. Repeating
   a grant/revoke is safe: one row per coach is updated, not duplicated. Renewal requires an explicit
   future end date. The current record retains the last acting admin, timestamp, and reason.

The API accepts only same-origin JSON POST writes with a live administrator session. GET is read-only.
`NEXT_PUBLIC_SITE_URL` must match the staging/production site origin for provisioning. Missing or
incorrect site configuration denies provisioning; it never relaxes the origin check.

## Entitlement rules

- Qualifying relationship: canonical `coach_athlete_relationships` row, status active, no removed_at,
  and expires_at either absent/null or in the future. Invitations and the legacy links table confer
  no check-in entitlement. Revoking a canonical relationship stops the benefit on subsequent requests.
- Eligible coach: existing coach profile plus an active, unrevoked pilot grant, or paid Coach tier.
  Stripe-owned accounts also require the existing active/trialing/past_due status rule. Existing
  administrator-set paid tiers without a Stripe subscription keep their previous paid meaning.
- Only check-ins are uncapped for linked athletes. The 15-intervention free limit, insights, race
  tools, research-plan rules outside check-ins, and administrator access are not expanded.
- Each save reloads entitlement. Revocation/expiry has no grace period for new requests. An already
  authorized in-flight save may finish. No history is deleted or hidden. Independent paid athlete
  access survives coach loss and does not depend on coach-table availability.
- On loss of eligibility, the existing three-check-ins-per-rolling-seven-days allowance resumes,
  counting earlier pilot check-ins by inserted_at. If already over three, the next free check-in waits
  until enough entries age out; history remains available. Research-only users return to that plan's
  existing no-check-in allowance.
- Lookup failures return 503 without inserting a check-in. UI cache drops the claimed pilot benefit
  on a 503 response and reports that access cannot be verified.
- Abuse protection is an atomic database bucket of 30 check-in submissions per fixed minute per
  athlete, across all plans. The 31st returns 429 with Retry-After. Failures return 503. Controlled test
  dates are injected only into test handlers; public requests cannot change the server clock or
  the inserted_at timestamp used for product quotas.

## Verification commands

Open PowerShell in `C:\Users\BAS\Desktop\UltraOS\Ultra_OS\webapp`.
Run the following (the wrapper selects Node 22 without replacing your global Node):

```powershell
npx --yes --package=node@22 node --test tests/pilot-entitlements.test.mjs tests/research-admin.test.mjs
npx --yes --package=node@22 -c "npm run test:auth:full"
npx --yes --package=node@22 -c "npm run build"
npx --yes --package=node@22 node node_modules/@playwright/test/cli.js test e2e/role-aware-navigation.spec.mjs e2e/pilot-access.spec.mjs
```

For the isolated SQL engine check (no production connection, no new app dependency):

```powershell
npx --yes --package=node@22 npm install --prefix ../output/pilot-sql --no-audit --no-fund --save-exact @electric-sql/pglite@0.5.8
npx --yes --package=node@22 node tests/pilot-schema.integration.mjs
```

PGlite uses PostgreSQL in WASM with minimal prerequisite tables. This validates migration SQL,
grants/RLS and the rate-limit function; it does not replace Supabase Auth, actual staging RLS,
the complete legacy migration chain, or real browser persistence.

## Required real staging acceptance (unchecked)

- [ ] Verify staging database identity is isolated; disable real email sending and use test auth.
- [ ] Fresh coach and athlete signup persist correct roles through refresh, logout/login and a new
  browser context; old accounts keep safe defaults. Client body/cookie/metadata cannot elevate roles.
- [ ] Administrator grants and revokes pilot via the UI; non-admin direct API and direct Data API
  CRUD are denied. Inspect status after refresh/new session. Verify RLS with actual Supabase tokens.
- [ ] Real anonymous/athlete/coach/admin research GET/POST/PUT/DELETE requests show denied callers
  make no privileged operation, and the admin can create/read/update/delete a staging-only entry.
- [ ] Active pilot-linked and paid-coach-linked athletes persist seven daily check-ins using a
  controlled staging test clock/fixture runner, then reload and inspect the coach's view. Do not
  create synthetic records in production. Local handler test already covers controlled dates.
- [ ] Pending, paused, expired and removed relationships, revoked/expired pilot, and independently
  paid athletes match the matrix; removal preserves history and unrelated premium gates.
- [ ] Desktop and 390 px mobile: signup copy, approval, coach workspace, athlete check-in save,
  revoked access, lookup failure, and refresh/new-session persistence.
