-- ================================================================
-- Close public access to the coach tables
--
-- 20260325103000_add_coach_protocols_and_race_type.sql ended with:
--
--   alter table public.coach_profiles          disable row level security;
--   alter table public.coach_athlete_links     disable row level security;
--   alter table public.coach_protocol_assignments disable row level security;
--   grant select, insert, update, delete on ... to anon, authenticated;
--
-- The anon key ships in the browser bundle by design, so that combination
-- let anybody with the key query these tables directly against Supabase —
-- reading every coach's roster and athlete linkage, and writing to them.
--
-- The API routes that use these tables now go through the service-role
-- client (which bypasses RLS) and authorise from the session athlete id,
-- so nothing legitimate needs the client-key grants.
--
-- Deny-all-from-client is expressed as "RLS enabled with no policies",
-- the same pattern 20260526000000_rls_hardening.sql notes for
-- research_ingestion_runs and research_topic_queries.
-- ================================================================

ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_athlete_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_protocol_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.coach_profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.coach_athlete_links FROM anon, authenticated;
REVOKE ALL ON TABLE public.coach_protocol_assignments FROM anon, authenticated;

COMMENT ON TABLE public.coach_profiles IS
  'Service-role access only. Reached through the API routes, which authorise from the session athlete id.';
COMMENT ON TABLE public.coach_athlete_links IS
  'Service-role access only. Athlete-facing coach list; coach_athlete_relationships governs data access.';
COMMENT ON TABLE public.coach_protocol_assignments IS
  'Service-role access only.';
