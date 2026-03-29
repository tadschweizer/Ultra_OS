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
- RLS is disabled on both tables

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

This MVP intentionally keeps RLS disabled and uses an `athlete_id` cookie to keep the integration path simple. That is acceptable for short-term validation, but it is not the final auth model.

## Suggested Operating Model

- Do all code changes locally in this repo
- Push to GitHub for version control
- Let Vercel deploy preview and production
- Keep Supabase schema in versioned SQL files instead of dashboard-only edits
