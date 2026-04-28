# AGENTS.md

## Repo layout

- The active app lives in `webapp/`.
- Run app commands from `C:\Users\BAS\Desktop\UltraOS\Ultra_OS\webapp`.

## Local development

From PowerShell:

```powershell
cd C:\Users\BAS\Desktop\UltraOS\Ultra_OS\webapp
npm install
Copy-Item .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000` in your browser after `npm run dev` starts.

## Common commands

Run these from `C:\Users\BAS\Desktop\UltraOS\Ultra_OS\webapp`.

```powershell
npm run dev
npm run build
npm run start
```

- `webapp/package.json` currently defines only these three npm scripts.

## Data and config

- Base SQL lives in `webapp/supabase/schema.sql`.
- Incremental database changes live in `webapp/supabase/migrations/`.
- Vercel cron config lives in `webapp/vercel.json`.
- Server-side admin routes use `SUPABASE_SERVICE_ROLE_KEY`.
- Public URLs are built from `NEXT_PUBLIC_SITE_URL`. Coach invite links fall back to `SITE_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, or the request origin when needed.
- Stripe billing config currently expects `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_RESEARCH_MONTHLY`, `STRIPE_PRICE_INDIVIDUAL_MONTHLY`, `STRIPE_PRICE_INDIVIDUAL_ANNUAL`, `STRIPE_PRICE_COACH_MONTHLY`, and `STRIPE_PRICE_COACH_ANNUAL`.
- Email sending is optional and currently uses `RESEND_API_KEY` when coach invite or welcome emails should be sent.
- `CRON_SECRET` is required for the scheduled `/api/cron/strava-sync` endpoint.
- Research ingestion can also use `NCBI_CONTACT_EMAIL`, and `SEMANTIC_SCHOLAR_API_KEY` is optional when Semantic Scholar access should be enabled.

## Current repo workflows

- Invite flow:
  - Admin creates invite links from `/invite` or `POST /api/invites`.
  - `/join?token=...` validates the token with `PUT /api/invites`.
  - `POST /api/set-invite-cookie` stores the pending invite before Strava OAuth.
  - `/api/strava/callback` marks the invite as used after auth completes.
- Coach onboarding and invitations:
  - `/coach/setup` is a 3-step flow: save coach profile, start Stripe checkout, then create athlete invites.
  - `POST /api/billing/checkout?plan=coach_monthly|coach_annual` starts coach checkout and returns to `/coach/setup`.
  - `POST /api/billing/sync` confirms the Stripe checkout session after redirect.
  - `GET|POST|PATCH /api/coach/invitations` lists, creates, and revokes coach invites.
  - `/invite/[token]` plus `GET|POST /api/coach/invitations/[token]` handles coach invite acceptance for existing or newly created athlete accounts.
- Strava sync:
  - Vercel cron calls `/api/cron/strava-sync`.
  - `POST /api/strava/sync` lets the logged-in athlete refresh cached Strava activity data on demand.
  - The current schedule is defined in `webapp/vercel.json`.
- Research library:
  - `/content` loads research briefings from `/api/research/search`, `/api/research/topic-summary`, and published entries from `GET /api/research-library`.
  - Admin research workflows use `GET|POST|PUT|DELETE /api/research-library/admin`, `POST /api/research-library/draft`, and `GET /api/research-library/pubmed-search`.
  - Vercel cron also calls `/api/cron/research-ingest` and `/api/cron/research-summarize` as defined in `webapp/vercel.json`.
- Coach workspace:
  - `/coach/dashboard` reads from `GET /api/coach/dashboard`.
  - `/coach/settings` uses `/api/coach/subscription`, `/api/coach/billing/switch`, and `/api/coach/billing/portal` for billing management.
  - `/coach/protocols` uses `GET|POST|PUT|DELETE /api/coach/protocols` for assigned protocol management.
  - `/coach/templates` uses `GET|POST|PUT|DELETE /api/coach/templates` for reusable protocol templates.
  - `/coach/groups` uses `GET|POST|PATCH|DELETE /api/coach/groups`, and athlete drag-and-drop group changes persist through `PATCH /api/coach/relationships`.
  - `/messages` uses `GET|POST|PATCH /api/messages` for coach-athlete messaging.
  - `/notifications` uses `GET|PATCH /api/notifications` for the in-app notification inbox.
- Athlete follow-up and race review:
  - `GET|PATCH /api/follow-up-prompts` manages pending post-activity prompts created by the provider event pipeline.
  - `/race-outcome` saves post-race debriefs through `POST /api/race-outcomes`, optionally linking a Strava activity.

## Editing guidance

- Keep repo docs aligned with the actual command surface in `webapp/package.json` and checked-in config files.
- Prefer small doc updates over rewriting sections.
