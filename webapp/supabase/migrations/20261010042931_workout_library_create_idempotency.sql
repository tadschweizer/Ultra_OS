-- A create receipt survives template edits/deletion and uncertain HTTP responses.
-- Only the signed server handler can call this service-role-only transaction.
CREATE TABLE IF NOT EXISTS public.workout_library_create_requests (
  coach_id uuid NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  workout_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coach_id, request_id)
);
ALTER TABLE public.workout_library_create_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_library_create_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.workout_library_create_requests TO service_role;

CREATE OR REPLACE FUNCTION public.create_workout_library_once(
  p_coach_id uuid, p_request_id uuid, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  receipt public.workout_library_create_requests%ROWTYPE;
  is_new boolean;
  intent_hash text;
BEGIN
  IF p_coach_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid library create request' USING ERRCODE = '22023';
  END IF;
  -- Canonical jsonb text gives key-order-independent intent. Keep only its
  -- built-in SHA-256 fingerprint, not a second copy of coach instructions.
  intent_hash := encode(sha256(convert_to(p_payload::text, 'UTF8')), 'hex');
  INSERT INTO public.workout_library_create_requests(coach_id, request_id, payload_hash, workout_id)
    VALUES (p_coach_id, p_request_id, intent_hash, gen_random_uuid())
    ON CONFLICT (coach_id, request_id) DO NOTHING
    RETURNING * INTO receipt;
  is_new := FOUND;
  IF NOT is_new THEN
    -- A concurrent insert waits on the same unique key; this next statement
    -- sees the committed receipt. Failed first transactions leave no receipt.
    SELECT * INTO STRICT receipt FROM public.workout_library_create_requests
      WHERE coach_id = p_coach_id AND request_id = p_request_id;
    IF receipt.payload_hash IS DISTINCT FROM intent_hash THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.workout_library WHERE id = receipt.workout_id AND coach_id = p_coach_id) THEN
      RETURN jsonb_build_object('status', 'deleted');
    END IF;
  ELSE
    INSERT INTO public.workout_library (
      id, coach_id, name, sport, description, structure, objective, coach_instructions,
      planned_if, target_metric, visibility, planned_duration_min, planned_distance_km,
      planned_distance_unit, planned_tss, tags
    ) VALUES (
      receipt.workout_id, p_coach_id, p_payload->>'name', COALESCE(p_payload->>'sport', 'run'),
      p_payload->>'description', COALESCE(p_payload->'structure', '[]'::jsonb),
      p_payload->>'objective', p_payload->>'coach_instructions', (p_payload->>'planned_if')::numeric,
      COALESCE(p_payload->>'target_metric', 'duration'), COALESCE(p_payload->>'visibility', 'athlete_visible'),
      (p_payload->>'planned_duration_min')::numeric, (p_payload->>'planned_distance_km')::numeric,
      COALESCE(p_payload->>'planned_distance_unit', 'mi'), (p_payload->>'planned_tss')::numeric,
      CASE WHEN p_payload->'tags' IS NULL OR p_payload->'tags' = 'null'::jsonb THEN NULL
        ELSE ARRAY(SELECT jsonb_array_elements_text(p_payload->'tags')) END
    );
  END IF;
  RETURN jsonb_build_object('status', 'saved', 'id', receipt.workout_id, 'replayed', NOT is_new);
END;
$$;
REVOKE ALL ON FUNCTION public.create_workout_library_once(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_workout_library_once(uuid, uuid, jsonb) TO service_role;
