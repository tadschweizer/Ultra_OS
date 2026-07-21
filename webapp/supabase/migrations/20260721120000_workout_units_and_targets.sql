-- Workout editor: distance-unit preference + richer structure targets.
--
-- Athletes (US ultra base) mostly think in miles, but planned workouts were
-- stored/displayed in km with no way to switch. Add a per-athlete display
-- preference plus a per-workout unit so the editor round-trips the coach's
-- choice. Distance itself stays canonical in km (planned_distance_km) so
-- compliance math and synced-activity matching are unaffected.

ALTER TABLE public.athlete_settings
  ADD COLUMN IF NOT EXISTS distance_unit text NOT NULL DEFAULT 'mi'
    CHECK (distance_unit IN ('mi', 'km'));

ALTER TABLE public.planned_workouts
  ADD COLUMN IF NOT EXISTS planned_distance_unit text NOT NULL DEFAULT 'mi'
    CHECK (planned_distance_unit IN ('mi', 'km'));

ALTER TABLE public.workout_library
  ADD COLUMN IF NOT EXISTS planned_distance_unit text NOT NULL DEFAULT 'mi'
    CHECK (planned_distance_unit IN ('mi', 'km'));
