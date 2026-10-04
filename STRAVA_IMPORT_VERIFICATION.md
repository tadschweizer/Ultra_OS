# Strava import setup and verification

Updated October 3, 2026. Implementation proceeds on the owner's explicit assumption
that Strava will approve Threshold's athlete-to-coach workflow. The owner will contact
Strava before launching. This document does not record provider approval or certify
the proposed display, analytics or retention practices against Strava's agreement.

## What this change provides

- One database lease per athlete prevents concurrent page and worker imports from
  competing over rotated tokens. Success stamps and activity writes commit together.
- First import covers a two-year window; routine refresh covers 60 days. Pagination
  has a bounded request budget. A full final page produces an explicit history-limit
  error rather than falsely declaring a truncated import complete. Imports upsert
  stable athlete/provider IDs and preserve the athlete's local training day.
- Connections shows the last successful import and saved count, supports manual
  refresh, explains safe retry/reconnect errors, and confirms destructive disconnects.
  A Strava-only account needs an email/Google sign-in before using local disconnect.
- Returning Strava sign-ins preserve paid tier, primary role and the existing name.
  Granted activity scope and the current signed-session version are checked. Linking
  a different Strava identity requires disconnecting the previous one first.
- Webhooks purge source-deleted activities and dependent comments, clear credentials
  and imported data on deauthorization, and invalidate in-flight imports. Create/edit
  events deduplicate a private queue of activity IDs. One specific edit is refreshed
  per job, including activities older than the routine window. A provider 404 removes
  that queued source activity. Each successful job preserves unprocessed queue items.
- A protected worker drains pending training without waiting for a page visit. Its
  scheduler and hosted callback are configuration steps, not automatically deployed.

Manual plans, interventions and separately recorded training remain when disconnecting.
If provider deauthorization fails, local cleanup still completes and the screen directs
the athlete to Strava's My Apps settings. Backups and external providers are separate
from current-database cleanup. No seven-day retention purge or Strava approval is
claimed by this implementation; confirm permitted retention before public release.

## Verification completed

| Layer | Evidence | Limit |
| --- | --- | --- |
| Native regression | 387 tests pass, including 18 lifecycle cases using actual prerequisite/new SQL in PGlite | Synthetic provider responses |
| Real isolated database | `webapp/scripts/verify-local-strava.mjs --apply` passes six checks against Docker Supabase/Auth/PostgREST | Named loopback stack only |
| Application browser | Actual demo Auth sign-in, expired token refresh, persisted import, repeat import count of one, throttle notice, cancel/confirm disconnect, refresh persistence; desktop and 390px layout | HTTP Strava fixture; no real provider account |
| Build | Node 22 production build | Hosted configuration remains separate |

Filtered database evidence is `output/p010-012-local-strava-acceptance.json`.
The mobile screenshot is `output/playwright/local-strava-connections.png`.
Private credentials/tool output stay under ignored `webapp/.qa-private/`.
Browser disconnect removed the fixture connection and imported activity from the
labelled demo athlete. Disposable database verification accounts were also removed.

## Repeat the isolated checks on this computer

Open Docker Desktop from Start and wait for its engine to run. In PowerShell, copy:

```powershell
Set-Location 'C:\Users\BAS\Desktop\UltraOS\Ultra_OS'
docker version
supabase start --workdir output/p010-012-supabase
Set-Location webapp
npx --yes --package=node@22 -c "node scripts/verify-local-strava.mjs --apply"
```

Docker must show both Client and Server. This applies only the reviewed Strava
migration to the existing named local stack; the prerequisite activity-persistence
migration must already exist. See `STAGING_AND_CRITICAL_PATH_VERIFICATION.md` for
initial bootstrap and the earlier historical gaps. Do not use a broad remote push.

For the browser fixture, first ensure the labelled local demo pair exists using that
runbook. Open two PowerShell windows, both in the `webapp` folder. In the first:

```powershell
npx --yes --package=node@22 -c "node scripts/strava-local-fixture.mjs"
```

In the second:

```powershell
npx --yes --package=node@22 -c "node scripts/local-acceptance-server.mjs --strava-fixture"
```

Open `http://localhost:3100/login`, sign in using the athlete entry in the private
`webapp/.qa-private/local-demo.json`, then open **Connections**. The dashboard may
already have imported the activity. Click **Sync activities**; an immediate repeat
can show the 30-second throttle. Verify one imported activity after a reload.
Click **Disconnect Strava**, **Keep connection**, then reopen and **Confirm disconnect**.
Verify the connection stays removed after reloading and manual training remains.
Stop both windows with Ctrl+C before building. Stopping the fixture alone does not
remove its database connection: finish the disconnect in the app before stopping it.
The fixture refuses to replace a different Strava identity. The origin override is
limited to staging plus HTTP loopback; production and external hosts are rejected.

## Hosted staging configuration

These steps require an accepted included staging project and its stable HTTPS origin.
No paid branch, production database migration or production service change is implied.

1. Open Strava **Settings → My API Application**. Record the application ID and
   athlete capacity. Use a separate staging application if available. Inspect an
   existing webhook before changing anything: Strava permits one subscription per
   application. Do not replace the production callback to test staging.
2. In the staging host's environment settings, enter server-only `STRAVA_CLIENT_ID`
   and `STRAVA_CLIENT_SECRET`. Set `NEXT_PUBLIC_SITE_URL` to the exact stable HTTPS
   origin and `STRAVA_REDIRECT_URI` to that origin plus `/api/strava/callback`.
   In Strava's application settings, enter the matching authorization callback domain.
   Store credentials privately, never in chat, source control or `NEXT_PUBLIC_*` keys.
3. Verify/apply `20260725000000_activity_sync_persistence.sql` before the narrowly
   reviewed `20261003231047_strava_import_lifecycle.sql`. Check all six service-role
   functions and client denials. `strava_private` must stay outside exposed API schemas.
   Existing billing/role prerequisite migrations still need their separate review.
4. Generate independent random secrets of at least 32 characters for
   `STRAVA_WEBHOOK_CALLBACK_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN` and
   `STRAVA_SYNC_WORKER_SECRET`, and add them only to staging server settings.
   `.env.staging.example` contains the field names. Keep the full webhook URL secret;
   redact it in access logs, tracing and error monitoring. Our handler does not log it.
5. Register the isolated Strava webhook using its subscription API and callback
   `https://YOUR-STAGING-ORIGIN/api/strava/webhook/YOUR-CALLBACK-SECRET`, with the matching
   verification token. The GET challenge handler is available before a subscription
   ID is configured. Save the ID returned by Strava as
   `STRAVA_WEBHOOK_SUBSCRIPTION_ID`; redeploy staging settings. POST events fail closed
   until the exact subscription ID and path secret match. There is no invented ID.
6. Configure an authenticated scheduler on accepted included resources to GET
   `/api/strava/refresh-pending` with `Authorization: Bearer YOUR-WORKER-SECRET`.
   Each call processes at most one athlete and one queued edit. Choose a frequency
   that drains the actual pilot roster and respects the application's rate limits.
   The worker returns `processed: 0` when nothing is eligible. Monitor failures and
   cooldowns without logging provider credentials. No scheduler is provisioned here.

The event handler performs one database transaction and no Strava network calls.
Measure real hosted cold-start and database latency against Strava's two-second
acknowledgment requirement; local function tests cannot prove that SLA. If the
deployment cannot meet it, add a durable ingress queue before activation.

## Real provider acceptance before launch

Use a disposable staging athlete with an independent sign-in and real consent.
Check OAuth denied/accepted scopes, fresh and returning paid accounts, token rotation,
initial/repeat imports, calendar local-day matching, coach access under the proposed
approval, edits to an old activity, source delete/privacy changes, deauthorization,
delayed duplicate events, provider rate limits and worker operation without a page
visit. Verify app and provider cleanup separately. Do not perform destructive checks
on a normal participant's production account.

The owner must contact Strava about the actual coach display, calculated training
metrics and storage/retention design before public launch. Actual written approval,
API capacity, hosted OAuth/subscription registration, logging redaction, scheduler
operation and real-provider acceptance remain unverified. The earlier Stripe SDK,
business-address/data-practice, hosted Auth/Storage and physical-phone gates also remain.

Primary setup references: [Strava authentication](https://developers.strava.com/docs/authentication/)
and [Strava webhooks](https://developers.strava.com/docs/webhooks/).
