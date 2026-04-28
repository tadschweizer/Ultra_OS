ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS assigned_protocol_id uuid REFERENCES public.assigned_protocols(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interventions_assigned_protocol_id
  ON public.interventions(assigned_protocol_id);

CREATE OR REPLACE FUNCTION public.calculate_protocol_compliance(protocol_uuid uuid)
RETURNS TABLE (
  protocol_id uuid,
  expected_entries integer,
  actual_entries integer,
  compliance_percent integer,
  weeks_elapsed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  protocol_record public.assigned_protocols%ROWTYPE;
  effective_end date;
BEGIN
  SELECT *
  INTO protocol_record
  FROM public.assigned_protocols
  WHERE id = protocol_uuid;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  protocol_id := protocol_record.id;

  IF current_date < protocol_record.start_date THEN
    weeks_elapsed := 0;
  ELSE
    effective_end := LEAST(current_date, protocol_record.end_date);
    weeks_elapsed := GREATEST(1, CEIL(((effective_end - protocol_record.start_date) + 1)::numeric / 7.0)::integer);
  END IF;

  IF weeks_elapsed = 0 THEN
    expected_entries := 0;
  ELSIF jsonb_typeof(protocol_record.instructions -> 'weekly_blocks') = 'array' THEN
    SELECT COALESCE(
      SUM(
        CASE
          WHEN NULLIF(block ->> 'frequency_per_week', '') IS NULL THEN 0
          ELSE (block ->> 'frequency_per_week')::integer
        END
      ),
      0
    )
    INTO expected_entries
    FROM jsonb_array_elements(protocol_record.instructions -> 'weekly_blocks') AS block
    WHERE COALESCE(NULLIF(block ->> 'week_number', '')::integer, 0) <= weeks_elapsed;

    IF expected_entries = 0 THEN
      expected_entries := weeks_elapsed;
    END IF;
  ELSE
    expected_entries := weeks_elapsed;
  END IF;

  SELECT COUNT(*)::integer
  INTO actual_entries
  FROM public.interventions intervention_entry
  WHERE intervention_entry.athlete_id = protocol_record.athlete_id
    AND (
      intervention_entry.assigned_protocol_id = protocol_record.id
      OR (
        intervention_entry.assigned_protocol_id IS NULL
        AND intervention_entry.intervention_type = protocol_record.protocol_type
        AND intervention_entry.date BETWEEN protocol_record.start_date AND protocol_record.end_date
      )
    );

  compliance_percent := CASE
    WHEN expected_entries <= 0 THEN 0
    ELSE LEAST(100, ROUND((actual_entries::numeric / expected_entries::numeric) * 100))::integer
  END;

  RETURN QUERY
  SELECT protocol_id, expected_entries, actual_entries, compliance_percent, weeks_elapsed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_protocol_compliance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_protocol_compliance(uuid) TO authenticated;
