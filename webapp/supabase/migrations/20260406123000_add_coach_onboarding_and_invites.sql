alter table public.coach_profiles
  add column if not exists bio text,
  add column if not exists specialties text[] not null default '{}'::text[],
  add column if not exists certifications text[] not null default '{}'::text[],
  add column if not exists avatar_url text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();
create table if not exists public.coach_invitations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles (id) on delete cascade,
  email text not null,
  token text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  revoked_at timestamptz,
  accepted_at timestamptz,
  accepted_athlete_id uuid references public.athletes (id) on delete set null,
  created_by_athlete_id uuid references public.athletes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.coach_invitations
  add column if not exists revoked_at timestamptz,
  add column if not exists accepted_athlete_id uuid references public.athletes (id) on delete set null,
  add column if not exists created_by_athlete_id uuid references public.athletes (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
alter table public.coach_invitations
  alter column expires_at set default (now() + interval '14 days');
create index if not exists coach_invitations_coach_status_idx
  on public.coach_invitations (coach_id, status, created_at desc);
create index if not exists coach_invitations_token_idx
  on public.coach_invitations (token);
create unique index if not exists coach_invitations_unique_pending_email_idx
  on public.coach_invitations (coach_id, lower(email))
  where status = 'pending';
alter table public.coach_invitations disable row level security;
grant select, insert, update, delete on table public.coach_invitations to anon, authenticated, service_role;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach-avatars',
  'coach-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
