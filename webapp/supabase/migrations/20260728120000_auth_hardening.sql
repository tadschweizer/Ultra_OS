-- ================================================================
-- Auth hardening
--
-- 1. athletes.session_version — lets a password change, a password
--    reset, or "sign out everywhere" invalidate every issued session
--    cookie at once. The session cookie signs this value, so bumping
--    the column makes every previously-issued cookie fail to verify.
--
-- 2. auth_attempts — durable record of authentication attempts, used
--    for rate limiting and lockout. The app runs on serverless
--    (Cloudflare Pages / Vercel), so an in-memory counter would reset
--    on every cold start and would not be shared between instances.
--    Doubles as the beginnings of a security audit trail.
--
-- Both tables are written only through the service-role key from API
-- routes. RLS is enabled with no policies so that the public anon key
-- and end-user sessions cannot read or write them at all — the same
-- deny-all-from-client pattern used by research_ingestion_runs.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Session revocation counter
-- ----------------------------------------------------------------
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.athletes.session_version IS
  'Bumped to revoke every outstanding session cookie for this athlete (password change/reset, sign out everywhere).';

-- ----------------------------------------------------------------
-- 1b. Mirror of the Supabase auth user's email_confirmed_at.
--
--     Kept on the athlete row so /api/me — which every page load hits —
--     can report verification state without a second call into the auth
--     schema. The auth user remains the source of truth; this is written
--     whenever a verified identity signs in.
-- ----------------------------------------------------------------
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

COMMENT ON COLUMN public.athletes.email_verified_at IS
  'Set when a Supabase identity with a confirmed email signs in. Gates the email-match identity merge.';

-- ----------------------------------------------------------------
-- 2. Authentication attempt log (rate limiting + lockout)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What is being limited: 'login', 'signup', 'password_reset',
  -- 'password_change', 'coach_code'.
  kind text NOT NULL,
  -- The bucket this attempt counts against: a lowercased email, an IP,
  -- or an athlete id. Stored as free text so one table serves them all.
  identifier text NOT NULL,
  -- Coarse client IP, kept for abuse investigation. Nullable because
  -- proxies do not always give us one.
  ip text,
  succeeded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The hot query is "how many failures for this identifier+kind since T".
CREATE INDEX IF NOT EXISTS auth_attempts_lookup_idx
  ON public.auth_attempts (kind, identifier, created_at DESC)
  WHERE succeeded = false;

-- Supports the retention sweep.
CREATE INDEX IF NOT EXISTS auth_attempts_created_at_idx
  ON public.auth_attempts (created_at);

ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: deny-all from anon/authenticated. The
-- service-role key used by the API routes bypasses RLS.

REVOKE ALL ON TABLE public.auth_attempts FROM anon, authenticated;

COMMENT ON TABLE public.auth_attempts IS
  'Authentication attempts, used for rate limiting and lockout. Service-role writes only. Rows older than 30 days can be pruned.';
