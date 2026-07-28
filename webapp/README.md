# UltraOS Beta - Next.js + Supabase Web App

This repository contains the UltraOS MVP web app. The current scope is:

- homepage and Strava OAuth entry
- Strava callback writing athlete records to Supabase
- dashboard loading athlete summary and recent activities
- intervention logging
- intervention history

The deployed app lives in `webapp/` and Vercel must use `webapp` as the project root.

## Requirements

- Node.js 20 or newer
- Git
- A Supabase project
- Strava developer credentials

## Local Development

Run all commands from `webapp/`.

1. Install dependencies

```bash
npm install
```

2. Create local environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REDIRECT_URI=http://localhost:3000/api/strava/callback`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

For local Strava testing, set the Strava app callback domain to `localhost`.

3. Create the database objects

Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL editor.

This MVP assumes:

- `public.athletes` exists
- `public.interventions` exists
- `pgcrypto` is enabled
- RLS is enabled, and the anon/authenticated roles have no table grants —
  every read and write goes through the API routes on the service-role key

4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production Configuration

Vercel Production env vars for `ultra-os-tb77`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REDIRECT_URI=https://ultra-os-tb77.vercel.app/api/strava/callback`

In Strava developer settings, the production callback domain must be:

- `ultra-os-tb77.vercel.app`

After changing environment variables, trigger a fresh production redeploy.

## Current Security Model

Auth is an HMAC-signed, httpOnly `athlete_id` cookie carrying the athlete id, a
session version and an expiry. The server enforces the expiry, and bumping
`athletes.session_version` revokes every outstanding cookie for that athlete —
which is what password change, password reset and "sign out everywhere" do.

Data access does not rely on RLS to authorise users: the API routes use the
service-role key and authorise from the session athlete id. RLS is enabled and
client-key grants are revoked so the anon key — which ships in the browser
bundle — cannot reach any table directly.

See [`docs-auth-stability.md`](./docs-auth-stability.md) for the invariants that
must not regress.

## Suggested Operating Model

- Do all code changes locally in this repo
- Push to GitHub for version control
- Let Vercel deploy preview and production
- Keep Supabase schema in versioned SQL files instead of dashboard-only edits
- Apply new migrations individually (SQL editor or the Supabase MCP), **not**
  `supabase db push`: the applied history and these filenames carry different
  version numbers for the same migrations, so a push would try to re-run work
  the database already has

## Auth QA automation

- Fast PR gate: `npm run test:auth:smoke`
- Extended nightly/full regression: `npm run test:auth:full`
- Release checklist + go/no-go criteria: `docs/release-auth-checklist.md`
