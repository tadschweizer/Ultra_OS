-- Read-only release gate: run against the isolated staging database first.
-- This reads catalog metadata only; it neither applies migrations nor reads
-- participant data. Both prepared migrations must precede application rollout.
do $$
declare
  copy_oid regprocedure := to_regprocedure('public.copy_planned_workout_week(uuid,uuid,uuid,date,date)');
  inbox_oid regprocedure := to_regprocedure('public.message_inbox_summary(uuid,text)');
begin
  if copy_oid is null or inbox_oid is null or to_regclass('public.workout_week_copies') is null then
    raise exception 'Calendar gap schema prerequisites missing';
  end if;
  if not exists(select 1 from pg_proc where oid=copy_oid and not prosecdef and proconfig @> array['search_path=""'])
    or not exists(select 1 from pg_proc where oid=inbox_oid and not prosecdef and proconfig @> array['search_path=""']) then
    raise exception 'Service functions must retain invoker rights and empty search_path';
  end if;
  if not has_function_privilege('service_role',copy_oid,'execute')
    or has_function_privilege('anon',copy_oid,'execute')
    or has_function_privilege('authenticated',copy_oid,'execute')
    or has_function_privilege('anon',inbox_oid,'execute')
    or has_function_privilege('authenticated',inbox_oid,'execute') then
    raise exception 'Unexpected function grants';
  end if;
  if not exists(select 1 from pg_class where oid='public.workout_week_copies'::regclass and relrowsecurity)
    or has_table_privilege('anon','public.workout_week_copies','select,insert,update,delete')
    or has_table_privilege('authenticated','public.workout_week_copies','select,insert,update,delete') then
    raise exception 'Unexpected copy-operation table access';
  end if;
  if not exists(select 1 from pg_policy where polrelid='public.planned_workouts'::regclass
    and polname='planned_workouts: private draft boundary' and not polpermissive) then
    raise exception 'Private workout restrictive policy missing';
  end if;
  if not exists(select 1 from pg_proc where oid=inbox_oid and prosrc like '%private_subject.visibility%') then
    raise exception 'Private inbox filtering missing';
  end if;
end $$;
