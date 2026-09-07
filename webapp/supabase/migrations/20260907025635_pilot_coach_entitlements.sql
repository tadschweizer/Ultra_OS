-- Pilot authority is separate from role selection and Stripe subscription state.
CREATE TABLE public.coach_pilot_entitlements (
  coach_id uuid PRIMARY KEY REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  updated_by uuid REFERENCES public.athletes(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  CHECK (expires_at > starts_at)
);
ALTER TABLE public.coach_pilot_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_pilot_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_pilot_entitlements TO service_role;

-- Existing open-ended relationships remain open-ended; future dated expiry is
-- evaluated by the entitlement helper, never inferred from an invitation.
ALTER TABLE public.coach_athlete_relationships ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Separate abuse protection: an atomic, durable 30 submissions/minute bucket.
-- No subscription or pilot state changes this limit. One bounded row per athlete.
CREATE TABLE public.checkin_rate_buckets (
  athlete_id uuid PRIMARY KEY REFERENCES public.athletes(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0)
);
ALTER TABLE public.checkin_rate_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkin_rate_buckets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkin_rate_buckets TO service_role;

CREATE FUNCTION public.consume_checkin_rate_limit(target_athlete uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE current_attempts integer;
BEGIN
  INSERT INTO public.checkin_rate_buckets AS bucket (athlete_id, window_start, attempts)
  VALUES (target_athlete, date_trunc('minute', clock_timestamp()), 1)
  ON CONFLICT (athlete_id) DO UPDATE SET
    window_start = EXCLUDED.window_start,
    attempts = CASE WHEN bucket.window_start = EXCLUDED.window_start
      THEN LEAST(bucket.attempts + 1, 31) ELSE 1 END
  RETURNING attempts INTO current_attempts;
  RETURN current_attempts <= 30;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_checkin_rate_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_checkin_rate_limit(uuid) TO service_role;
