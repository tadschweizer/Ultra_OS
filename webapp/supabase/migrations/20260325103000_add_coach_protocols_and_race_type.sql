alter table public.races
add column if not exists race_type text;

create table if not exists public.coach_profiles (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid unique references public.athletes (id) on delete cascade,
  display_name text not null,
  coach_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_athlete_links (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  coach_id uuid not null references public.coach_profiles (id) on delete cascade,
  role text not null check (role in ('primary', 'secondary')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create unique index if not exists coach_athlete_links_unique_active_role_idx
  on public.coach_athlete_links (athlete_id, role)
  where status = 'active';

create table if not exists public.coach_protocol_assignments (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  coach_id uuid not null references public.coach_profiles (id) on delete cascade,
  target_race_id uuid references public.races (id) on delete set null,
  intervention_type text not null,
  start_date date not null,
  target_completion_date date not null,
  frequency_type text not null check (frequency_type in ('daily', 'every_other_day', 'weekly', 'custom')),
  frequency_details jsonb not null default '{}'::jsonb,
  planned_sessions integer not null default 0 check (planned_sessions >= 0),
  note text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_protocol_assignments_athlete_status_idx
  on public.coach_protocol_assignments (athlete_id, status, target_completion_date desc);

alter table public.coach_profiles disable row level security;
alter table public.coach_athlete_links disable row level security;
alter table public.coach_protocol_assignments disable row level security;

grant select, insert, update, delete on table public.coach_profiles to anon, authenticated;
grant select, insert, update, delete on table public.coach_athlete_links to anon, authenticated;
grant select, insert, update, delete on table public.coach_protocol_assignments to anon, authenticated;
