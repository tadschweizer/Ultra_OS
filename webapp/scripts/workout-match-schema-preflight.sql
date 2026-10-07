-- Read-only; run before and after an explicitly authorized targeted migration.
-- Duplicate historical links are a stop condition, never an automatic cleanup.
with checks as (
  select
    exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'planned_workouts' and column_name = 'activity_match_mode') as mode_column,
    to_regprocedure('public.decide_workout_activity_match(uuid,uuid,text,uuid,timestamptz)') as decision_rpc,
    exists (select 1 from pg_index where indexrelid = to_regclass('public.planned_workouts_one_activity_per_athlete')
      and indisunique and indisvalid) as unique_activity_index,
    (select count(*) from (
      select athlete_id, completed_activity_id from public.planned_workouts
      where completed_activity_id is not null group by athlete_id, completed_activity_id
      having count(*) > 1
    ) duplicates) as duplicate_link_groups
)
select jsonb_build_object(
  'mode_column', mode_column, 'decision_rpc', decision_rpc is not null,
  'unique_activity_index', unique_activity_index, 'duplicate_link_groups', duplicate_link_groups,
  'service_role_can_execute', coalesce(has_function_privilege('service_role', decision_rpc, 'EXECUTE'), false),
  'client_roles_denied', decision_rpc is not null
    and not coalesce(has_function_privilege('anon', decision_rpc, 'EXECUTE'), true)
    and not coalesce(has_function_privilege('authenticated', decision_rpc, 'EXECUTE'), true),
  'ready', mode_column and unique_activity_index and duplicate_link_groups = 0 and decision_rpc is not null
    and coalesce(has_function_privilege('service_role', decision_rpc, 'EXECUTE'), false)
    and not coalesce(has_function_privilege('anon', decision_rpc, 'EXECUTE'), true)
    and not coalesce(has_function_privilege('authenticated', decision_rpc, 'EXECUTE'), true)
) as workout_match_readiness from checks;
