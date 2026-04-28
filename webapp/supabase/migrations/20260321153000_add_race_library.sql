create table if not exists public.races (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes (id) on delete cascade,
  name text not null,
  event_date date,
  distance_miles numeric,
  elevation_gain_ft integer,
  location text,
  surface text,
  notes text,
  inserted_at timestamptz default now()
);
alter table public.races disable row level security;
grant select, insert, update, delete on table public.races to anon, authenticated;
alter table public.interventions
add column if not exists race_id uuid references public.races (id) on delete set null;
