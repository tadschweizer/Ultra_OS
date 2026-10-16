# Website security review — October 15, 2026

Implementation follow-up: see [SECURITY_HARDENING_IMPLEMENTATION.md](SECURITY_HARDENING_IMPLEMENTATION.md) for local fixes, test evidence, remaining risks and production prerequisites. The findings below preserve the original audit state; they are not all still unfixed in local source.

Read-only assessment of Threshold. No attack traffic, production changes, or cross-account data retrieval. Source reviewed at local `a8117d1`; GitHub main verified as `49db06b`. Relevant rate limiter, readiness handler and Next config have no differences from that main revision. This is a scoped review, not a complete penetration test.

## Fix order

1. **High: restrict two live privileged database functions.** Supabase security advisors and live `pg_get_functiondef` confirm `get_coach_dashboard_summary(coach_uuid)` and `calculate_protocol_compliance(protocol_uuid)` are SECURITY DEFINER functions callable by authenticated users. Neither definition checks caller identity or ownership before returning summary/compliance data for the supplied ID. This creates a cross-account summary disclosure path for callers who know an ID. Validate intended callers, restrict execution to the backend or add explicit authorization, and pin search paths. Prove with two isolated accounts that cross-account calls fail. No other user's records were requested during this review.
2. **High: strengthen application abuse controls.** `webapp/lib/auth/rateLimit.js` is database-backed but fails open, checks counts separately from recording attempts, and prioritizes `cf-connecting-ip` without establishing a trusted Cloudflare proxy. Review trusted headers before treating this as a confirmed deployed bypass. Database errors remove this application throttle; simultaneous requests can race. `recordAuthAttempt` also ignores returned insert errors. Add edge limits before database work, atomic per-account quotas, error handling and retention. Existing auth limits are useful but are not a general DDoS defense.
3. **High: protect expensive public readiness checks.** `/api/ready` permits anonymous GET/HEAD, disables caching, and runs database/schema probes on every request. Its timeout bounds the response wait but does not cancel underlying work. Use a protected deep probe or short shared cached status, edge limits, and deduplicated failure alerts. Keep `/api/health` cheap. Review separate quotas for messages, exports, billing session creation and integration syncs; no universal API throttle was found in middleware.
4. **High: triage and patch dependencies.** `npm audit --omit=dev --json` reported 42 affected dependency entries: 1 critical, 35 high, 5 moderate, 1 low. These are package findings, not 42 proven exploitable website flaws. Next.js is 16.2.11 in local source and GitHub main. Critical advisories include Windows-hosted servers, AVIF image optimization and next/og ImageResponse. Vercel production is not established as Windows-hosted, and source search found no next/image or next/og usage or AVIF configuration. Confirm runtime applicability and update safely; do not blindly run force fixes. Build dependencies remain in this audit because some are declared as production dependencies. Raw evidence: `output/security-audit-npm.json`.
5. **Medium: add browser security headers.** A live HEAD of `https://mythreshold.co` returned 200 and HSTS, but no Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy or Permissions-Policy. `next.config.js` supplies no header policy. Introduce CSP in report-only mode, then enforce after testing auth, Stripe, Sentry and PWA behavior. Add frame restrictions and the other appropriate headers. Observation is for the homepage response, not every route.
6. **Medium: strengthen account protections.** Live Supabase advisor reports leaked-password protection disabled. Enable if supported by the project's plan. No CAPTCHA/Turnstile integration was found in the inspected auth code. Consider risk-based challenges and verify Supabase's direct auth endpoint controls separately. Login/signup responses also distinguish existing/provider-only accounts, enabling account enumeration; use neutral errors where practical.

## Hosting controls: verified versus unknown

- The Vercel project is `ultra-os-tb77`, linked to `mythreshold.co`. Vercel documents automatic DDoS mitigation on all plans. This is baseline protection; it does not ensure every costly application request is blocked.
- Active firewall configuration inspection returned 404 `Seawall Config not found`. CLI fallback could not access the specified team. **Custom WAF rules, bot controls, system-mitigation bypasses and current attack-mode state are unverified**, not proven disabled.
- Project metadata reports password protection, SSO deployment protection and trusted-IP protection disabled. Public production access is expected, but private preview deployments should be assessed separately.
- Spend alerts, hard spending actions, provider-account MFA, backup recovery tests and incident notification delivery were not verified. Check these before public launch. Code containing Sentry calls does not prove alerts reach an owner.

## Proposed firewall starting points

Review actual traffic first. Start with log-only rules, not immediate blocking: POST auth routes at 30 requests/minute/IP; GET/HEAD `/api/ready` at 30/minute/IP; POST billing checkout/sync and export routes at 20/minute/IP. These are initial observation thresholds, not measured production limits. Add per-account limits inside authenticated handlers. Shared networks may serve many legitimate athletes. Provider webhook/callback traffic needs its own policy and must not receive browser challenges indiscriminately. Tune with observed traffic and test normal sign-in, password reset, checkout and sync before enforcing.

## Existing protections and non-findings

HTTPS/HSTS is present. Source includes signed HttpOnly/Secure/SameSite session cookies, OAuth state verification, Stripe webhook signatures, same-origin checks on billing and messaging writes, role/relationship checks, and an impersonation write guard. This review does not certify every route's authorization.

The advisor's 24 RLS-enabled/no-policy notices are not proof of public data exposure: default-deny tables can intentionally be accessed only through the backend. The public `is_current_athlete` helper checks `auth.uid()` and pins its search path; its SECURITY DEFINER warning alone does not prove a vulnerability. Six mutable-search-path warnings warrant targeted review.

## References

- [Vercel DDoS protection and billing](https://vercel.com/docs/vercel-firewall/ddos-mitigation)
- [Privileged function access guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Function search-path guidance](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [AVIF advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)
- [ImageResponse advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j)

No fixes have been deployed. Acceptance requires isolated security regression tests, authenticated tenant-boundary checks, staged normal-traffic testing, and authorized production verification.

## Follow-up: webhook authenticity, malicious files and XSS

### Webhooks

- **Stripe: implemented in source.** `pages/api/billing/webhook.js` disables body parsing, caps raw payloads at 1 MiB, and uses Stripe SDK `constructEvent` on the raw bytes before database work. Missing signatures fail with 400; missing signing configuration fails with 503. Durable event receipts deduplicate processing, customer leases serialize updates, and reconciliation fetches current provider state. Existing tests use actual SDK-generated test signatures. This does not verify the live signing secret or delivery configuration. Expand negative tests to altered bodies, expired timestamps, missing secrets and oversized payloads.
- **COROS: high-priority conditional authentication bypass.** `pages/api/webhooks/coros/activities.js` only checks its bearer secret when `COROS_WEBHOOK_SECRET` exists. Missing configuration therefore permits processing and database insertion. It also lacks a strong payload schema and explicit replay/deduplication handling in the handler. Production secret presence was not inspected, so live anonymous acceptance is not claimed. Disable the unfinished integration or fail closed until correctly configured; verify the actual provider contract, use constant-time secret comparison where applicable, constrain payloads, and deduplicate provider event/workout IDs. Do not invent a provider signature scheme.
- **Strava: signing-contract gap.** `pages/api/strava/webhook/[token].js` checks a long secret callback path, subscription ID, event shape and 16 KiB size limit. It does not check a body signature or event freshness. Its comment that Strava does not sign POST bodies conflicts with the current [official example](https://developers.strava.com/docs/webhookexample/), which demonstrates `X-Strava-Signature`, HMAC over timestamp plus raw body and a five-minute freshness check. The [main webhook documentation](https://developers.strava.com/docs/webhooks/) does not describe signatures. Confirm signing-secret provisioning and actual subscription delivery contract before rollout; implement supported verification and negative/replay tests. Secret URLs are not equivalent to signed bodies, and must be redacted from logs.

### Files

- Live `storage.buckets` inspection returned one bucket, `coach-avatars`: public reads, 5 MiB maximum, allowed MIME types `image/jpeg`, `image/png`, `image/webp`. A separate storage-object policy query returned no policies; this does not establish a public upload path. Do not add permissive upload policies just to address this finding.
- No general application binary-upload handler or upload widget was found in the inspected pages/components/lib. Shared document type `file` stores an external `resource_url`; it is not an uploaded and scanned attachment.
- Bucket MIME rules are useful but do not prove file contents are safe. No application byte-signature verification, image decode/re-encode, quarantine or malware scanning path was found. Before enabling uploads, allow only required formats, validate extension/MIME/actual contents, enforce byte and image-dimension limits, generate storage names, verify ownership, and serve files safely. Reject HTML, SVG, executables, scripts, macro documents and archives unless a specific supported workflow has separate controls. JPEG/PNG/WebP should be decoded and re-encoded, not trusted solely by their labels.
- External links cannot be declared malware-free based on their extension. Validate links, clearly identify external downloads, and avoid claiming they have been scanned. A future file-fetching scanner must also defend against SSRF and redirects to private networks.
- Reference: [OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

### XSS

- Source search found no `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML` or `eval` use in the inspected application code. Ordinary React text rendering provides escaping. This is positive evidence, not proof that every XSS path is absent.
- **Confirmed URL-validation gap:** `pages/api/coach/shared-docs.js` checks only that `resource_url` is nonempty and saves it. `pages/dashboard.js` passes the stored value directly to an anchor's `href`. Validate parsed URLs on the server and at rendering; permit HTTPS external resources (and only explicitly needed alternatives), reject script/data/file schemes, controls and malformed values, and handle existing records. `target=_blank` and `rel=noreferrer` do not validate the destination. Browser script execution was not demonstrated, so this is an unsafe-URL finding rather than a confirmed working stored-XSS exploit.
- Add a tested CSP, initially report-only, alongside output encoding and URL validation. CSP is defense in depth, not a replacement for safe rendering. If rich HTML is introduced, use a maintained sanitizer with an explicit allowlist. Keep plain messages and notes as text.
- Acceptance tests should render harmless XSS fixtures in messages, document titles/content, profile fields and external links; assert text stays inert, unsafe URLs are rejected, and ordinary links still work. Run browser tests locally or in isolated staging, never by planting payloads into real users' records.
- Reference: [OWASP XSS prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

The COROS, Strava and shared-document handlers reviewed have no source differences from GitHub main `49db06b`. No production webhook requests or file uploads were made during this follow-up.

Focused existing auth/readiness regression tests passed 25/25. Evidence: output/security-focused-tests.log. Passing these tests does not validate DDoS resistance or close the identified authorization gaps.


Follow-up validation: existing billing-webhook and Strava-lifecycle tests pass 30/30 (output/security-webhook-tests.log). This verifies existing tested behavior, not the newly identified missing controls.
