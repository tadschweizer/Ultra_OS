ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS bio                 text,
  ADD COLUMN IF NOT EXISTS specialties         text[],
  ADD COLUMN IF NOT EXISTS certifications      text[],
  ADD COLUMN IF NOT EXISTS avatar_url          text,
  ADD COLUMN IF NOT EXISTS max_athletes        integer       NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS stripe_customer_id  text,
  ADD COLUMN IF NOT EXISTS subscription_status text          NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_tier   text          NOT NULL DEFAULT 'coach_monthly',
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz   NOT NULL DEFAULT now();

ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_profiles: coaches read own"
  ON public.coach_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.athletes
      WHERE athletes.id               = coach_profiles.athlete_id
        AND athletes.supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "coach_profiles: coaches insert own"
  ON public.coach_profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.athletes
      WHERE athletes.id               = coach_profiles.athlete_id
        AND athletes.supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "coach_profiles: coaches update own"
  ON public.coach_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.athletes
      WHERE athletes.id               = coach_profiles.athlete_id
        AND athletes.supabase_user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.coach_athlete_relationships (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      uuid        NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  athlete_id    uuid        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'removed')),
  invited_at    timestamptz NOT NULL DEFAULT now(),
  accepted_at   timestamptz,
  removed_at    timestamptz,
  group_name    text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, athlete_id)
);

ALTER TABLE public.coach_athlete_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_athlete_relationships: coaches manage own"
  ON public.coach_athlete_relationships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_profiles cp
      JOIN public.athletes a ON a.id = cp.athlete_id
      WHERE cp.id = coach_athlete_relationships.coach_id
        AND a.supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "coach_athlete_relationships: athletes read own"
  ON public.coach_athlete_relationships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.athletes
      WHERE athletes.id = coach_athlete_relationships.athlete_id
        AND athletes.supabase_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_car_coach_id ON public.coach_athlete_relationships(coach_id);
CREATE INDEX IF NOT EXISTS idx_car_athlete_id ON public.coach_athlete_relationships(athlete_id);

CREATE TABLE IF NOT EXISTS public.coach_invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    uuid        NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  token       text        NOT NULL UNIQUE,
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_invitations: coaches manage own"
  ON public.coach_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_profiles cp
      JOIN public.athletes a ON a.id = cp.athlete_id
      WHERE cp.id = coach_invitations.coach_id
        AND a.supabase_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_coach_invitations_coach_id ON public.coach_invitations(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_invitations_token ON public.coach_invitations(token);

CREATE TABLE IF NOT EXISTS public.assigned_protocols (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id           uuid        NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  athlete_id         uuid        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  protocol_name      text        NOT NULL,
  protocol_type      text        NOT NULL,
  description        text,
  instructions       jsonb       NOT NULL DEFAULT '{}',
  target_race_id     uuid        REFERENCES public.races(id) ON DELETE SET NULL,
  start_date         date        NOT NULL,
  end_date           date        NOT NULL,
  status             text        NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'abandoned')),
  compliance_target  integer     NOT NULL DEFAULT 80 CHECK (compliance_target BETWEEN 0 AND 100),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assigned_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assigned_protocols: coaches manage own"
  ON public.assigned_protocols FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_profiles cp
      JOIN public.athletes a ON a.id = cp.athlete_id
      WHERE cp.id = assigned_protocols.coach_id
        AND a.supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "assigned_protocols: athletes read own"
  ON public.assigned_protocols FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.athletes
      WHERE athletes.id = assigned_protocols.athlete_id
        AND athletes.supabase_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_assigned_protocols_coach_id ON public.assigned_protocols(coach_id);
CREATE INDEX IF NOT EXISTS idx_assigned_protocols_athlete_id ON public.assigned_protocols(athlete_id);

CREATE TABLE IF NOT EXISTS public.coach_notes (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id                uuid        NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  athlete_id              uuid        NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  content                 text        NOT NULL,
  note_type               text        NOT NULL CHECK (note_type IN ('observation','flag','reminder','race_debrief')),
  related_intervention_id uuid        REFERENCES public.interventions(id) ON DELETE SET NULL,
  related_protocol_id     uuid        REFERENCES public.assigned_protocols(id) ON DELETE SET NULL,
  is_pinned               boolean     NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_notes: coaches manage own"
  ON public.coach_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_profiles cp
      JOIN public.athletes a ON a.id = cp.athlete_id
      WHERE cp.id = coach_notes.coach_id
        AND a.supabase_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_coach_notes_coach_id ON public.coach_notes(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_notes_athlete_id ON public.coach_notes(athlete_id);

CREATE TABLE IF NOT EXISTS public.protocol_templates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id       uuid        NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  protocol_type  text        NOT NULL,
  description    text,
  instructions   jsonb       NOT NULL DEFAULT '{}',
  duration_weeks integer,
  is_shared      boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.protocol_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "protocol_templates: coaches manage own"
  ON public.protocol_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_profiles cp
      JOIN public.athletes a ON a.id = cp.athlete_id
      WHERE cp.id = protocol_templates.coach_id
        AND a.supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "protocol_templates: coaches read shared"
  ON public.protocol_templates FOR SELECT
  USING (
    protocol_templates.is_shared = true
    AND EXISTS (
      SELECT 1 FROM public.coach_profiles cp
      JOIN public.athletes a ON a.id = cp.athlete_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_protocol_templates_coach_id ON public.protocol_templates(coach_id);
CREATE INDEX IF NOT EXISTS idx_protocol_templates_shared ON public.protocol_templates(id) WHERE is_shared = true;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assigned_protocols_updated_at
  BEFORE UPDATE ON public.assigned_protocols
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_coach_profiles_updated_at
  BEFORE UPDATE ON public.coach_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
    (SELECT COUNT(*)::integer FROM public.coach_athlete_relationships car WHERE car.coach_id = coach_uuid AND car.status = 'active') AS total_athletes,
    (SELECT COUNT(*)::integer FROM public.assigned_protocols ap WHERE ap.coach_id = coach_uuid AND ap.status IN ('assigned', 'in_progress')) AS active_protocols,
    (SELECT COUNT(DISTINCT car.athlete_id)::integer FROM public.coach_athlete_relationships car WHERE car.coach_id = coach_uuid AND car.status = 'active' AND NOT EXISTS (SELECT 1 FROM public.interventions i WHERE i.athlete_id = car.athlete_id AND i.inserted_at >= (now() - INTERVAL '7 days'))) AS athletes_needing_attention,
    (SELECT COUNT(*)::integer FROM public.races r JOIN public.coach_athlete_relationships car ON car.athlete_id = r.athlete_id WHERE car.coach_id = coach_uuid AND car.status = 'active' AND r.event_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')) AS upcoming_races;
$$;

REVOKE EXECUTE ON FUNCTION public.get_coach_dashboard_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coach_dashboard_summary(uuid) TO authenticated;;
