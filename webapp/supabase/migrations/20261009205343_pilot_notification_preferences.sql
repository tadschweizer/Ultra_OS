-- Live athlete replies exposed a missing legacy preference column.
-- Adding the empty preference object preserves the existing default notification behaviour.
begin;
set local lock_timeout = '5s';
alter table public.athletes add column notification_preferences jsonb not null default '{}'::jsonb;
create or replace function public.pilot_schema_readiness() returns boolean
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
    ('athletes','notification_preferences','jsonb'),
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
commit;
