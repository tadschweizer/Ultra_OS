-- Add COROS open ID to athletes for webhook matching
alter table public.athletes
  add column if not exists coros_open_id text unique;

-- Store raw COROS workout push payloads
create table if not exists public.coros_activities (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid references public.athletes (id) on delete set null,
  coros_open_id   text,
  workout_id      text,
  sport_type      integer,
  sport_name      text,
  start_time      timestamptz,
  end_time        timestamptz,
  raw_payload     jsonb not null default '{}'::jsonb,
  received_at     timestamptz not null default now()
);

create index if not exists idx_coros_activities_athlete_id
  on public.coros_activities (athlete_id);

create index if not exists idx_coros_activities_coros_open_id
  on public.coros_activities (coros_open_id);
