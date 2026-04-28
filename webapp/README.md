# Threshold Beta - Next.js + Supabase Web App

This repository contains the Threshold MVP web app. The current scope is:

- homepage and Strava OAuth entry
- Strava callback writing athlete records to Supabase
- dashboard loading athlete summary and recent activities
- Strava webhook intake plus provider-agnostic activity event records
- dashboard follow-up prompts for new activity events
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

This app assumes:

- `public.athletes` exists
- `public.interventions` exists
- `public.strava_activities` exists
- `public.provider_connections` exists
- `public.activity_events` exists
- `public.activity_follow_up_prompts` exists
- `pgcrypto` is enabled
- base schema is created first, then incremental migrations in `supabase/migrations/` are applied

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
- `STRAVA_REDIRECT_URI=https://mythreshold.co/api/strava/callback`
- `STRAVA_WEBHOOK_VERIFY_TOKEN`
- `CRON_SECRET`

In Strava developer settings, the production callback domain must be:

- `mythreshold.co`

After changing environment variables, trigger a fresh production redeploy.

## Partner Integration Readiness

- The public Login Portal is `/login`.
- The public Support Page is `/support`.
- Garmin and COROS API access is currently in progress.
- Provider partners may require the website or support center to expose both a login portal and a technical support path before approving production API access.

## Strava Sync Model

The dashboard now reads activities from `public.strava_activities` instead of calling Strava live on page load.

- Vercel cron hits `/api/cron/strava-sync` once per day
- the dashboard can trigger `/api/strava/sync` in the background after login when the cache is stale
- Strava webhooks can post to `/api/strava/webhook`
- `public.athletes.strava_last_sync` tracks the last successful sync
- `public.activity_events` stores normalized provider events so Garmin and TrainingPeaks can reuse the same downstream flow later
- `public.activity_follow_up_prompts` stores pending prompts like Workout Check-ins or intervention logging suggestions after new activity imports
- logging an intervention from a provider-linked prompt now marks the matching follow-up prompt as completed
- interventions now store `activity_provider` so future Garmin and TrainingPeaks activities can use the same logging path

If you want twice-daily sync later, update [`vercel.json`](./vercel.json). On some Vercel plans, cron frequency limits may apply.

## Current Security Model

Supabase Auth is the source of truth for authenticated users, and app tables now rely on Row Level Security policies keyed off `auth.uid()` for direct database access. The Next.js API layer uses a signed session cookie for app requests and the Supabase service role key for trusted server-side operations that must bypass RLS.

## Suggested Operating Model

- Do all code changes locally in this repo
- Push to GitHub for version control
- Let Vercel deploy preview and production
- Keep Supabase schema in versioned SQL files instead of dashboard-only edits
