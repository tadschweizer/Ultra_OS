-- ================================================================
-- Two-sided coach ↔ athlete linking
--
-- Entering a coach code used to put the athlete on that coach's roster
-- instantly, with no say from the coach. Coach codes are also short and
-- were generated from Math.random(), so they are guessable — which made
-- an unapproved instant join worth closing.
--
-- coach_athlete_relationships (the table that actually governs what a
-- coach can see) already had the right lifecycle: it defaults to
-- 'pending' and has an accepted_at column. Nothing ever moved a row out
-- of 'pending', because no acceptance endpoint was ever written.
--
-- coach_athlete_links — the older table the athlete-facing screens read —
-- only allowed 'active' or 'inactive', so it had no way to express a
-- request awaiting approval. This migration gives it one.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Allow a pending state on the legacy link table
-- ----------------------------------------------------------------
ALTER TABLE public.coach_athlete_links
  DROP CONSTRAINT IF EXISTS coach_athlete_links_status_check;

ALTER TABLE public.coach_athlete_links
  ADD CONSTRAINT coach_athlete_links_status_check
  CHECK (status IN ('pending', 'active', 'inactive'));

COMMENT ON COLUMN public.coach_athlete_links.status IS
  'pending = athlete asked to join, awaiting coach approval; active = approved; inactive = ended by either side.';

-- The existing unique index covers (athlete_id, role) WHERE status = 'active',
-- so a pending request cannot collide with a live coach. This one stops an
-- athlete from queuing the same request at the same coach repeatedly.
CREATE UNIQUE INDEX IF NOT EXISTS coach_athlete_links_unique_pending_idx
  ON public.coach_athlete_links (athlete_id, coach_id)
  WHERE status = 'pending';

-- ----------------------------------------------------------------
-- 2. Record which side started the link
--
--    An athlete-initiated request needs the coach to approve it; a
--    coach-initiated invitation needs the athlete to accept. Without
--    knowing which happened, the approval endpoints cannot tell whose
--    turn it is.
-- ----------------------------------------------------------------
ALTER TABLE public.coach_athlete_relationships
  ADD COLUMN IF NOT EXISTS initiated_by text NOT NULL DEFAULT 'coach'
    CHECK (initiated_by IN ('coach', 'athlete'));

COMMENT ON COLUMN public.coach_athlete_relationships.initiated_by IS
  'Which side created the row, and therefore which side still has to agree.';

-- Existing rows predate the request flow and were created by coaches, so
-- the 'coach' default is already correct for them.

-- ----------------------------------------------------------------
-- 3. Speed up the coach's pending-requests query
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS coach_athlete_relationships_pending_idx
  ON public.coach_athlete_relationships (coach_id, status)
  WHERE status = 'pending';
