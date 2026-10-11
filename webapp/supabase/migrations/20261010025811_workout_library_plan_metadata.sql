-- Add the same planning metadata already stored on planned_workouts.
-- Apply under separate release authorization before deploying the library API.
-- Existing owner foreign key, RLS policies, indexes and grants remain unchanged.
BEGIN;

ALTER TABLE public.workout_library
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS coach_instructions text,
  ADD COLUMN IF NOT EXISTS planned_if numeric
    CHECK (planned_if >= 0 AND planned_if < 'Infinity'::numeric),
  ADD COLUMN IF NOT EXISTS target_metric text NOT NULL DEFAULT 'duration'
    CHECK (target_metric IN ('duration', 'distance', 'tss', 'pace', 'heart_rate', 'power', 'rpe')),
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'athlete_visible'
    CHECK (visibility IN ('athlete_visible', 'coach_private'));

COMMIT;
