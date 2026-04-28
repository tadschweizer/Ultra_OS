grant usage on schema public to anon, authenticated, service_role;

alter table if exists public.athletes disable row level security;
alter table if exists public.interventions disable row level security;
alter table if exists public.athlete_settings disable row level security;
alter table if exists public.athlete_supplements disable row level security;
alter table if exists public.races disable row level security;
alter table if exists public.coach_profiles disable row level security;
alter table if exists public.coach_athlete_links disable row level security;
alter table if exists public.coach_protocol_assignments disable row level security;
alter table if exists public.race_catalog disable row level security;
alter table if exists public.invites disable row level security;

grant select, insert, update, delete on table public.athletes to anon, authenticated, service_role;
grant select, insert, update, delete on table public.interventions to anon, authenticated, service_role;
grant select, insert, update, delete on table public.athlete_settings to anon, authenticated, service_role;
grant select, insert, update, delete on table public.athlete_supplements to anon, authenticated, service_role;
grant select, insert, update, delete on table public.races to anon, authenticated, service_role;
grant select, insert, update, delete on table public.coach_profiles to anon, authenticated, service_role;
grant select, insert, update, delete on table public.coach_athlete_links to anon, authenticated, service_role;
grant select, insert, update, delete on table public.coach_protocol_assignments to anon, authenticated, service_role;
grant select, insert, update, delete on table public.race_catalog to anon, authenticated, service_role;
grant select, insert, update, delete on table public.invites to anon, authenticated, service_role;
