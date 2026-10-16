# Security hardening implementation — October 15, 2026

Status: original local implementation record. The authorized isolated release and subsequent production mutations are tracked in [SECURITY_RELEASE_2026-10-15.md](SECURITY_RELEASE_2026-10-15.md), which supersedes the historical release blockers below. This is a scoped hardening release, not a declaration that every possible website security risk is resolved.

## Authorized release attempt and blocking prerequisites

The owner explicitly authorized production configuration, the exact migration and deployment once signing prerequisites are verified. That authorization is retained; it does not need to be requested again.

The prerequisite is not yet met. The current [Strava webhook contract](https://developers.strava.com/docs/webhooks/) does not specify signing-secret provisioning. The [accepted developer-forum answer](https://communityhub.strava.com/developers-api-7/signature-verification-shared-signing-secret-13220), dated May 22, 2026, reports that the API team does not currently support signature verification and removed that documentation while addressing the issue. This is a community report, not direct confirmation for our app. The remaining example is insufficient evidence of a supported production signing contract. The local HMAC handler must not be deployed until app-specific provider support and a real signed delivery are verified. Its tests establish only the implemented HMAC algorithm, not Strava interoperability.

The Vercel connector returned 403 when listing environment-variable metadata for the verified project/team. The explicitly scoped CLI fallback had no credentials and started device authentication; owner sign-in is required. No secrets were read or changed. No production mutation was attempted.

Read-only release checks confirmed production is still deployment `dpl_s8Kc7AsJ32sSNH3e1sADKw5FgBR3`, serving main `49db06b0af16e0a03876fe16c8932aebc9212a38`. Supabase migration history ends at the previously applied `20261011002644`; the proposed security migration is absent. The local branch also contains six prior billing/documentation commits beyond main, so deployment must use a separately reviewed security revision rather than blindly deploying this working tree.

## Changes

| Area | Implemented behavior |
| --- | --- |
| Stripe | Existing raw-body signature verification and durable deduplication preserved; tests now also cover altered bodies, expired signatures, absent secrets and oversized bodies before database access. |
| Strava | Exact raw-body HMAC verification using `X-Strava-Signature`, five-minute delivery freshness, strict signature parsing, 16 KiB limit, and fail-closed missing configuration. Existing callback-path and subscription checks remain. |
| COROS | Unfinished webhook disabled with 503 before body parsing or database access. This matches the integration's unavailable status; no fake provider protocol was introduced. |
| Shared resources | Server and UI reject unsafe schemes, credentials in URLs, malformed/control-character URLs, and known active/executable/archive path extensions. Legacy unsafe URLs are not returned as actionable links. Documents have field limits and mutation origin/JSON checks. |
| Other external links | Race and publication links are validated at rendering; race/publication creation and avatar profile updates reject unsafe URLs. |
| Files | General binary upload remains unavailable. Shared resources are external links; the UI explicitly says files have not been scanned. Existing avatar storage limits were not weakened. No antivirus/content-verification claim is made. |
| Browser protections | Enforced object/frame/base CSP, `nosniff`, frame denial, referrer and permissions policies. Stricter script CSP is report-only for compatibility testing; it is not claimed as enforced script-injection prevention. React text escaping remains the primary text defense. |
| Authentication abuse | Atomic database reservations replace count-then-record throttling; provider work stops with 503 when the limiter is unavailable. Vercel's overwritten client-IP header is trusted only on Vercel; arbitrary Cloudflare headers are ignored. Counters expire; successful login cannot erase the reservation budget. |
| Database summary access | Migration revokes public/anonymous/authenticated execution of two privileged legacy summary functions, grants service-role access and pins their search paths. Existing API authorization remains necessary. |
| Readiness | Deep database probes require a server-only bearer secret. Missing configuration returns 503 and unauthorized requests return 401 without database work. `/api/health` remains public and cheap. Monitoring script updated. |
| Dependencies | Next.js 16.4.2, compatible lockfile updates, and patched serialization/selector-parser overrides. |

## Verification

- Full regression suite including new security tests: **481/481 passed** (`output/security-full-regression.log`).
- Production build: **passed** (`output/security-build.log`). Windows sandbox initially prevented junction creation; the approved outside-sandbox build passed.
- Desktop/mobile malicious-document browser tests: **2/2 passed** (`output/security-browser.log`). Payloads stayed text, unsafe links were absent, normal HTTPS PDF links remained usable and security headers were present.
- Broader desktop/mobile billing, navigation, pilot UX and security browser suite: **35 passed, 3 skipped** (`output/security-browser-regression.log`). Three skips are intentional desktop-only/mobile-only project exclusions, not failed tests. The local server used isolated credentials and browser API fixtures; these checks do not establish live provider acceptance.
- Migration executed against isolated PGlite. Anonymous and authenticated roles cannot execute the protected functions or rate RPC; service-role access works. Twenty queued reservations allow exactly eight requests under an eight-request policy; expiry resets the bucket. This is local SQL evidence, not a production concurrency/load test.
- Dependency audit after fixes: **0 critical, 6 high, 0 moderate/low in the production dependency graph** (`output/security-audit-after.json`). The six entries trace to `braces` through Tailwind/PWA glob tooling. The current published `braces` release is still affected; no compatible patched release was available. Inputs in this build are repository paths/configuration, not uploaded user data. Do not feed user-controlled glob expressions into these tools. Full dependency audit additionally includes legacy Cloudflare development-tool warnings. A major Tailwind/PWA/Cloudflare tooling migration is separate work; do not force-upgrade those packages blindly.
- No attack traffic, real file uploads, production webhook posts, production schema changes or production configuration changes were performed.

## Required release order — agent/operator actions

Do not deploy this code before its prerequisites. The failure behavior is deliberately restrictive.

1. Verify the target project remains Vercel `ultra-os-tb77` / `mythreshold.co` and Supabase `jzfctjaaowdvubhqswpa`. Check remote/local state and review unrelated changes before packaging.
2. Obtain explicit production authorization under `AGENTS.md`. The exact schema change is `webapp/supabase/migrations/20261016034417_security_boundary_hardening.sql`: two function permission changes, pinned search paths, an RLS-protected rate-bucket table/index, and a service-only reservation function. Apply only this reviewed migration after checking remote history; never use a broad database push.
3. Confirm Strava's signing contract and obtain the actual provider-issued/configured signing secret. Store it as server-only `STRAVA_WEBHOOK_SIGNING_SECRET` in the deployment environment. The [official example](https://developers.strava.com/docs/webhookexample/) demonstrates the signature, while the main API page does not describe provisioning. Do not invent a secret, disable verification, or treat the callback-path token as the signing secret. Until this is resolved the new POST handler intentionally returns 503 and must not be represented as live-accepted.
4. Generate a unique random monitoring secret of at least 32 characters, configure server-only `READINESS_PROBE_SECRET`, and update the uptime monitor to send `Authorization: Bearer <secret>`. Never paste secrets into logs, reports or Git. Public-only monitors should use `/api/health`.
5. Verify preview/staging: real signed Strava delivery, valid and invalid Stripe deliveries, login/reset/signup through the new SQL function, coach document create/read/delete, safe external links, and direct cross-account summary denial. Test ordinary Stripe checkout and OAuth redirects under the headers. Browser mocks do not establish provider acceptance.
6. Deploy the reviewed revision only after prerequisites and staging pass. Confirm production headers, unsigned-webhook rejection, authorized monitoring, normal sign-in, and two-account isolation. Do not send attack traffic or place payloads in real users' records.

### Rollback

Keep function restrictions and rate table in place when rolling back application code. Do not restore the old public function grants. If new sign-in fails, first verify migration/grants and the service client; do not change the limiter to fail open. If signing provisioning fails, leave COROS disabled and delay Strava rollout rather than accepting unsigned events. Monitor misconfiguration should be fixed by updating the monitor/secret, not exposing deep database probes again.

## Remaining operational work from the wider audit

This implementation does not silently close these separate items:

- Inspect/publish Vercel WAF limits and bot policies, initially log-only; verify system bypasses, attack response, spending alerts and actual alert delivery. Earlier firewall API/CLI inspection could not establish the live configuration.
- Add tuned per-account quotas for expensive authenticated exports, billing and messaging routes after measuring normal traffic. Auth reservations are not a universal API/DDoS shield.
- Enable and verify Supabase leaked-password protection; verify provider account MFA, backups and restore procedures. CAPTCHA and neutral account-enumeration responses remain separate auth/product work.
- Before a future upload feature, implement server-side byte/content inspection, safe image re-encoding, ownership checks, quarantine/scanning, size/dimension limits and safe serving. Extension rules on external links cannot prove the remote content is safe or stop malicious redirects.
- Collect and review strict CSP violations through a properly rate-limited reporting mechanism before enforcement. The current report-only header exposes diagnostics in the browser but does not deliver centralized reports.

Source base: local `a8117d1`, remote main last verified `49db06b`. Changes are local and uncommitted; this document and the roadmap record the evidence rather than marking a production release complete.
