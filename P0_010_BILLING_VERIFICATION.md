# P0-010A — Billing review and request safety

Date: 2026-10-01
Branch: `feature/p0-010-billing-confirmation`
Review: [draft PR #127](https://github.com/tadschweizer/Ultra_OS/pull/127), implementation `5392ffd`.
Base: current `origin/main` (`4ae8cdf`, including merged PR #125).
Status: local implementation verified; Stripe sandbox and production acceptance remain open.

## Result

Opening a pricing/signup checkout URL previously could update an existing Stripe subscription,
immediately invoice prorations, and write its paid tier without a separate review or payment confirmation.
It now opens `/billing/checkout`, a read-only review of Stripe's actual recurring price. The user
must press a button to open secure billing. Existing subscribers go to Stripe's
`subscription_update_confirm` screen; Threshold does not call `subscriptions.update` or grant a
new tier merely because the user selected a plan. Same-plan selection opens management instead.

Stripe documents that this hosted flow displays upcoming invoices/prorations and handles payment
failure and authentication: [Stripe portal confirmation](https://docs.stripe.com/customer-management/portal-deep-links).

## Implemented boundaries

- Legacy checkout GET bookmarks redirect to the review page without authentication, provider,
  or database operations. Portal and sync GET requests return 405. Creation uses JSON POST.
- Browser mutations require an exact configured Origin, reject cross-site Fetch Metadata and
  non-JSON bodies, and return `Cache-Control: no-store`. Production requires an explicitly
  configured HTTPS `NEXT_PUBLIC_SITE_URL`; forwarded host/protocol headers cannot set return URLs.
- Fifteen-minute HMAC-signed reviews bind the current account, selected plan, Stripe price,
  subscription state and expiry. Changed, forged, foreign and expired reviews cannot proceed.
- Client buttons lock immediately while opening. Provider idempotency protects retries.
  New checkouts share a lifecycle key across separate reviews; an unfinished matching checkout
  is reused after verifying its actual line item. A conflicting pending plan fails closed.
- A deterministic Stripe customer is linked before new checkout. Database failures stop checkout.
  Existing customer subscriptions are checked even when a webhook has not saved a subscription ID.
  Ambiguous, incomplete, paused, unpaid, multi-item or multi-quantity subscriptions cannot cause a
  fallback second subscription. Missing/stale customer links fail safely rather than searching by email.
- Sync requires the canonical current session. A pending checkout cookie cannot restore a revoked
  or logged-out session. A returned checkout must have a matching owner, customer and completed
  paid/no-payment-required state before entitlement writes. Subscription ownership is checked too.
- Current configured/legacy price IDs determine tier; stale checkout metadata cannot override a
  plan change. Existing `past_due` grace is preserved. Unknown prices fail closed to free.
- Account Settings has POST-based Manage Billing and a guarded Refresh billing status button.
  Returning from the portal refreshes actual state before displaying an updated account.
- Client errors and server failure logs avoid raw provider/database details. Existing coach
  public-checkout denial remains enforced across both old and new auth return paths.
- CI runs the focused billing handler tests and both desktop/mobile billing browser journeys.

## Local evidence

Node.js 22.23.3, from `webapp/`:

- Full auth/regression suite: **311/311 passed**, including **51 new billing handler cases**.
- Focused billing suite: **53 cases** (51 new cases plus two existing plan cases), included above.
- Billing browser journeys: **10/10 passed** across desktop Chromium and 390 px mobile Chromium.
  These use mocked account/provider responses; they prove the UI request contract, retries,
  loading locks, same-plan behavior and layout, not live Stripe charges.
- Combined billing/pilot-access/pilot-UX browser regression: **32/32 passed** with `--workers=1`.
  The initial two-worker run passed 31/32 and hit a Windows Next.js `EPERM` manifest rename;
  the failed mobile navigation journey and the full set pass in the serial rerun.
- Production build: passed. `/billing/checkout` and `/api/billing/preview` are generated.
- `git diff --check`: passed.
- Screenshots inspected: `output/p010-desktop-chromium.png` and `output/p010-mobile-chromium.png`.
- Command logs: `output/p010-auth-tests.log`, `output/p010-build.log`, `output/p010-browser.log`.
  The broader rerun is recorded in `output/p010-pilot-browser-serial.log`.

Repeat checks in PowerShell by opening the `Ultra_OS/webapp` folder and running:

```powershell
npx --yes --package=node@22 -c "npm run test:billing"
npx --yes --package=node@22 -c "npm run test:auth:full"
npx --yes --package=node@22 -c "npm run build"
npx --yes --package=node@22 -c "npm run test:e2e:billing"
```

Run build and browser checks sequentially because they share Next.js output. Browser tests start
and stop their own local server. No production billing, database or configuration writes were made.

## P0-010B continuation

The later October 1 batch implements durable webhook receipts, current-state reconciliation,
retryable failures, asynchronous-payment handling and shared sync/webhook leases. Its migration
and signed-handler/PostgreSQL evidence are in `P0_010_012_EXECUTION.md`. The P0-010A results above
remain historical evidence; the updated document controls the current release gates.

## P0-010A handoff gates (historical; superseded by the continuation above)

1. **P0-010B: webhook replay/order and retry safety.** The existing webhook still applies historical
   subscription snapshots, ignores database update errors, and reports processing failures as
   signature failures. Add durable event deduplication, ordering/current-state reconciliation,
   retryable processing failures, asynchronous-payment handling and meaningful signed webhook tests.
   This is required before calling P0-010 complete. Revisit races between sync and webhook writes too.
2. **Isolated Stripe acceptance.** Verify the existing portal configuration enables the intended
   public Individual/Research prices and excludes coach signup/upgrade; inspect proration and
   cancellation policy. Exercise monthly/annual and Individual/Research changes, successful payment,
   declined payment, 3DS, retry, cancellation, expiry and webhook delay in a sandbox. Confirm exact
   invoice amounts and that denied/cancelled confirmations preserve the prior subscription.
3. **Deployment origin.** Check the deployment's configured billing origin matches the browser
   origin. Alternate domains and preview domains need a deliberate origin policy; the current
   boundary intentionally accepts only the configured production origin. No configuration was changed.
4. **Known recovery tradeoffs.** An existing unlinked customer is no longer recovered by email;
   use a verified successful owned checkout or a separately verified support repair. A different
   pending plan cannot open another checkout, and a recently expired/idempotently cached checkout
   may require waiting for Stripe's idempotency retention to elapse. The UI fails safely in these cases.
5. **Existing API contract.** This slice preserves the installed Stripe SDK and pinned API version.
   Coordinate a future upgrade with webhook schema tests rather than changing live event contracts
   during this request-boundary repair. No Stripe settings, tax registrations or collection behavior changed.

P0-010 remains unchecked. Local handler/browser verification does not establish sandbox or live
acceptance, and this branch must not be released as a fully verified billing integration yet.
