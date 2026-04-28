ALTER TABLE IF EXISTS public.race_outcomes
  ADD COLUMN IF NOT EXISTS linked_activity_id text,
  ADD COLUMN IF NOT EXISTS linked_activity_provider text CHECK (linked_activity_provider IN ('strava', 'garmin', 'trainingpeaks')),
  ADD COLUMN IF NOT EXISTS linked_activity_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_limiter text;

CREATE INDEX IF NOT EXISTS race_outcomes_athlete_linked_activity_idx
  ON public.race_outcomes (athlete_id, linked_activity_provider, linked_activity_id);

ALTER TABLE IF EXISTS public.race_outcomes
  DROP CONSTRAINT IF EXISTS race_outcomes_gi_distress_score_check;

ALTER TABLE IF EXISTS public.race_outcomes
  ADD CONSTRAINT race_outcomes_gi_distress_score_check
  CHECK (gi_distress_score IS NULL OR gi_distress_score BETWEEN 0 AND 4);
