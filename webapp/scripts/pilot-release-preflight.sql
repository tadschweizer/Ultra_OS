-- READ ONLY. Metadata/counts only; no account records, secrets or RPC mutations.
-- Before authorizing the reviewed three-source release, repair_allowed must be true,
-- missing_base_columns empty and duplicate_activity_links zero. Recheck every release.
-- After all three sources, ready must be true and repair_allowed must be false.
with release_probe(ready) as (
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
        and i.indisunique and i.indisvalid)
), base_columns(table_name,column_name,type_name) as (values
  ('athletes','id','uuid'),
  ('athletes','email','text'),
  ('athletes','email_verified_at','timestamptz'),
  ('athletes','session_version','int4'),
  ('coach_profiles','id','uuid'),
  ('coach_profiles','athlete_id','uuid'),
  ('coach_profiles','display_name','text'),
  ('coach_groups','id','uuid'),
  ('coach_groups','coach_id','uuid'),
  ('coach_groups','name','text'),
  ('coach_groups','created_at','timestamptz'),
  ('coach_athlete_relationships','id','uuid'),
  ('coach_athlete_relationships','coach_id','uuid'),
  ('coach_athlete_relationships','athlete_id','uuid'),
  ('coach_athlete_relationships','status','text'),
  ('coach_athlete_relationships','group_name','text'),
  ('coach_notifications','id','uuid'),
  ('coach_notifications','coach_id','uuid'),
  ('coach_notifications','athlete_id','uuid'),
  ('coach_notifications','notification_type','text'),
  ('coach_notifications','title','text'),
  ('coach_notifications','body','text'),
  ('coach_notifications','entity_type','text'),
  ('coach_notifications','entity_id','uuid'),
  ('coach_notifications','read_at','timestamptz'),
  ('coach_notifications','created_at','timestamptz'),
  ('workout_comments','id','uuid'),
  ('workout_comments','athlete_id','uuid'),
  ('workout_comments','planned_workout_id','uuid'),
  ('workout_comments','activity_id','uuid'),
  ('workout_comments','sender_role','text'),
  ('workout_comments','body','text'),
  ('workout_comments','created_at','timestamptz'),
  ('workout_comments','read_at','timestamptz'),
  ('planned_workouts','id','uuid'),
  ('planned_workouts','athlete_id','uuid'),
  ('planned_workouts','title','text'),
  ('planned_workouts','workout_date','date'),
  ('planned_workouts','sport','text'),
  ('planned_workouts','status','text'),
  ('planned_workouts','completed_activity_id','text'),
  ('planned_workouts','completed_duration_min','numeric'),
  ('planned_workouts','completed_distance_km','numeric'),
  ('planned_workouts','updated_at','timestamptz'),
  ('strava_activities','id','uuid'),
  ('strava_activities','athlete_id','uuid'),
  ('strava_activities','name','text'),
  ('strava_activities','sport_type','text'),
  ('strava_activities','local_date','date'),
  ('strava_activities','moving_time','int4'),
  ('strava_activities','distance','numeric')
), missing_base as (
  select r.* from base_columns r where not exists(select 1 from pg_catalog.pg_attribute a
    where a.attrelid=pg_catalog.to_regclass('public.'||r.table_name) and a.attname=r.column_name
      and a.atttypid=pg_catalog.to_regtype(r.type_name) and a.attnum>0 and not a.attisdropped)
), repair_objects(name) as (values ('coach_messages'),('coach_shared_docs'),('coach_group_members')),
repair_state as (
  select not exists(select 1 from repair_objects where pg_catalog.to_regclass('public.'||name) is not null)
    and not exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('public.coach_groups')
      and attname='description' and attnum>0 and not attisdropped)
    and pg_catalog.to_regprocedure('public.touch_coach_shared_doc()') is null
    and pg_catalog.to_regprocedure('public.pilot_schema_readiness()') is null
    and not exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('public.planned_workouts')
      and attname='activity_match_mode' and attnum>0 and not attisdropped)
    and pg_catalog.to_regclass('public.planned_workouts_one_activity_per_athlete') is null
    and not exists(select 1 from (values
      ('public.decide_workout_activity_match(uuid,uuid,text,uuid,timestamptz)'),
      ('public.authorize_message_conversation(uuid,uuid,uuid,text)'),
      ('public.save_message_draft(uuid,uuid,uuid,text,text,text,uuid,uuid)'),
      ('public.send_direct_message(uuid,uuid,uuid,text,text,text,uuid)'),
      ('public.message_inbox_summary(uuid,text)'), ('public.claim_message_email()'),
      ('public.finish_message_email(uuid,uuid,text,text,text)')) f(signature)
      where pg_catalog.to_regprocedure(signature) is not null)
    and not exists(select 1 from (values ('message_preferences'),('message_drafts'),('message_email_deliveries')) t(name)
      where pg_catalog.to_regclass('public.'||name) is not null) as objects_absent
), duplicates as (
  select count(*)::int n from (select athlete_id,completed_activity_id from public.planned_workouts
    where completed_activity_id is not null group by athlete_id,completed_activity_id having count(*)>1) d
)
select jsonb_build_object(
  'ready',(select ready from release_probe),
  'repair_allowed',(select objects_absent from repair_state) and not exists(select 1 from missing_base)
    and (select n=0 from duplicates),
  'missing_base_columns',(select coalesce(jsonb_agg(to_jsonb(missing_base) order by table_name,column_name),'[]'::jsonb) from missing_base),
  'duplicate_activity_links',(select n from duplicates),
  'repair_objects',(select jsonb_object_agg(name,pg_catalog.to_regclass('public.'||name) is not null) from repair_objects),
  'group_description_present',exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('public.coach_groups')
    and attname='description' and attnum>0 and not attisdropped),
  'workout_mode_present',exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('public.planned_workouts')
    and attname='activity_match_mode' and attnum>0 and not attisdropped),
  'lifecycle_tables',(select jsonb_object_agg(name,pg_catalog.to_regclass('public.'||name) is not null)
    from (values ('message_preferences'),('message_drafts'),('message_email_deliveries')) t(name)),
  'readiness_rpc_present',pg_catalog.to_regprocedure('public.pilot_schema_readiness()') is not null
) as pilot_release_preflight;
