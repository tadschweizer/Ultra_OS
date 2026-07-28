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
-- Production had already diverged from that: RLS was re-enabled by hand,
-- with policies gating on auth.uid() via is_current_athlete() and
-- is_current_coach_profile(). Because the app authenticates with its own
-- cookie and never establishes a Supabase session, auth.uid() is null for
-- anon requests and those policies deny — so the roster was NOT publicly
-- readable, contrary to what the versioned schema implied.
--
-- What had not been cleaned up were the standing anon/authenticated
-- grants. Those are revoked here, and the ENABLE statements are repeated
-- (idempotently) so the versioned schema finally states what production
-- actually does rather than the opposite.
--
-- The same divergence explains why the coach screens read empty: the API
-- routes queried these tables with the anon client, which the policies
-- denied. Those routes now use the service-role client and authorise from
-- the session athlete id.
--
-- Deny-all-from-client is expressed as "RLS enabled with no policies",
-- the same pattern 20260526000000_rls_hardening.sql notes for
-- research_ingestion_runs and research_topic_queries.
--
-- Applied to production 2026-07-28.
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
