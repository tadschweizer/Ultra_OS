-- Read-only verification after the exact security migration. Run through an
-- authorized SQL connection; this file never changes grants, schema or data.
SELECT p.proname,
  NOT has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_denied,
  NOT has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_denied,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_allowed,
  p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
  ('get_coach_dashboard_summary','calculate_protocol_compliance','consume_auth_rate_limit');

SELECT c.relname, c.relrowsecurity,
  NOT has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon_denied,
  NOT has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS authenticated_denied
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='auth_rate_buckets';
