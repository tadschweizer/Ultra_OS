# Private site review — October 16, 2026

Owner request: build and deploy review mode on the actual website, restricted to the owner's account.

## Access and use

The verified login is **tadschweizer@gmail.com** (existing administrator/coach).
The separate tad.s@mythreshold.co athlete login is not enabled.

Sign in at https://www.mythreshold.co, then click **Leave feedback** near the bottom right.
Choose **Select an element**, click the part of the page, type a note, and click **Save note**.
For general problems, use **General page note**. Close the panel to keep testing normally.
Review notes can be filtered, resolved/reopened, and exported. Saved notes persist across devices.
Unsaved drafts survive panel closure and client navigation; refresh/closing the tab prompts before losing a typed draft.
Notes record pathname (not query strings), selected element description, and viewport. Input values, screenshots, console logs, and whole-page contents are not collected.
The selector is retained in the stored/exported context but the interface shows the readable label.
Review mode grants no new training, billing, or account permissions.

## Boundaries

- Membership is an explicit server-only site_reviewers row for the verified owner's athlete ID; administrator status by itself does not grant access.
- Every request verifies the real signed session and current session_version. Impersonated identities never own notes.
- A narrowly scoped middleware exemption permits the owner to annotate a read-only View-as page; ordinary athlete writes remain blocked.
- Both new tables have RLS and no public/anon/authenticated grants. Only the server service role can access them.
- Responses are private/no-store and the service worker explicitly uses NetworkOnly for the endpoint.
- JSON, origin, size, UUID, path and field bounds are checked. Retry uses the same UUID to avoid duplicate notes.
- No notifications or messages are sent to other people.

## Database release

Local migration: webapp/supabase/migrations/20261016195233_private_site_review.sql.
Applied via Supabase as **20261016195758_private_site_review**. Do not replay either filename.
One membership provisioned by joining the verified auth user and existing administrator athlete; query confirmed only that account.
Live catalog verified RLS true and anonymous reads/authenticated writes denied on both tables.
Security advisor reports expected RLS-without-policy INFO for service-only tables; existing unrelated function/auth warnings remain outside this change.
See [Supabase RLS advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Verification

- Full local regression: 482 passed, including 6 new handler/database tests.
- New browser suite: 4 passed across desktop and mobile Chromium, including selection, failure/retry, reload, resolve, export, draft preservation, hidden control for non-reviewer, and axe accessibility.
- Production build: passed locally.
- Actual PostgreSQL fixture proves grants/constraints, not just a mocked API.
- Screenshots inspected under output/playwright/ (local artifacts).
- CI, deployed checks and release commit: recorded below after release.

These checks verify review mode; they do not certify all coaching workflows, physical-phone behavior, or the broader M0 pilot gates.
