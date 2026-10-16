BEGIN;
-- Application handlers already check coach/athlete access before using the
-- service role. These legacy summary functions must not be direct client APIs.
DO $$
DECLARE target regprocedure;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    to_regprocedure('public.get_coach_dashboard_summary(uuid)'),
    to_regprocedure('public.calculate_protocol_compliance(uuid)')
  ] LOOP
    IF target IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', target);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', target);
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', target);
    END IF;
  END LOOP;
END $$;

CREATE TABLE public.auth_rate_buckets (
  bucket_key text PRIMARY KEY,
  started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0)
);
ALTER TABLE public.auth_rate_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_rate_buckets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_rate_buckets TO service_role;

-- Atomic reservation counts requests before password/provider work. The
-- identifier is hashed by the server; expired rows are bounded by TTL cleanup.
CREATE FUNCTION public.consume_auth_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE current_count integer;
BEGIN
  IF length(p_key) <> 64 OR p_limit < 1 OR p_limit > 1000 OR p_window_seconds < 1 OR p_window_seconds > 3600 THEN
    RAISE EXCEPTION 'Invalid rate policy';
  END IF;
  DELETE FROM public.auth_rate_buckets WHERE started_at < now() - interval '2 hours';
  INSERT INTO public.auth_rate_buckets(bucket_key, started_at, attempts)
  VALUES (p_key, now(), 1)
  ON CONFLICT (bucket_key) DO UPDATE SET
    started_at = CASE WHEN auth_rate_buckets.started_at <= now() - make_interval(secs => p_window_seconds) THEN now() ELSE auth_rate_buckets.started_at END,
    attempts = CASE WHEN auth_rate_buckets.started_at <= now() - make_interval(secs => p_window_seconds) THEN 1 ELSE least(auth_rate_buckets.attempts + 1, p_limit + 1) END
  RETURNING attempts INTO current_count;
  RETURN current_count <= p_limit;
END $$;
REVOKE ALL ON FUNCTION public.consume_auth_rate_limit(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auth_rate_limit(text,integer,integer) TO service_role;
CREATE INDEX auth_rate_buckets_expiry ON public.auth_rate_buckets(started_at);
COMMIT;
