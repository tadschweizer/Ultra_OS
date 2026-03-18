# UltraOS Beta — Next.js + Supabase Web App

This repository contains a very simple proof‑of‑concept web app for the UltraOS beta.  It focuses on data pipelines and logging rather than a full AI analysis layer.  The goal is to let athletes log interventions against their Strava activities and view a history of what they’ve tried.

## Features

* **Strava login** – a single button on the homepage initiates OAuth with Strava.  After authorisation the app exchanges the code for an access token and refresh token and stores them against the athlete in Supabase.
* **Intervention log** – a form lets athletes select one of their recent Strava activities from the past seven days, choose an intervention type (heat acclimation, sodium bicarbonate, etc.), and record subjective responses.  The result is stored in the `interventions` table in Supabase.
* **Dashboard** – shows the athlete’s name, how many interventions they’ve logged and a snapshot of the most recent Strava activities.  Links from here allow creating a new intervention or viewing the full history.
* **History** – displays all interventions recorded by the current athlete.

The styling uses Tailwind CSS and draws inspiration from the dark, serious palette of [wasatchyard.com](https://wasatchyard.com).  The app is intentionally minimalist and opinionated to reduce scope creep.

## Requirements

* [Node.js](https://nodejs.org) 18 or newer
* A Supabase account with a project created
* Strava developer credentials (Client ID and Client Secret)

## Getting Started

1. **Clone the repository**

   ```bash
   git clone YOUR_REPO_URL_HERE
   cd ultraos
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example env file and populate it with your secrets:

   ```bash
   cp .env.local.example .env.local
   ```

   * Fill in `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` from your Strava developer settings.
   * Set `STRAVA_REDIRECT_URI` to `http://localhost:3000/api/strava/callback` when running locally.  This must match exactly the **Authorization Callback Domain** configured in your Strava app settings.
   * From your Supabase project dashboard, copy the **Project URL** and **Anon Public Key** into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` respectively.
   * Optionally, include a `SUPABASE_SERVICE_ROLE_KEY` if you enable Row Level Security (RLS) and need elevated privileges in server‑side API routes.  Do **not** expose this key to the client.

4. **Prepare your Supabase database**

   Create the following tables in your Supabase project.  You can run these SQL snippets from the SQL editor in the Supabase dashboard.  For simplicity, disable RLS on these tables during development.  In production you should implement policies and use the service role key.

   ```sql
   -- Athletes table stores basic profile and Strava tokens
   create table if not exists public.athletes (
     id uuid primary key default uuid_generate_v4(),
     name text,
     email text,
     strava_id text unique,
     access_token text,
     refresh_token text,
     token_expires_at timestamptz
   );

   -- Interventions table stores each logged intervention
   create table if not exists public.interventions (
     id uuid primary key default uuid_generate_v4(),
     athlete_id uuid references public.athletes (id) on delete cascade,
     activity_id text,
     date date,
     intervention_type text,
     details text,
     dose_duration text,
     timing text,
     gi_response integer,
     physical_response integer,
     subjective_feel integer,
     training_phase text,
     target_race text,
     notes text,
     inserted_at timestamptz default now()
   );
   ```

   If you also want to persist Strava activities you can create an `activities` table, but this MVP fetches them live from Strava instead.

5. **Set up your Strava app**

   * Go to <https://www.strava.com/settings/api> and create a new application.
   * Note your **Client ID** and **Client Secret** and place them in your `.env.local` file.
   * Set the **Authorization Callback Domain** to `localhost` and the callback path to `/api/strava/callback` so that the redirect URI becomes `http://localhost:3000/api/strava/callback`.
   * Select the scopes `read`, `activity:read`, `activity:read_all`, `profile:read_all`, and `offline_access` to enable reading activities and refreshing tokens.

6. **Run the development server**

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000> in your browser.  Click **Login with Strava**, authorise the app, and you should be taken to the dashboard.  From there you can log interventions and view your history.

## Notes on RLS and Security

For a production deployment you should enable Row Level Security in Supabase and write policies that restrict access based on the authenticated athlete.  In that scenario you will also need to use the Supabase service role key on the server (never expose it to the client) and ensure API routes run on the server side only.

The `athlete_id` cookie set by the callback route is **not** httpOnly.  This is intentional for simplicity in this MVP so that client‑side code can access it.  In a more secure implementation you would use a signed httpOnly cookie or Supabase Auth to manage sessions.

## Deploying to GitHub

This project is ready to commit to your `Ultra_OS` repository on GitHub.  To do so locally:

```bash
git init
git remote add origin git@github.com:YOUR_USERNAME/Ultra_OS.git
git add .
git commit -m "Initial UltraOS beta MVP"
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.  You will need to have created the repository beforehand.  If you prefer, you can upload the code manually through the GitHub web interface.

## Next Steps

* Add a persistence layer for Strava activities or synchronise them into Supabase for quicker queries.
* Implement token refreshing logic on a schedule to avoid expired tokens.
* Harden authentication by integrating with Supabase Auth or NextAuth.js.
* Build the AI analysis layer using the Anthropic Claude API once the data pipeline is proven.
