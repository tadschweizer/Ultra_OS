alter table public.coach_invitations
  add column if not exists revoked_at timestamptz,
  add column if not exists accepted_athlete_id uuid references public.athletes (id) on delete set null,
  add column if not exists created_by_athlete_id uuid references public.athletes (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.coach_invitations
  alter column expires_at set default (now() + interval '14 days');
