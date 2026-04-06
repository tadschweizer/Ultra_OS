-- =============================================================================
-- Migration: 20260405000000_add_coach_command_center.sql
-- Purpose:   Coach Command Center for Threshold
--
-- STRATEGY:
--   - coach_profiles already exists with a minimal schema (id, athlete_id,
--     display_name, coach_code, created_at). We ALTER it to add the richer
--     fields the Command Center needs rather than recreating it, so existing
--     data and foreign keys are preserved.
--   - All new tables reference athletes.id (not auth.users directly) to stay
--     consistent with the rest of the application.
--   - RLS is enabled on every new/altered table. Because existing API routes
--     use the Supabase service-role client (which bypasses RLS), these policies
--     protect direct database access and future client-side queries without
--     breaking anything today.
-- =============================================================================


-- =============================================================================
-- SECTION 1: Extend existing coach_profiles
-- =============================================================================
-- The existing table has: id, athlete_id, display_name, coach_code, created_at
-- We add the rich Command Center fields below.
-- =============================================================================

ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS bio                 text,
  ADD COLUMN IF NOT EXISTS specialties         text[],       -- e.g. ['ultrarunning','gravel','triathlon']
  ADD COLUMN IF NOT EXISTS certifications      text[],       -- e.g. ['USAT Level 1','USATF']
  ADD COLUMN IF NOT EXISTS avatar_url          text,
  ADD COLUMN IF NOT EXISTS max_athletes        integer       NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS stripe_customer_id  text,
  ADD COLUMN IF NOT EXISTS subscription_status text          NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_tier   text          NOT NULL DEFAULT 'coach_monthly',
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz   NOT NULL DEFAULT now();

-- Enable RLS (was disabled). Service-role bypasses this; existing APIs unaffected.
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;

-- Coaches can SELECT their own profile only
CREATE POLICY "coach_profiles: coaches read own"
  ON public.coach_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.athletes
      WHERE athletes.id               = coach_profiles.athlete_id
        AND athletes.supabase_user_id = auth.uid()
    )
  );

-- Coaches can INSERT their own profile only
CREATE POLICY "coach_profiles: coaches insert own"
  ON public.coach_profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.athletes
      WHERE athletes.id               = coach_profiles.athlete_id
        AND athletes.supabase_user_id = auth.uid()
    )
  );

-- Coaches can UPDATE their own profile only
CREATE POLICY "coach_profiles: coaches update own"
  ON public.coach_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.athletes
      WHERE athletes.id               = coach_profiles.athlete_id
        AND athletes.supabase_user_id = auth.uid()
    )
  );


-- =============================================================================
-- SECTION 2: coach_athlete_relationships
--
-- A richer replacement to the existing coach_athlete_links table.
-- coach_athlete_links remains for backward-compat with existing APIs.
-- This table supports the full invite/accept lifecycle, per-athlete notes,
-- and grouping used by the Command Center dashboard.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coach_athlete_relationships (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The coach who owns this relationship
  coach_id      uuid        NOT NULL
                            REFERENCES public.coach_profiles(id) ON DELETE CASCADE,

  -- The athlete in the relationship (references the app's users table)
  athlete_id    uuid        NOT NULL
                            REFERENCES public.athletes(id) ON DELETE CASCADE,

  -- Lifecycle status
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'active', 'paused', 'removed')),

  -- Timestamps for each lifecycle transition
  invited_at    timestamptz NOT NULL DEFAULT now(),
  accepted_at   timestamptz,         -- set when athlete accepts
  removed_at    timestamptz,         -- set when relationship is ended

  -- Coach-defined organisation / tagging
  group_name    text,                -- e.g. 'Marathon Group A', 'Elite Squad'

  -- Private coach notes about this specific athlete; athletes never see this column
  notes         text,

  created_at    timestamptz NOT NULL DEFAULT now(),

  -- A coach cannot have duplicate relationships with the same athlete
  UNIQUE (coach_id, athlete_id)
);

ALTER TABLE public.coach_athlete_relationships ENABLE ROW LEVEL SECURITY;

-- Coaches have full CRUD on relationships they own
CREATE POLICY "coach_athlete_relationships: coaches manage own"
  ON public.coach_athlete_relationships FOR ALL
  USING (
    EXISTS (
      SELECT 1
        FROM public.coach_profiles cp
        JOIN public.athletes       a  ON a.id = cp.athlete_id
       WHERE cp.id               = coach_athlete_relationships.coach_id
         AND a.supabase_user_id  = auth.uid()
    )
  );

-- Athletes can SELECT rows where they are the athlete (e.g. to see who coaches them)
CREATE POLICY "coach_athlete_relationships: athletes read own"
  ON public.coach_athlete_relationships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.athletes
      WHERE athletes.id               = coach_athlete_relationships.athlete_id
        AND athletes.supabase_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_car_coach_id
  ON public.coach_athlete_relationships(coach_id);

CREATE INDEX IF NOT EXISTS idx_car_athlete_id
  ON public.coach_athlete_relationships(athlete_id);


-- =============================================================================
-- SECTION 3: coach_invitations
--
-- Token-based email invites a coach sends to bring athletes onto the platform.
-- Separate from the existing beta-invite system in the `invites` table.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coach_invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  coach_id    uuid        NOT NULL
                          REFERENCES public.coach_profiles(id) ON DELETE CASCADE,

  -- The email address the invite was sent to
  email       text        NOT NULL,

  -- Unique URL token — used in the invite link the athlete receives
  token       text        NOT NULL UNIQUE,

  -- Lifecycle status
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),

  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,          -- set when invite is accepted

  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_invitations ENABLE ROW LEVEL SECURITY;

-- Coaches have full CRUD on invitations they created
CREATE POLICY "coach_invitations: coaches manage own"
  ON public.coach_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1
        FROM public.coach_profiles cp
        JOIN public.athletes       a  ON a.id = cp.athlete_id
       WHERE cp.id               = coach_invitations.coach_id
         AND a.supabase_user_id  = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_coach_invitations_coach_id
  ON public.coach_invitations(coach_id);

-- token lookups happen on every invite-link click
CREATE INDEX IF NOT EXISTS idx_coach_invitations_token
  ON public.coach_invitations(token);


-- =============================================================================
-- SECTION 4: assigned_protocols
--
-- A structured protocol a coach assigns to an athlete for a defined period.
-- This is the richer successor to coach_protocol_assignments; both tables
-- coexist so existing API routes are unaffected.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.assigned_protocols (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  coach_id           uuid        NOT NULL
                                 REFERENCES public.coach_profiles(id) ON DELETE CASCADE,

  athlete_id         uuid        NOT NULL
                                 REFERENCES public.athletes(id) ON DELETE CASCADE,

  -- Human-readable label for this assignment
  protocol_name      text        NOT NULL,

  -- Maps to intervention categories (e.g. 'heat_acclimation', 'altitude', 'nutrition')
  protocol_type      text        NOT NULL,

  description        text,

  -- Structured steps / schedule as a flexible JSON blob
  instructions       jsonb       NOT NULL DEFAULT '{}',

  -- Optional: pin to a target race
  target_race_id     uuid        REFERENCES public.races(id) ON DELETE SET NULL,

  -- Protocol window
  start_date         date        NOT NULL,
  end_date           date        NOT NULL,

  -- Lifecycle status
  status             text        NOT NULL DEFAULT 'assigned'
                                 CHECK (status IN ('assigned', 'in_progress', 'completed', 'abandoned')),

  -- Target adherence rate expressed as a percentage (0–100)
  compliance_target  integer     NOT NULL DEFAULT 80
                                 CHECK (compliance_target BETWEEN 0 AND 100),

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assigned_protocols ENABLE ROW LEVEL SECURITY;

-- Coaches have full CRUD on protocols they assigned
CREATE POLICY "assigned_protocols: coaches manage own"
  ON public.assigned_protocols FOR ALL
  USING (
    EXISTS (
      SELECT 1
        FROM public.coach_profiles cp
        JOIN public.athletes       a  ON a.id = cp.athlete_id
       WHERE cp.id               = assigned_protocols.coach_id
         AND a.supabase_user_id  = auth.uid()
    )
  );

-- Athletes can only READ protocols assigned to them
CREATE POLICY "assigned_protocols: athletes read own"
  ON public.assigned_protocols FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.athletes
      WHERE athletes.id               = assigned_protocols.athlete_id
        AND athletes.supabase_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_assigned_protocols_coach_id
  ON public.assigned_protocols(coach_id);

CREATE INDEX IF NOT EXISTS idx_assigned_protocols_athlete_id
  ON public.assigned_protocols(athlete_id);


-- =============================================================================
-- SECTION 5: coach_notes
--
-- Private notes a coach makes about an athlete.
-- Athletes NEVER have read access to this table under any circumstance.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coach_notes (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  coach_id                uuid        NOT NULL
                                      REFERENCES public.coach_profiles(id) ON DELETE CASCADE,

  athlete_id              uuid        NOT NULL
                                      REFERENCES public.athletes(id) ON DELETE CASCADE,

  -- Note body
  content                 text        NOT NULL,

  -- Categorisation to support filtered views in the UI
  note_type               text        NOT NULL
                                      CHECK (note_type IN (
                                        'observation',   -- general training observation
                                        'flag',          -- something that needs follow-up
                                        'reminder',      -- time-sensitive action item
                                        'race_debrief'   -- post-race reflection
                                      )),

  -- Optional links to related records for in-app context
  related_intervention_id uuid        REFERENCES public.interventions(id)     ON DELETE SET NULL,
  related_protocol_id     uuid        REFERENCES public.assigned_protocols(id) ON DELETE SET NULL,

  -- Pinned notes surface at the top of the athlete card
  is_pinned               boolean     NOT NULL DEFAULT false,

  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;

-- Coaches have full CRUD on their own notes only.
-- There is intentionally NO athlete-read policy here.
CREATE POLICY "coach_notes: coaches manage own"
  ON public.coach_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1
        FROM public.coach_profiles cp
        JOIN public.athletes       a  ON a.id = cp.athlete_id
       WHERE cp.id               = coach_notes.coach_id
         AND a.supabase_user_id  = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_coach_notes_coach_id
  ON public.coach_notes(coach_id);

CREATE INDEX IF NOT EXISTS idx_coach_notes_athlete_id
  ON public.coach_notes(athlete_id);


-- =============================================================================
-- SECTION 6: protocol_templates
--
-- Reusable protocol blueprints a coach builds once and assigns many times.
-- Optionally shared with all coaches on the platform (is_shared = true).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.protocol_templates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  coach_id       uuid        NOT NULL
                             REFERENCES public.coach_profiles(id) ON DELETE CASCADE,

  name           text        NOT NULL,

  -- Maps to the same intervention category taxonomy as assigned_protocols
  protocol_type  text        NOT NULL,

  description    text,

  -- The canonical template structure — same shape as assigned_protocols.instructions
  instructions   jsonb       NOT NULL DEFAULT '{}',

  -- Expected duration when this template is instantiated
  duration_weeks integer,

  -- When true, all coaches on the platform can read (but not edit) this template
  is_shared      boolean     NOT NULL DEFAULT false,

  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.protocol_templates ENABLE ROW LEVEL SECURITY;

-- Coaches have full CRUD on templates they own
CREATE POLICY "protocol_templates: coaches manage own"
  ON public.protocol_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1
        FROM public.coach_profiles cp
        JOIN public.athletes       a  ON a.id = cp.athlete_id
       WHERE cp.id               = protocol_templates.coach_id
         AND a.supabase_user_id  = auth.uid()
    )
  );

-- Any coach can READ templates that have been shared
CREATE POLICY "protocol_templates: coaches read shared"
  ON public.protocol_templates FOR SELECT
  USING (
    protocol_templates.is_shared = true
    AND EXISTS (
      SELECT 1
        FROM public.coach_profiles cp
        JOIN public.athletes       a  ON a.id = cp.athlete_id
       WHERE a.supabase_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_protocol_templates_coach_id
  ON public.protocol_templates(coach_id);

-- Partial index: only index the shared templates (small set, hot path for browsing)
CREATE INDEX IF NOT EXISTS idx_protocol_templates_shared
  ON public.protocol_templates(id)
  WHERE is_shared = true;


-- =============================================================================
-- SECTION 7: updated_at trigger
--
-- Shared trigger function keeps updated_at current on tables that have it.
-- CREATE OR REPLACE is safe to run multiple times.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- assigned_protocols.updated_at
CREATE TRIGGER trg_assigned_protocols_updated_at
  BEFORE UPDATE ON public.assigned_protocols
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- coach_profiles.updated_at (new column added above)
CREATE TRIGGER trg_coach_profiles_updated_at
  BEFORE UPDATE ON public.coach_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- SECTION 8: get_coach_dashboard_summary(coach_uuid)
--
-- Returns a single row of aggregate metrics for the Command Center header.
--
-- Columns returned:
--   total_athletes           — active coach_athlete_relationships
--   active_protocols         — protocols in 'assigned' or 'in_progress' state
--   athletes_needing_attention — active athletes with no intervention logged in 7+ days
--   upcoming_races           — races within the next 30 days for active coached athletes
--
-- Security: DEFINER so the function can query all rows regardless of RLS.
-- Execute is restricted to authenticated users only.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_coach_dashboard_summary(coach_uuid uuid)
RETURNS TABLE (
  total_athletes              integer,
  active_protocols            integer,
  athletes_needing_attention  integer,
  upcoming_races              integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    -- ── Total active athletes ───────────────────────────────────────────────
    (
      SELECT COUNT(*)::integer
        FROM public.coach_athlete_relationships car
       WHERE car.coach_id = coach_uuid
         AND car.status   = 'active'
    ) AS total_athletes,

    -- ── Active protocols (assigned or in-progress) ──────────────────────────
    (
      SELECT COUNT(*)::integer
        FROM public.assigned_protocols ap
       WHERE ap.coach_id = coach_uuid
         AND ap.status   IN ('assigned', 'in_progress')
    ) AS active_protocols,

    -- ── Athletes needing attention ──────────────────────────────────────────
    -- Active athletes who have not logged any intervention in the past 7 days.
    -- Uses inserted_at on interventions (the log-creation timestamp).
    (
      SELECT COUNT(DISTINCT car.athlete_id)::integer
        FROM public.coach_athlete_relationships car
       WHERE car.coach_id = coach_uuid
         AND car.status   = 'active'
         AND NOT EXISTS (
               SELECT 1
                 FROM public.interventions i
                WHERE i.athlete_id   = car.athlete_id
                  AND i.inserted_at >= (now() - INTERVAL '7 days')
             )
    ) AS athletes_needing_attention,

    -- ── Upcoming races (within 30 days) ────────────────────────────────────
    (
      SELECT COUNT(*)::integer
        FROM public.races r
        JOIN public.coach_athlete_relationships car
          ON car.athlete_id = r.athlete_id
       WHERE car.coach_id = coach_uuid
         AND car.status   = 'active'
         AND r.event_date BETWEEN CURRENT_DATE
                              AND (CURRENT_DATE + INTERVAL '30 days')
    ) AS upcoming_races;
$$;

-- Harden execute permissions
REVOKE EXECUTE ON FUNCTION public.get_coach_dashboard_summary(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_coach_dashboard_summary(uuid) TO authenticated;
