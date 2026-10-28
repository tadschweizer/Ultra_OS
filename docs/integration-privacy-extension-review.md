# Durable policy and other integrations — October 28, 2026

## Current proposal

The complete policy in `privacy-policy-proposed.md` now uses a single conditional opening: **When Garmin connectivity is available and you choose to connect your account…**. It keeps Tad's Garmin commitments, uses normal policy headings, and removes repeated project-status explanations. No universal restriction has been added. All original live disclosures and the notification paragraph remain intact.

Tad confirmed the sequence: approve and publish the lasting policy before applying, then implement and verify controls before enabling Garmin for anyone. Publication is still pending approval of the exact revised copy. The present draft label is not an effective date; approve the actual publication date separately. This is an enduring conditional commitment, not evidence that its mechanisms work today. Garmin remains disabled in the reviewed code; no route, flag, credential or configuration was changed.

Before activation, the commitment to delete stored tokens and historical data on disconnect must cover the actual storage inventory, including imported rows, raw payloads, derived personal records, queued jobs, files, caches, logs and backups. Prevent old workers or restored backups from reintroducing deleted data. Resolve any genuine retention exception openly before publishing contradictory behavior; do not silently weaken the approved requirement.

## Can these protections apply to other integrations?

Yes, Threshold can choose a consistent business policy for other providers, but the reviewed code does not prove that the full universal promise is already satisfied. Tad's confirmed scope is Garmin; his question about other integrations is not treated as permission to change every provider's policy or data lifecycle. Recommend a separate, explicit decision and audit before broadening the notice.

### Source-backed findings

| Provider/area | Verified local behavior | Limits on a universal assertion |
| --- | --- | --- |
| Strava authorization | `pages/api/strava/callback.js` checks state and activity scope; exchanges provider tokens and stores access/refresh tokens and expiry on the athlete. It can also serve as the user's only sign-in method. | Disconnect requires another sign-in method; cannot imply every account can disconnect immediately without that prerequisite. |
| Strava data | `lib/activitySync.js` stores activity metadata, dates, sport, duration, distance, speed, heart rate, cadence, elevation, calories and descriptions where present; it also stores raw provider payloads and calculated load values. It uses a 60-day incremental window and 730-day initial backfill. `pages/api/session-analysis.js` requests details/streams and supports linked-coach access. | This is more than a minimal token-only integration. Stored history, raw payloads, calculations and linked-coach access need provider-specific review. |
| Strava disconnect | `pages/api/strava/connection.js` attempts provider revocation and calls `disconnect_strava`. Migration `20261003231047_strava_import_lifecycle.sql` deletes `strava_activities`, clears provider credentials/identity/sync markers and removes private sync state. Webhook deauthorization uses the same function. Local tests verify history/token removal and stale-worker fencing. | Remote revocation can fail while local cleanup succeeds, reported as `providerCleanup: failed`. No proof here of deletion from every backup, log, browser cache, separate derivative or already-shared copy. Local tests do not establish deployed migration/configuration. |
| COROS | Login/callback use disabled shared handlers; sync is a normalization placeholder. `pages/api/webhooks/coros/activities.js` returns 503 without parsing the body. Legacy `coros_activities` is included in export and account deletion. | Existing legacy rows cannot be assumed absent. No verified COROS-specific disconnect/revocation/history lifecycle. |
| Oura / Ultrahuman | Shared login/callback fail closed; normalization scaffolding exists. Only Strava is returned by `integrationAvailability.js`. | No verified live provider lifecycle to support universal disconnect language. |
| Suunto | No tracked API implementation was found in this checkout's provider-route search. | Repository absence is not a claim about all deployments or external services. |
| AI/ML | `releaseCapabilities.js` disables automated assistance. Existing route/direct-entry tests prove guarded flows avoid provider traffic. Targeted tracked-source searches identified no direct OpenAI/Anthropic/inference client path. Training calculations and session charts are deterministic code. | Absence of a found SDK is not proof that no third-party processor uses AI. Audit Sentry/hosting/database/email/SMS vendor behavior and contracts, payloads, subprocessors and account settings before a universal no-AI statement. |
| Monetization/telemetry | No identified provider-data sale, broker or ad-network path in the reviewed implementation. Stripe billing is disclosed; Sentry config enables tracing and replay when configured. | Code review does not establish organization-wide selling/licensing practices or downstream processor restrictions. Do not equate legitimate service billing with selling provider data. |
| Account deletion | Generic workflow stops Stripe billing and removes account/associated rows, with separate storage/backup limitations. | Account deletion is distinct from disconnect; no generic full-provider erasure assurance is warranted. |

### Current official Strava requirements: separate review concern

Read the official [API Agreement](https://www.strava.com/legal/api) and [API Policy](https://www.strava.com/legal/api_policy), both displayed as effective June 1, 2026. Policy §5.3 broadly restricts AI use, including derived data; §§5.9–5.10 restrict advertising and transfers for value. §7.4 requires deletion on requests/revocation, including derived personal data, within its stated deadline and exceptions. §§5.4–5.5 and 6.2 restrict analytics/persistent storage and allow a seven-day cache. The agreement and policy also contain display/sharing restrictions and qualifications. These warrant a focused assessment of Threshold's persistent history, calculated metrics and coach access; do not assume a Garmin rule governs Strava or that a changed notice cures a data-flow conflict. Actual application permissions, exceptions and deployed configuration were not verified.

The current source's 730-day backfill and persistent database rows, deterministic analytics, and coach route are evidence of a **potential mismatch requiring review**, not a final legal finding. No provider or production data was modified, and no Strava contact was made.

## Decisions before a universal statement

1. Scope: should the same rule cover all connected fitness/health providers only, or also manual entries, uploaded files and every category of Threshold data? Do not expand to the latter by implication.
2. AI: confirm whether the rule excludes all third-party model operation/inference as well as training/fine-tuning, including derived data and vendor diagnostic AI. Provider terms may impose broader requirements independently.
3. Recipients: approve a shared no-sale/licensing/advertising/broker/monetization commitment, with a documented list of necessary service providers and their permitted processing.
4. Disconnect: approve deletion of history for every provider and specify how sign-in-only connections, mixed/manual records, derivatives, files, backups and already-shared copies are handled. Do not promise immediate erasure of every copy unless verified.
5. Resolve Strava-specific retention/analytics/display concerns against current terms and any approved application-specific exceptions before asserting general compliance.

Suggested future common language, **not inserted or approved**: “We do not use information obtained from connected fitness and health accounts to train, fine-tune, or operate third-party AI or machine-learning models. We do not sell or license that information, or share it with advertising networks, data brokers, or external monetization services.” It can become policy only after owner approval and verification of current providers and processors. Universal disconnect wording is withheld until the lifecycle audit is complete.

## Verification

Ran five existing suites, adding `strava-lifecycle.test.mjs` to the four prior suites: **41 passed, 0 failed**. SQL lifecycle tests ran locally with PGlite, including token/history deletion, stale-import protection and provider-revocation failure handling. This is local evidence only. No real accounts disconnected and no production records inspected or changed. Public source review does not certify legal compliance.
