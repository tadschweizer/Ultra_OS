# Repeatable M0 verification

October 3 update: the isolated local service checks below are available. See
`P0_010_012_EXTERNAL_ACCEPTANCE.md` for the current results and open hosted/provider/phone gates.

## Start the isolated local acceptance stack

Open **Docker Desktop** from the Windows Start menu. Wait until it says the engine is running.
Open PowerShell and copy these commands one at a time:

```powershell
Set-Location 'C:\Users\BAS\Desktop\UltraOS\Ultra_OS'
docker version
```

`docker version` must show both Client and Server. A Client-only response means the Docker
Desktop engine is unavailable; open Docker Desktop and wait before retrying. The current working
backend is WSL2/Linux. Do not enable Docker's unsecured port 2375 for this verification.

This chat already initialized the separate stack at `output/p010-012-supabase`. Start it with:

```powershell
supabase start --workdir output/p010-012-supabase
Set-Location webapp
npx --yes --package=node@22 -c "node scripts/verify-local-supabase.mjs"
```

This opt-in script resets the isolated demo pair and creates/deletes disposable local records.
It refuses a remote API/database URL. Passwords are saved to the ignored
`webapp/.qa-private/local-demo.json`; do not paste or commit that file. It records Storage
leftovers before cleaning the current test file separately. Billing providers are not involved.
`--bootstrap` is for an empty local database only: it tests the repository schema and historical
SQL files, records failed transactions and then runs the focused checks. The current bootstrap
has two known historical failures; do not classify it as a complete production-schema clone.

In one PowerShell window, start the app:

```powershell
npx --yes --package=node@22 -c "node scripts/local-acceptance-server.mjs"
```

Open `http://localhost:3100/login` on this computer and use the private demo credentials.
This wrapper replaces production environment settings and disables external Stripe, Resend
and Strava credentials. Keep the window open; press **Ctrl+C** to stop the app before a build.
It listens only on this computer; this URL does not establish physical-phone acceptance.

The local Auth callback allowlist must contain `http://localhost:3100/auth/callback` and
`http://localhost:3100/reset-password`. Both were added to this isolated stack's config.
Optional analytics is disabled. After editing its config, stop/start this stack to apply it;
`supabase stop` preserves the local database volume. Do not use `--no-backup` for routine stops.

In a second PowerShell window in `webapp`, run:

```powershell
npx --yes --package=node@22 -c "node scripts/verify-local-email.mjs"
```

It checks actual Supabase SMTP/Auth with the local mailbox at `http://127.0.0.1:54324` and
records the exact callback origin. The private callback file contains session tokens.
Application Resend delivery, hosted Google OAuth and a real phone still need hosted staging.

This guide covers the P0-010–012 batch in draft PR #127. Local tests use fake accounts and
provider responses. They do not charge cards, send real invitations, or establish hosted staging acceptance.

## Run the automated checks on Windows

Open PowerShell. Copy this first command to enter the application folder:

```powershell
Set-Location 'C:\Users\BAS\Desktop\UltraOS\Ultra_OS\webapp'
```

Run these commands one at a time. Wait for each to finish before starting the next. They use
Node 22 even if the computer's default Node version is different.

```powershell
npx --yes --package=node@22 -c "npm ci"
npx --yes --package=node@22 -c "node node_modules/@playwright/test/cli.js install chromium"
npx --yes --package=node@22 -c "npm run test:auth:full"
npx --yes --package=node@22 -c "npm run test:integrations"
npx --yes --package=node@22 -c "npm run build"
npx --yes --package=node@22 -c "npm run test:e2e:critical"
```

Close any existing development server on port 3000 before the browser command. Playwright
starts its own server. Build and browser checks share `.next` and must run sequentially.
The browser suite runs desktop and 390 px mobile Chromium, including invitation return,
role navigation, pilot provisioning/revocation, onboarding, provider availability, billing
confirmation/retry, coach/athlete message exchange and draft-preserving retry, downloads,
typed deletion, keyboard cancellation, and axe WCAG smoke checks.
Some role tests intentionally run on only one viewport and show as skipped on the other.

Failures preserve browser traces in `webapp/test-results`. The GitHub Auth Smoke workflow runs
the same regression, integration, build and browser gates with Node 22 and uploads failure traces.
For a quick focused rerun, use `npm run test:billing` or `npm run test:trust` through the same Node 22 wrapper.

## Prepare an isolated environment

Do not create the previously quoted paid Supabase branch without a new cost decision. Use an
already available isolated project or a local Supabase instance. Do not point synthetic tests,
demo reset, billing tests, or deletion tests at production.

1. Copy `webapp/.env.staging.example` to a private environment file or enter its variables in
   the isolated deployment's **Preview** environment settings. Replace every placeholder using
   credentials belonging to that isolated environment. Never commit the filled file.
2. Verify the Supabase URL and service-role key belong to the same isolated project. Configure
   its own email capture/test mailbox and OAuth callback allowlist. A preview deployment alone
   does not isolate a database or Stripe account.
3. Set `NEXT_PUBLIC_SITE_URL` to the exact HTTPS origin you open in the browser. Protected billing,
   export, deletion and demo writes reject a different origin. Give staging its own session secret.
4. Use Stripe test mode or a sandbox, test prices and its own webhook signing secret. Verify the
   installed application's pinned Stripe API contract before configuring events. Enable the
   subscription and checkout/invoice events handled by `pages/api/billing/webhook.js`.
5. Apply the new migration **before** deploying the new webhook/sync handlers. Have the maintainer
   verify the target project and existing migration history first; this repository has known
   history drift, so do not run a broad remote `supabase db push` as a shortcut.
   The specific file is `webapp/supabase/migrations/20261001231152_billing_webhook_reconciliation.sql`.
   Verify the prerequisite `20261001120000_tiered_athlete_coach_plans.sql` from merged PR #126
   is applied first, so current Core/Pro/Coach tier values satisfy the athletes constraint.
6. Verify anonymous and authenticated users cannot call the three billing reconciliation RPCs;
   the service role must be able to claim, finish and release a receipt. The private tables must
   remain outside exposed schemas. Exercise a signed event and confirm one receipt and one
   canonical account update. Replay it and confirm the second response reports a duplicate.

The local SQL suite executes both relevant migrations against PGlite PostgreSQL with a minimal
athletes fixture. It verifies transaction rollback, privileges, duplicate receipts, customer
lease contention/expiry and migration reruns. It does not apply the entire historical Supabase
migration chain or test PostgREST. Docker was unavailable during this batch; a full local/hosted
Supabase migration-chain check remains open.

## Seed the demo pair safely

Enable `ALLOW_DEMO_SEED=true` only for the isolated test window. For remote staging also set
`APP_ENV=staging` and `SUPABASE_STAGING_PROJECT_REF` to the exact 20-character project reference.
The API blocks production Vercel deployments and the known production Supabase project even
if a preview has accidentally inherited production credentials. Remote URL/ref mismatches fail closed.

Sign into the isolated deployment as an administrator and open its existing demo admin page.
Use **Create demo pair** there. Save the newly generated coach and athlete passwords privately;
they are shown at creation time. Open the athlete in a separate private browser window so
the coach and athlete sessions stay separate. Reset/delete removes synthetic records, so use
only this isolated dataset. Disable `ALLOW_DEMO_SEED` after the test window.

## Phone and desktop acceptance script

Run this on a desktop browser and an actual phone. Record environment, date, tester, viewport,
account IDs without credentials, expected/actual results and any failing step.

1. Start logged out. Open Privacy, Terms and Support from the footer. Verify the monitored email,
   coach-sharing explanation and cancellation route. Confirm the legal operator identity and
   reviewed retention language before public release.
2. Coach signs in, creates an invitation and shares it only with the isolated athlete test mailbox.
   Athlete opens it while logged out, signs up/signs in, and returns to the same invitation.
   Verify both sides see the active relationship and their own role navigation after refreshing.
3. Coach assigns a workout and sends a message. Athlete logs a check-in and completion, replies,
   and verifies the coach sees the new information. Disconnect the coach from Account Settings
   and verify the coach loses ongoing access. Reconnect only if the remaining test needs it.
4. Review a test billing plan. Confirm the displayed recurring price and Stripe's exact amount
   due/proration before confirming. Cancel once and verify the prior subscription stays intact.
   Test successful payment, decline, 3DS, repeat clicks, renewal failure, downgrade, cancellation,
   asynchronous settlement and delayed/replayed/out-of-order webhook delivery in Stripe test mode.
   Compare the account's resulting tier with the current Stripe price/status. Record invoice IDs
   and amounts; a mocked browser pass cannot substitute for this step.
5. Download the athlete's training archive. Open the JSON in a text editor; verify its records,
   omissions, absence of tokens and absence of the coach's other athletes. Contact support for
   records outside this explicitly scoped download.
6. Using a disposable staging account, review deletion. Verify typing is required, keyboard
   focus is visible, and **Keep my account** cancels. Simulate billing cleanup failure first:
   deletion must stop. Then delete successfully and verify account rows, orphan cleanup,
   sign-in cleanup and billing termination. Inspect uploaded storage files separately; the current
   self-service workflow does not establish storage-object removal or backup/provider erasure.
7. Preserve evidence and remove the staging demo pair. Report any partial auth cleanup for
   operator repair; do not claim complete erasure based only on the success screen.

Production schema/configuration changes and release require separate authorization. The three
roadmap parent items stay open until their remaining acceptance gates are evidenced.
