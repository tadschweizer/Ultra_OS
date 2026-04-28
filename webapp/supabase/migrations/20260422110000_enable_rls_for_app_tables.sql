CREATE OR REPLACE FUNCTION public.is_current_athlete(target_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.athletes
    WHERE athletes.id = target_athlete_id
      AND athletes.supabase_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_coach_profile(target_coach_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_profiles cp
    JOIN public.athletes a ON a.id = cp.athlete_id
    WHERE cp.id = target_coach_id
      AND a.supabase_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_coached_athlete(target_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_athlete_links cal
    JOIN public.coach_profiles cp ON cp.id = cal.coach_id
    JOIN public.athletes a ON a.id = cp.athlete_id
    WHERE cal.athlete_id = target_athlete_id
      AND cal.status = 'active'
      AND a.supabase_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.coach_athlete_relationships car
    JOIN public.coach_profiles cp ON cp.id = car.coach_id
    JOIN public.athletes a ON a.id = cp.athlete_id
    WHERE car.athlete_id = target_athlete_id
      AND car.status = 'active'
      AND a.supabase_user_id = auth.uid()
  );
$$;

ALTER TABLE IF EXISTS public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.athlete_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.athlete_supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.strava_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.races ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coach_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coach_athlete_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coach_protocol_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.race_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.race_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coach_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athletes: self read" ON public.athletes;
DROP POLICY IF EXISTS "athletes: self insert" ON public.athletes;
DROP POLICY IF EXISTS "athletes: self update" ON public.athletes;

CREATE POLICY "athletes: self read"
  ON public.athletes FOR SELECT
  USING (public.is_current_athlete(id));

CREATE POLICY "athletes: self insert"
  ON public.athletes FOR INSERT
  WITH CHECK (supabase_user_id = auth.uid());

CREATE POLICY "athletes: self update"
  ON public.athletes FOR UPDATE
  USING (public.is_current_athlete(id))
  WITH CHECK (public.is_current_athlete(id));

DROP POLICY IF EXISTS "interventions: athlete read own" ON public.interventions;
DROP POLICY IF EXISTS "interventions: athlete insert own" ON public.interventions;
DROP POLICY IF EXISTS "interventions: athlete update own" ON public.interventions;
DROP POLICY IF EXISTS "interventions: athlete delete own" ON public.interventions;
DROP POLICY IF EXISTS "interventions: coach read linked athletes" ON public.interventions;

CREATE POLICY "interventions: athlete read own"
  ON public.interventions FOR SELECT
  USING (
    public.is_current_athlete(athlete_id)
    OR public.is_current_coached_athlete(athlete_id)
  );

CREATE POLICY "interventions: athlete insert own"
  ON public.interventions FOR INSERT
  WITH CHECK (public.is_current_athlete(athlete_id));

CREATE POLICY "interventions: athlete update own"
  ON public.interventions FOR UPDATE
  USING (public.is_current_athlete(athlete_id))
  WITH CHECK (public.is_current_athlete(athlete_id));

CREATE POLICY "interventions: athlete delete own"
  ON public.interventions FOR DELETE
  USING (public.is_current_athlete(athlete_id));

DROP POLICY IF EXISTS "athlete_settings: athlete read own" ON public.athlete_settings;
DROP POLICY IF EXISTS "athlete_settings: athlete manage own" ON public.athlete_settings;
DROP POLICY IF EXISTS "athlete_settings: coach read linked athletes" ON public.athlete_settings;

CREATE POLICY "athlete_settings: athlete read own"
  ON public.athlete_settings FOR SELECT
  USING (
    public.is_current_athlete(athlete_id)
    OR public.is_current_coached_athlete(athlete_id)
  );

CREATE POLICY "athlete_settings: athlete manage own"
  ON public.athlete_settings FOR ALL
  USING (public.is_current_athlete(athlete_id))
  WITH CHECK (public.is_current_athlete(athlete_id));

DROP POLICY IF EXISTS "athlete_supplements: athlete read own" ON public.athlete_supplements;
DROP POLICY IF EXISTS "athlete_supplements: athlete manage own" ON public.athlete_supplements;
DROP POLICY IF EXISTS "athlete_supplements: coach read linked athletes" ON public.athlete_supplements;

CREATE POLICY "athlete_supplements: athlete read own"
  ON public.athlete_supplements FOR SELECT
  USING (
    public.is_current_athlete(athlete_id)
    OR public.is_current_coached_athlete(athlete_id)
  );

CREATE POLICY "athlete_supplements: athlete manage own"
  ON public.athlete_supplements FOR ALL
  USING (public.is_current_athlete(athlete_id))
  WITH CHECK (public.is_current_athlete(athlete_id));

DROP POLICY IF EXISTS "strava_activities: athlete read own" ON public.strava_activities;
DROP POLICY IF EXISTS "strava_activities: athlete manage own" ON public.strava_activities;
DROP POLICY IF EXISTS "strava_activities: coach read linked athletes" ON public.strava_activities;

CREATE POLICY "strava_activities: athlete read own"
  ON public.strava_activities FOR SELECT
  USING (
    public.is_current_athlete(athlete_id)
    OR public.is_current_coached_athlete(athlete_id)
  );

CREATE POLICY "strava_activities: athlete manage own"
  ON public.strava_activities FOR ALL
  USING (public.is_current_athlete(athlete_id))
  WITH CHECK (public.is_current_athlete(athlete_id));

DROP POLICY IF EXISTS "races: athlete read own" ON public.races;
DROP POLICY IF EXISTS "races: athlete manage own" ON public.races;
DROP POLICY IF EXISTS "races: coach read linked athletes" ON public.races;

CREATE POLICY "races: athlete read own"
  ON public.races FOR SELECT
  USING (
    public.is_current_athlete(athlete_id)
    OR public.is_current_coached_athlete(athlete_id)
  );

CREATE POLICY "races: athlete manage own"
  ON public.races FOR ALL
  USING (public.is_current_athlete(athlete_id))
  WITH CHECK (public.is_current_athlete(athlete_id));

DROP POLICY IF EXISTS "Athletes can read own race outcomes" ON public.race_outcomes;
DROP POLICY IF EXISTS "Athletes can insert own race outcomes" ON public.race_outcomes;
DROP POLICY IF EXISTS "Athletes can update own race outcomes" ON public.race_outcomes;
DROP POLICY IF EXISTS "race_outcomes: athlete read own" ON public.race_outcomes;
DROP POLICY IF EXISTS "race_outcomes: athlete insert own" ON public.race_outcomes;
DROP POLICY IF EXISTS "race_outcomes: athlete update own" ON public.race_outcomes;
DROP POLICY IF EXISTS "race_outcomes: athlete delete own" ON public.race_outcomes;
DROP POLICY IF EXISTS "race_outcomes: coach read linked athletes" ON public.race_outcomes;

CREATE POLICY "race_outcomes: athlete read own"
  ON public.race_outcomes FOR SELECT
  USING (
    public.is_current_athlete(athlete_id)
    OR public.is_current_coached_athlete(athlete_id)
  );

CREATE POLICY "race_outcomes: athlete insert own"
  ON public.race_outcomes FOR INSERT
  WITH CHECK (public.is_current_athlete(athlete_id));

CREATE POLICY "race_outcomes: athlete update own"
  ON public.race_outcomes FOR UPDATE
  USING (public.is_current_athlete(athlete_id))
  WITH CHECK (public.is_current_athlete(athlete_id));

CREATE POLICY "race_outcomes: athlete delete own"
  ON public.race_outcomes FOR DELETE
  USING (public.is_current_athlete(athlete_id));

DROP POLICY IF EXISTS "race_catalog: public read" ON public.race_catalog;

CREATE POLICY "race_catalog: public read"
  ON public.race_catalog FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "coach_profiles: coaches read own" ON public.coach_profiles;
DROP POLICY IF EXISTS "coach_profiles: coaches insert own" ON public.coach_profiles;
DROP POLICY IF EXISTS "coach_profiles: coaches update own" ON public.coach_profiles;
DROP POLICY IF EXISTS "coach_profiles: athletes read linked coaches" ON public.coach_profiles;

CREATE POLICY "coach_profiles: coaches read own"
  ON public.coach_profiles FOR SELECT
  USING (public.is_current_coach_profile(id));

CREATE POLICY "coach_profiles: coaches insert own"
  ON public.coach_profiles FOR INSERT
  WITH CHECK (public.is_current_athlete(athlete_id));

CREATE POLICY "coach_profiles: coaches update own"
  ON public.coach_profiles FOR UPDATE
  USING (public.is_current_coach_profile(id))
  WITH CHECK (public.is_current_coach_profile(id));

CREATE POLICY "coach_profiles: athletes read linked coaches"
  ON public.coach_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_links cal
      JOIN public.athletes a ON a.id = cal.athlete_id
      WHERE cal.coach_id = coach_profiles.id
        AND cal.status = 'active'
        AND a.supabase_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      JOIN public.athletes a ON a.id = car.athlete_id
      WHERE car.coach_id = coach_profiles.id
        AND car.status = 'active'
        AND a.supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "coach_athlete_links: coaches manage own" ON public.coach_athlete_links;
DROP POLICY IF EXISTS "coach_athlete_links: athletes read own" ON public.coach_athlete_links;

CREATE POLICY "coach_athlete_links: coaches manage own"
  ON public.coach_athlete_links FOR ALL
  USING (public.is_current_coach_profile(coach_id))
  WITH CHECK (public.is_current_coach_profile(coach_id));

CREATE POLICY "coach_athlete_links: athletes read own"
  ON public.coach_athlete_links FOR SELECT
  USING (public.is_current_athlete(athlete_id));

DROP POLICY IF EXISTS "coach_protocol_assignments: coaches manage own" ON public.coach_protocol_assignments;
DROP POLICY IF EXISTS "coach_protocol_assignments: athletes read own" ON public.coach_protocol_assignments;

CREATE POLICY "coach_protocol_assignments: coaches manage own"
  ON public.coach_protocol_assignments FOR ALL
  USING (public.is_current_coach_profile(coach_id))
  WITH CHECK (public.is_current_coach_profile(coach_id));

CREATE POLICY "coach_protocol_assignments: athletes read own"
  ON public.coach_protocol_assignments FOR SELECT
  USING (public.is_current_athlete(athlete_id));

DROP POLICY IF EXISTS "coach_invitations: coaches manage own" ON public.coach_invitations;

CREATE POLICY "coach_invitations: coaches manage own"
  ON public.coach_invitations FOR ALL
  USING (public.is_current_coach_profile(coach_id))
  WITH CHECK (public.is_current_coach_profile(coach_id));

DROP POLICY IF EXISTS "coach_athlete_relationships: coaches manage own" ON public.coach_athlete_relationships;
DROP POLICY IF EXISTS "coach_athlete_relationships: athletes read own" ON public.coach_athlete_relationships;

CREATE POLICY "coach_athlete_relationships: coaches manage own"
  ON public.coach_athlete_relationships FOR ALL
  USING (public.is_current_coach_profile(coach_id))
  WITH CHECK (public.is_current_coach_profile(coach_id));

CREATE POLICY "coach_athlete_relationships: athletes read own"
  ON public.coach_athlete_relationships FOR SELECT
  USING (public.is_current_athlete(athlete_id));

DROP POLICY IF EXISTS "assigned_protocols: coaches manage own" ON public.assigned_protocols;
DROP POLICY IF EXISTS "assigned_protocols: athletes read own" ON public.assigned_protocols;

CREATE POLICY "assigned_protocols: coaches manage own"
  ON public.assigned_protocols FOR ALL
  USING (public.is_current_coach_profile(coach_id))
  WITH CHECK (public.is_current_coach_profile(coach_id));

CREATE POLICY "assigned_protocols: athletes read own"
  ON public.assigned_protocols FOR SELECT
  USING (public.is_current_athlete(athlete_id));

DROP POLICY IF EXISTS "coach_notes: coaches manage own" ON public.coach_notes;
DROP POLICY IF EXISTS "coach_notes: athletes read own" ON public.coach_notes;

CREATE POLICY "coach_notes: coaches manage own"
  ON public.coach_notes FOR ALL
  USING (public.is_current_coach_profile(coach_id))
  WITH CHECK (public.is_current_coach_profile(coach_id));

CREATE POLICY "coach_notes: athletes read own"
  ON public.coach_notes FOR SELECT
  USING (public.is_current_athlete(athlete_id));

DROP POLICY IF EXISTS "protocol_templates: coaches manage own" ON public.protocol_templates;
DROP POLICY IF EXISTS "protocol_templates: coaches read shared" ON public.protocol_templates;

CREATE POLICY "protocol_templates: coaches manage own"
  ON public.protocol_templates FOR ALL
  USING (public.is_current_coach_profile(coach_id))
  WITH CHECK (public.is_current_coach_profile(coach_id));

CREATE POLICY "protocol_templates: coaches read shared"
  ON public.protocol_templates FOR SELECT
  USING (
    is_shared = true
    AND EXISTS (
      SELECT 1
      FROM public.coach_profiles cp
      JOIN public.athletes a ON a.id = cp.athlete_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "coach_groups: coaches manage own" ON public.coach_groups;

CREATE POLICY "coach_groups: coaches manage own"
  ON public.coach_groups FOR ALL
  USING (public.is_current_coach_profile(coach_id))
  WITH CHECK (public.is_current_coach_profile(coach_id));

DROP POLICY IF EXISTS "user_notifications: athlete reads own" ON public.user_notifications;
DROP POLICY IF EXISTS "user_notifications: athlete updates own" ON public.user_notifications;

CREATE POLICY "user_notifications: athlete reads own"
  ON public.user_notifications FOR SELECT
  USING (public.is_current_athlete(recipient_athlete_id));

CREATE POLICY "user_notifications: athlete updates own"
  ON public.user_notifications FOR UPDATE
  USING (public.is_current_athlete(recipient_athlete_id))
  WITH CHECK (public.is_current_athlete(recipient_athlete_id));

DROP POLICY IF EXISTS "Admins can read all invites" ON public.invites;
DROP POLICY IF EXISTS "invites: admins read all" ON public.invites;

CREATE POLICY "invites: admins read all"
  ON public.invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.athletes
      WHERE athletes.supabase_user_id = auth.uid()
        AND athletes.is_admin = true
    )
  );
