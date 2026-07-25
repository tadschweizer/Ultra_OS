-- Persisted imported activities.
--
-- Until now nothing in the application ever wrote to strava_activities: the
-- table held a one-off legacy load and /api/activities read straight from the
-- Strava API without saving anything. The calendar reads from the database, so
-- every completed session after the legacy load was invisible there.
--
-- This migration makes the table the durable source of truth for imported
-- training and adds the fields the calendar needs to show real totals.

create table if not exists public.strava_activities (
  id                   uuid primary key default gen_random_uuid(),
  athlete_id           uuid references public.athletes (id) on delete cascade,
  strava_activity_id   text not null,
  name                 text,
  sport_type           text,
  activity_type        text,
  start_date           timestamptz,
  timezone             text,
  distance             numeric,
  moving_time          integer,
  elapsed_time         integer,
  total_elevation_gain numeric,
  average_speed        numeric,
  max_speed            numeric,
  average_heartrate    numeric,
  max_heartrate        numeric,
  kilojoules           numeric,
  trainer              boolean,
  commute              boolean,
  manual               boolean,
  raw_payload          jsonb,
  synced_at            timestamptz default now(),
  inserted_at          timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (athlete_id, strava_activity_id)
);

-- Calendar placement must use the athlete's local day. start_date is a UTC
-- instant, so an evening session in a negative-offset timezone lands on the
-- following UTC day and would render one square too far right.
alter table public.strava_activities
  add column if not exists start_date_local timestamp,
  add column if not exists local_date        date,
  add column if not exists utc_offset        integer;

-- Fields the week rollup and workout cards surface (elevation, work, effort).
alter table public.strava_activities
  add column if not exists calories          numeric,
  add column if not exists average_cadence   numeric,
  add column if not exists suffer_score      integer,
  add column if not exists elev_high         numeric,
  add column if not exists elev_low          numeric,
  add column if not exists description       text,
  add column if not exists has_heartrate     boolean,
  add column if not exists workout_type      text,
  add column if not exists tss               numeric,
  add column if not exists intensity_factor  numeric,
  add column if not exists source            text not null default 'strava';

create index if not exists idx_strava_activities_athlete_local_date
  on public.strava_activities (athlete_id, local_date desc);

create index if not exists idx_strava_activities_athlete_start_date
  on public.strava_activities (athlete_id, start_date desc);

-- Backfill local_date for the legacy rows so existing history renders. Without
-- a stored offset the UTC day is the best available approximation.
update public.strava_activities
   set local_date = (start_date at time zone 'UTC')::date
 where local_date is null
   and start_date is not null;

-- Sync bookkeeping: throttles the on-load refresh and records whether the
-- athlete's full history has been pulled once.
alter table public.athletes
  add column if not exists last_activity_sync_at        timestamptz,
  add column if not exists activity_backfill_completed_at timestamptz,
  add column if not exists last_activity_sync_error     text;

-- Imported activity is athlete-owned data; server routes use the service role.
alter table public.strava_activities enable row level security;

drop policy if exists "strava_activities_owner_read" on public.strava_activities;
create policy "strava_activities_owner_read"
  on public.strava_activities
  for select
  using (public.is_current_athlete(athlete_id));
