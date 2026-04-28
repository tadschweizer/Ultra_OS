alter table public.athletes
  add column if not exists strava_last_sync timestamptz;

alter table public.athletes
  add column if not exists strava_sync_status text not null default 'idle';

alter table public.athletes
  add column if not exists strava_sync_error text;

alter table public.athletes
  add column if not exists strava_sync_started_at timestamptz;

create table if not exists public.strava_activities (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  strava_activity_id text not null,
  name text,
  sport_type text,
  activity_type text,
  start_date timestamptz,
  timezone text,
  distance numeric,
  moving_time integer,
  elapsed_time integer,
  total_elevation_gain numeric,
  average_speed numeric,
  max_speed numeric,
  average_heartrate numeric,
  max_heartrate numeric,
  kilojoules numeric,
  trainer boolean not null default false,
  commute boolean not null default false,
  manual boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, strava_activity_id)
);

create index if not exists strava_activities_athlete_start_date_idx
  on public.strava_activities (athlete_id, start_date desc);

alter table public.strava_activities disable row level security;

grant select, insert, update, delete on table public.strava_activities to anon, authenticated;
