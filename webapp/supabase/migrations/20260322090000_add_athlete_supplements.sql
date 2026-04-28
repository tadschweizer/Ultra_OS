create table if not exists public.athlete_supplements (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes (id) on delete cascade,
  supplement_name text,
  dose text,
  inserted_at timestamptz default now()
);
alter table public.athlete_supplements disable row level security;
grant select, insert, update, delete on table public.athlete_supplements to anon, authenticated;
