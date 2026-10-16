# Security release — October 15, 2026

## Scope and authorization

The owner authorized production configuration, the exact security migration and deployment. After verification showed no Strava webhook configuration in production and no verified provider signing support, the owner explicitly approved deploying the other protections while leaving Strava webhook ingestion disabled. COROS ingestion also remains disabled. Neither provider is claimed as live-accepted.

The release branch is based on production/main `49db06b0af16e0a03876fe16c8932aebc9212a38`. It excludes the six unrelated billing/documentation commits on the working branch.

## Verified prerequisites

- Vercel project `ultra-os-tb77`, project ID `prj_wMIqPdQTPQVXfYsmh1eNVPBA4taC`, team `team_DWc6DlROyO9iNYjQzYyyhxNn`; domain `mythreshold.co`.
- Supabase project `jzfctjaaowdvubhqswpa`. Reviewed SQL applied successfully as migration `20261016034417_security_boundary_hardening.sql`; local filename matches the server-assigned version. No earlier migrations replayed.
- Live SQL confirms all three protected functions deny anon/authenticated execution and allow service_role; pinned search paths are present. Rate-bucket RLS and client grant restrictions are active.
- Existing production Stripe signing secret accepted a locally signed, unsupported no-op event (200); tampered and unsigned variants were rejected (400). Unsupported events return before billing/database work. This validates deployed signature wiring, not delivery of a real payment or a provider-generated event.
- A new random server-only `READINESS_PROBE_SECRET` is configured for production. Its value is kept out of source and logs. The repository monitoring sample sends the bearer token; external monitors must use that token or the cheap public `/api/health` route.
- Vercel automatic DDoS mitigation is active in observed firewall traffic. One custom authentication-burst rule was published: POST `/api/auth/`, 100 requests per IP per 60 seconds, **log only**. It does not block traffic. Observe real traffic before changing its action. The application/database auth limits enforce separately.

## Isolated release verification

- Regression suite: **476 passed**, zero failures/skips (`output/security-isolated-regression.log` in the canonical checkout).
- Production build: passed (`output/security-isolated-build.log`).
- The earlier 481-test result included the separate billing branch; 476 is the correct count for this isolated security release.
- Isolated release desktop/mobile malicious-resource browser checks: **2/2 passed** (`output/security-isolated-browser.log`). Earlier broader browser checks on the original working branch passed 35 with 3 intentional project exclusions.

## Deployment acceptance

Deployed commit `997f7a6` as Vercel production deployment `dpl_4AZUPTKLJbicGvosJnVpxZYA6XvB` (Next.js 16.4.2). The staged production URL passed 29 checks before promotion. After promotion, `https://mythreshold.co` passed the same 29 checks: browser headers, public health, two unauthorized-readiness cases, three authorized readiness requests, three Stripe no-op signature cases, disabled Strava/COROS ingestion, two real QA logins/profile reads, six direct protected-RPC denials under the two QA identities, four unsafe-file/link rejections, cross-origin rejection, and coach/athlete document reads. Evidence: `output/security-staged-acceptance.json` and `output/security-production-acceptance.json` in the canonical checkout. No payment was created and no malicious document was persisted.

## Remaining limits

External-file links are screened by URL and extension; their bytes are not malware-scanned. Strict script CSP remains report-only; object/frame/base protections are enforced. Strava signing interoperability remains unavailable/unverified. Six high dependency findings remain in the Tailwind/PWA glob build chain with no compatible patched release at verification. These limits are not silently marked complete.

Source review and CI: https://github.com/tadschweizer/Ultra_OS/pull/139. The application is deployed from the isolated security branch; merge/CI state is tracked in the PR, separately from live acceptance.

Additional live checks: a safe QA document passed create/read/delete and was removed; six authenticated readiness requests across mythreshold.co and www.mythreshold.co returned 200. The first full CI browser run passed 175 tests but exposed two desktop/mobile failures in a pre-existing messaging assertion that checked saved state before the asynchronous retry completed. The assertion now waits for the saved row and cleared composer; both focused cases pass. No application messaging code changed. Full CI reruns on the corrected test.
