-- Membership is provisioned separately for the verified owner, never by clients.
create table public.site_reviewers (
  athlete_id uuid primary key references public.athletes(id) on delete cascade
);
create table public.site_review_notes (
  id uuid primary key,
  athlete_id uuid not null references public.site_reviewers(athlete_id) on delete cascade,
  pathname text not null check (length(pathname) between 1 and 500 and pathname like '/%'),
  element text not null default '' check (length(element) <= 1000),
  note text not null check (length(trim(note)) between 1 and 5000),
  viewport text not null default '' check (length(viewport) <= 40),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);
create index site_review_notes_owner_created on public.site_review_notes(athlete_id, created_at desc);
alter table public.site_reviewers enable row level security;
alter table public.site_review_notes enable row level security;
revoke all on public.site_reviewers, public.site_review_notes from public, anon, authenticated;
grant select, insert, update, delete on public.site_reviewers, public.site_review_notes to service_role;
comment on table public.site_review_notes is 'Private site review; server verifies real signed session and explicit reviewer membership.';
