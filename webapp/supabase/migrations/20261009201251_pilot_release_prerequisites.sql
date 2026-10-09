-- Targeted prerequisite repair for the reviewed October 9 production gaps.
-- Apply BEFORE the separately reviewed workout-match and message-lifecycle sources.
-- Deliberately stop on existing objects; never replay the legacy groups/policies chain.
begin;

-- The existing production groups use color/sort_order, but the current handler
-- also selects description and embeds this missing membership relationship.
alter table public.coach_groups add column description text;
create table public.coach_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.coach_groups(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(group_id, athlete_id)
);
create index idx_coach_group_members_athlete on public.coach_group_members(athlete_id);
alter table public.coach_group_members enable row level security;
revoke all on public.coach_group_members from public, anon, authenticated;
grant select, insert, update, delete on public.coach_group_members to service_role;

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  sender_role text not null check (sender_role in ('coach', 'athlete')),
  message_body text not null,
  message_template_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index idx_coach_messages_coach_athlete_created
  on public.coach_messages(coach_id, athlete_id, created_at desc);

create table public.coach_shared_docs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  title text not null,
  category text not null default 'General',
  doc_type text not null check (doc_type in ('text', 'link', 'file')),
  content text,
  resource_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_coach_shared_docs_athlete_id on public.coach_shared_docs(athlete_id);
create index idx_coach_shared_docs_coach_id on public.coach_shared_docs(coach_id);
create function public.touch_coach_shared_doc() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end $$;
create trigger trg_coach_shared_docs_updated_at before update on public.coach_shared_docs
for each row execute function public.touch_coach_shared_doc();

alter table public.coach_messages enable row level security;
alter table public.coach_shared_docs enable row level security;
revoke all on public.coach_messages, public.coach_shared_docs from public, anon, authenticated;
grant select, insert, update, delete on public.coach_messages, public.coach_shared_docs to service_role;
revoke all on function public.touch_coach_shared_doc() from public, anon, authenticated;
grant execute on function public.touch_coach_shared_doc() to service_role;

-- Metadata only: no participant rows, RPC mutations, provider calls or PII.
-- This can be installed first and reports false until BOTH release migrations exist.
create function public.pilot_schema_readiness() returns boolean
language sql stable security invoker set search_path = '' as $$
  with signatures(signature) as (values
    ('public.decide_workout_activity_match(uuid,uuid,text,uuid,timestamptz)'),
    ('public.authorize_message_conversation(uuid,uuid,uuid,text)'),
    ('public.save_message_draft(uuid,uuid,uuid,text,text,text,uuid,uuid)'),
    ('public.send_direct_message(uuid,uuid,uuid,text,text,text,uuid)'),
    ('public.message_inbox_summary(uuid,text)'),
    ('public.claim_message_email()'),
    ('public.finish_message_email(uuid,uuid,text,text,text)')
  ), functions as (
    select pg_catalog.to_regprocedure(signature)::oid as oid from signatures
  ), tables(name) as (values ('coach_messages'), ('coach_shared_docs'), ('coach_groups'), ('coach_group_members'), ('message_preferences'),
    ('message_drafts'), ('message_email_deliveries'), ('coach_notifications'), ('workout_comments')),
  required_columns(table_name, column_name, type_name) as (values
    ('planned_workouts','activity_match_mode','text'),
    ('athletes','email_verified_at','timestamptz'),
    ('athletes','session_version','int4'),
    ('coach_athlete_relationships','group_name','text'),
    ('coach_groups','description','text'),
    ('workout_comments','activity_id','uuid'),
    ('coach_messages','message_template_key','text'),
    ('coach_shared_docs','resource_url','text')
  )
  select
    (select bool_and(f.oid is not null and not p.prosecdef
      and 'search_path=""'=any(p.proconfig)
      and pg_catalog.has_function_privilege('service_role',f.oid,'execute')
      and not pg_catalog.has_function_privilege('anon',f.oid,'execute')
      and not pg_catalog.has_function_privilege('authenticated',f.oid,'execute'))
      from functions f left join pg_catalog.pg_proc p on p.oid=f.oid)
    and (select bool_and(c.oid is not null and c.relrowsecurity
      and (select bool_and(pg_catalog.has_table_privilege('service_role',c.oid,action))
        from unnest(array['select','insert','update','delete']) action)
      and not pg_catalog.has_table_privilege('anon',c.oid,'select,insert,update,delete')
      and not pg_catalog.has_table_privilege('authenticated',c.oid,'select,insert,update,delete'))
      from tables t left join pg_catalog.pg_class c on c.oid=pg_catalog.to_regclass('public.'||t.name))
    and not exists(select 1 from required_columns r where not exists (
      select 1 from pg_catalog.pg_attribute a where a.attrelid=pg_catalog.to_regclass('public.'||r.table_name)
        and a.attname=r.column_name and a.atttypid=pg_catalog.to_regtype(r.type_name)
        and a.attnum>0 and not a.attisdropped))
    and exists(select 1 from pg_catalog.pg_index i
      where i.indexrelid=pg_catalog.to_regclass('public.planned_workouts_one_activity_per_athlete')
        and i.indisunique and i.indisvalid);
$$;
revoke all on function public.pilot_schema_readiness() from public, anon, authenticated;
grant execute on function public.pilot_schema_readiness() to service_role;
commit;
