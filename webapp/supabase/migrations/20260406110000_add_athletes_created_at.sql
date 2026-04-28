alter table public.athletes
add column if not exists created_at timestamptz;

update public.athletes
set created_at = coalesce(
  created_at,
  subscription_activated_at,
  (
    select min(i.inserted_at)
    from public.interventions i
    where i.athlete_id = athletes.id
  ),
  now()
);

alter table public.athletes
alter column created_at set default now();

alter table public.athletes
alter column created_at set not null;
