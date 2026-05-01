create table if not exists public.coach_groups (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_coach_groups_unique_name on public.coach_groups(coach_id, lower(name));

create table if not exists public.coach_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.coach_groups(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(group_id, athlete_id)
);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  sender_role text not null check (sender_role in ('coach','athlete')),
  message_body text not null,
  message_template_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_coach_messages_coach_athlete_created on public.coach_messages(coach_id, athlete_id, created_at desc);

alter table public.coach_athlete_relationships add column if not exists coach_group_id uuid references public.coach_groups(id) on delete set null;

alter table public.coach_groups enable row level security;
alter table public.coach_group_members enable row level security;
alter table public.coach_messages enable row level security;
