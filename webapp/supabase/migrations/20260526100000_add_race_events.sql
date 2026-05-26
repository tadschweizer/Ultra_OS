create table if not exists public.race_events (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes (id) on delete cascade not null,
  name text not null,
  event_date date,
  race_type text,
  distance_miles numeric,
  location text,
  priority text check (priority in ('A', 'B', 'C')) default 'B',
  is_goal_race boolean default false,
  url text,
  notes text,
  source text check (source in ('catalog', 'web', 'manual')) default 'manual',
  catalog_id uuid references public.race_catalog (id),
  created_at timestamptz default now()
);

alter table public.race_events disable row level security;
grant select, insert, update, delete on table public.race_events to anon, authenticated;
