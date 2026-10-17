-- Read-only catalog checks. Run on the intended release database only after
-- separately authorized migration application. Never replay historical migrations.
select jsonb_build_object(
  'completion_revision',exists(select 1 from information_schema.columns where table_schema='public' and table_name='planned_workouts' and column_name='completion_revision'),
  'response_requested',exists(select 1 from information_schema.columns where table_schema='public' and table_name='planned_workouts' and column_name='response_requested'),
  'tables',coalesce((select jsonb_object_agg(c.relname,jsonb_build_object('rls',c.relrowsecurity,
    'client_denied',not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE'),
    'service_access',has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE')))
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
      and c.relname in ('workout_coach_reviews','workout_week_publications','workout_review_actions')),'{}'),
  'functions',coalesce((select jsonb_object_agg(p.proname,jsonb_build_object('invoker',not p.prosecdef,
    'client_denied',not has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE'),
    'service_access',has_function_privilege('service_role',p.oid,'EXECUTE')))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname in ('publish_coaching_week','coaching_workout_review','coaching_review_queue','coaching_review_counts')),'{}'),
  'triggers',(select count(*) from pg_trigger where tgname in ('workout_completion_revision','workout_comment_revision') and tgenabled='O')
) as weekly_workflow;
