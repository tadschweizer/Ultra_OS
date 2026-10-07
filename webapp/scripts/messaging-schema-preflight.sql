-- READ ONLY. Run against the explicitly confirmed UltraOS project before
-- applying ONLY 20261007200545_messaging_delivery.sql. Do not broad db push.
select current_database(), current_user, version();
select name, to_regclass('public.'||name) is not null as exists
from unnest(array['athletes','coach_profiles','coach_athlete_relationships',
  'planned_workouts','strava_activities','workout_comments','coach_notifications',
  'coach_messages','account_notifications']) as name;
select table_name,column_name,data_type,is_nullable
from information_schema.columns where table_schema='public' and table_name in (
  'athletes','coach_profiles','coach_athlete_relationships','workout_comments',
  'coach_notifications','coach_messages','account_notifications')
order by table_name,ordinal_position;
select version,name from supabase_migrations.schema_migrations
where version in ('20261007162647','20261007200545');
select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('messaging_summary','notification_feed',
  'patch_notification_preferences','deliver_message_notification','deliver_legacy_coach_notification','require_message_relationship');
-- Existing dependent tables must exist and match their source columns. This
-- migration creates the missing direct table and preferences column only.
-- An existing account_notifications table or colliding function requires
-- investigation; stop instead of overwriting it or replaying old migrations.
