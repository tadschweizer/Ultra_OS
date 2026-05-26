-- ================================================================
-- RLS Hardening: enable RLS on the three remaining open tables
-- and add a public-read policy for research_sources.
--
-- Tables addressed:
--   provider_connections        — OAuth tokens, highest priority
--   activity_events             — raw webhook events
--   activity_follow_up_prompts  — post-activity prompts
--   research_sources            — public citation data (was blocked)
--
-- research_ingestion_runs and research_topic_queries already have
-- RLS enabled with zero policies (deny-all from client), which is
-- correct for internal system tables.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. provider_connections
--    Contains OAuth access/refresh tokens.
--    Athletes see and manage only their own rows.
--    Coaches deliberately excluded — tokens must not leak.
-- ----------------------------------------------------------------
ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_connections: athlete read own"
  ON public.provider_connections FOR SELECT
  USING (is_current_athlete(athlete_id));

CREATE POLICY "provider_connections: athlete manage own"
  ON public.provider_connections FOR INSERT
  WITH CHECK (is_current_athlete(athlete_id));

CREATE POLICY "provider_connections: athlete update own"
  ON public.provider_connections FOR UPDATE
  USING (is_current_athlete(athlete_id))
  WITH CHECK (is_current_athlete(athlete_id));

CREATE POLICY "provider_connections: athlete delete own"
  ON public.provider_connections FOR DELETE
  USING (is_current_athlete(athlete_id));

-- ----------------------------------------------------------------
-- 2. activity_events
--    Raw webhook events from Strava/Garmin.
--    Athletes manage their own; coaches can read their athletes'.
-- ----------------------------------------------------------------
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_events: athlete read own"
  ON public.activity_events FOR SELECT
  USING (
    is_current_athlete(athlete_id)
    OR is_current_coached_athlete(athlete_id)
  );

CREATE POLICY "activity_events: athlete manage own"
  ON public.activity_events FOR INSERT
  WITH CHECK (is_current_athlete(athlete_id));

CREATE POLICY "activity_events: athlete update own"
  ON public.activity_events FOR UPDATE
  USING (is_current_athlete(athlete_id))
  WITH CHECK (is_current_athlete(athlete_id));

CREATE POLICY "activity_events: athlete delete own"
  ON public.activity_events FOR DELETE
  USING (is_current_athlete(athlete_id));

-- ----------------------------------------------------------------
-- 3. activity_follow_up_prompts
--    Post-activity prompts shown to athletes.
--    Athletes manage their own; coaches can read for their athletes.
-- ----------------------------------------------------------------
ALTER TABLE public.activity_follow_up_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_follow_up_prompts: athlete read own"
  ON public.activity_follow_up_prompts FOR SELECT
  USING (
    is_current_athlete(athlete_id)
    OR is_current_coached_athlete(athlete_id)
  );

CREATE POLICY "activity_follow_up_prompts: athlete manage own"
  ON public.activity_follow_up_prompts FOR INSERT
  WITH CHECK (is_current_athlete(athlete_id));

CREATE POLICY "activity_follow_up_prompts: athlete update own"
  ON public.activity_follow_up_prompts FOR UPDATE
  USING (is_current_athlete(athlete_id))
  WITH CHECK (is_current_athlete(athlete_id));

CREATE POLICY "activity_follow_up_prompts: athlete delete own"
  ON public.activity_follow_up_prompts FOR DELETE
  USING (is_current_athlete(athlete_id));

-- ----------------------------------------------------------------
-- 4. research_sources
--    Citation/source records for research papers.
--    Matches the public-read policy already on research_papers.
-- ----------------------------------------------------------------
CREATE POLICY "research_sources: public read"
  ON public.research_sources FOR SELECT
  TO anon, authenticated
  USING (true);
