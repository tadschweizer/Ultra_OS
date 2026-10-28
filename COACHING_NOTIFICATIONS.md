# Workout email and text notifications

Updated: 2026-10-28. Local implementation; not deployed or activated. No real emails, verification codes, or text messages were sent during development. No production database or service settings changed.

## What this adds

Open the website menu, choose **Account → Notifications**, and find **Email and text alerts**. Each person controls their own switches; every new switch starts off.

| Event | Recipient |
| --- | --- |
| A recent activity is uploaded/imported, or a workout is manually marked complete | Connected coach(s) |
| A new workout comment or reply is saved | The other person in that coach/athlete thread |
| A coach assigns a visible workout or publishes a private draft | The athlete |

For the requested example, the coach enables Text for “An athlete uploads or completes a workout.” Beth can independently enable Email, Text, both, or neither for comments and assignments. Texts require consent and a code sent to the person's phone. Email requires a verified account email. Account preview cannot change these settings.

Direct-message email preferences remain in Messages. This change covers `workout_comments`, including comments on unassigned activities; it does not add alerts for protocol comments, arbitrary notes, inline legacy feedback fields, or direct-message texts.

## Behavior and reliability

- Atomic database triggers capture committed activity inserts, manual completion transitions, new assignments/publication, and comment inserts. Transaction rollback also rolls back the alert. Existing rows are not backfilled.
- Activity updates/upserts do not notify again. Initial imports older than 48 hours do not notify. A linked imported completion uses its activity alert, avoiding a second plan-completion alert. Independently entered manual and imported duplicates remain separate records.
- All switches are off by default. No queue entries are created for disabled channels. Switching off before the worker claims an alert suppresses it. A request already handed to a provider cannot be recalled.
- Private drafts do not notify; visibility, source existence, preference, active/unexpired/nonremoved relationship, and verified contact are checked again at delivery. Removing a phone or replying STOP suppresses queued texts.
- Service-only RLS tables/functions; live signed session and same-origin JSON writes; no recipient supplied by the browser. Phone verification has persistent account/IP/number rate limits. STOP webhook uses the exact configured URL and Twilio signature, account, and Messaging Service checks.
- Email uses a stable idempotency key, at most five attempts, and a 20-hour expiry. This fits inside [Resend's 24-hour key window](https://resend.com/docs/dashboard/emails/idempotency-keys).
- SMS timeouts, ambiguous server errors, or interrupted workers become `uncertain` rather than automatically posting a second text. Inspect the provider before attempting any manual recovery. HTTP 429 is retryable. `accepted` means the provider accepted the request, not that a phone or mailbox received it.
- Each assigned workout produces its own alert. Publishing seven workouts can send seven alerts per enabled channel. Digesting, quiet hours, provider delivery receipts, and per-athlete coach filters are not included.
- Account export includes the person's settings and delivery rows; account deletion cascades those rows. The optional-alert privacy disclosure names Resend and Twilio. Notification APIs use NetworkOnly in the PWA cache.

## Release prerequisites (not performed)

Production deployment and service configuration require explicit owner authorization under `AGENTS.md`. Keep the feature disabled until these steps are complete. Do not paste credentials into chat or commit them.

1. Review the implementation and run hosted CI against its exact commit. Reconcile with newer main changes before release.
2. Inspect hosted migration history and schema. Apply only `webapp/supabase/migrations/20261028165342_coaching_notifications.sql` once, after verifying dependencies. Existing prerequisite migrations, including private workouts and `consume_auth_rate_limit`, must not be replayed. The local SQL tests apply synthetic schema, not production.
3. Email: configure the existing Resend key and verify the sender `hello@mythreshold.co`. A stored key alone does not prove domain verification or mailbox delivery.
4. Texts: the owner needs a Twilio account, an approved SMS-capable sender in a Messaging Service, and a Verify Service. Complete the sender registration required by Twilio for its destination countries. This is a separate paid provider setup; no account or purchase was created here. See [Twilio Messaging setup](https://www.twilio.com/docs/messaging/api/message-resource) and [Verify checks](https://www.twilio.com/docs/verify/api/verification-check).
5. Configure Messaging Service [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out), STOP/START/HELP responses, and incoming POST to `https://mythreshold.co/api/coaching-notifications/sms-events`. Store that exact URL in `TWILIO_INBOUND_WEBHOOK_URL`; do not use request Host headers for validation. Route inbound messages to this webhook instead of dropping them. Verify STOP reaches both Twilio and the website.
6. Enter the server-only variables shown in `webapp/.env.coaching-notifications.example` in the deployment's environment settings. Generate a distinct worker secret of at least 32 characters. Keep preview/staging credentials isolated from production and `COACHING_NOTIFICATIONS_ENABLED=false` until ready. No new packages are required for the provider calls.
7. Configure a trusted scheduler to POST `/api/coaching-notifications/deliver-pending` every minute with `Authorization: Bearer <worker secret>`. A POST-capable scheduler is required; a plain GET cron will return 405. Each call handles at most five emails and five texts within a 40-second budget. The scheduler is intentionally not activated by this change.
8. Enable the feature only in the intended environment. With separate, consenting coach and athlete test participants, verify normal signup/email verification, phone verification, real recent workout import, manual completion, both comment directions, new assignment, opt-out while queued, STOP, removed relationship, and private-draft suppression. Confirm mailbox and physical-phone receipt separately. Do not send Beth test notifications without her agreement.
9. Monitor queue status counts and provider errors after activation. Pause by setting `COACHING_NOTIFICATIONS_ENABLED=false` and stopping the scheduler; no schema rollback is needed. Pending records expire rather than being replayed indefinitely. Set a reviewed retention/cleanup policy for completed delivery records before scaling beyond the pilot.

## Local verification

From this worktree's `webapp` directory in PowerShell:

```powershell
node --test tests/coaching-notifications.test.mjs tests/account-data.test.mjs tests/workout-comments.test.mjs tests/weekly-workflow.test.mjs tests/message-lifecycle.test.mjs
npx playwright test --config playwright.coaching-notifications.config.mjs
```

- Focused regression: 66/66 passed before adding the final notification cases; final notification suite 9/9 passed, including real PostgreSQL semantics through PGlite, API authorization, phone verification/rate limits, and signed STOP handling. Providers are mocked.
- Desktop and 390px phone-sized Chromium: 4/4 passed, covering persistence, failed-save recovery, phone verification/removal, unavailable channels, no horizontal overflow, and axe accessibility for the new panel. Screenshots inspected locally. Browser responses are intercepted synthetic fixtures, not real delivery evidence.
- Production bundle: `npx next build --webpack` passed using synthetic localhost Supabase configuration. Existing Sentry, React 18, middleware, and Edge-runtime warnings remain.
- New tests are included in `test:auth:full` and `test:e2e:critical`. Full authentication and critical regression: 523/523 passed before the final text destination-link check; the final focused suite passed all 9 cases.

Real delivery, scheduler operation, hosted migration, provider sender registration, hosted CI, and physical-device acceptance remain open. The M0 parent acceptance gates remain open.
