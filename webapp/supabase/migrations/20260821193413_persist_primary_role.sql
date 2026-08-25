-- Persist the account's default product experience without conflating it with
-- coach capability, paid subscription entitlement, or administrator access.
DO $migration$
DECLARE
  primary_role_added boolean;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'athletes'
      AND column_name = 'primary_role'
  ) INTO primary_role_added;

  ALTER TABLE public.athletes
    ADD COLUMN IF NOT EXISTS primary_role text NOT NULL DEFAULT 'athlete';

  -- Backfill only when this migration creates the column. A later rerun must
  -- not overwrite a coach who intentionally switched their primary mode.
  IF primary_role_added THEN
    UPDATE public.athletes AS athlete
    SET primary_role = 'coach'
    WHERE athlete.primary_role = 'athlete'
      AND EXISTS (
        SELECT 1
        FROM public.coach_profiles AS profile
        WHERE profile.athlete_id = athlete.id
      );
  END IF;
END
$migration$;

ALTER TABLE public.athletes
  DROP CONSTRAINT IF EXISTS athletes_primary_role_check;

ALTER TABLE public.athletes
  ADD CONSTRAINT athletes_primary_role_check
  CHECK (primary_role IN ('athlete', 'coach'));

COMMENT ON COLUMN public.athletes.primary_role IS
  'Default product experience only: athlete or coach. Authorization remains derived from coach_profiles, subscription entitlement, and is_admin separately.';
