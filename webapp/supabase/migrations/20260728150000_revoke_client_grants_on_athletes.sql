-- ================================================================
-- Remove the client-key grants on athletes
--
-- The athletes table still carried full SELECT/INSERT/UPDATE/DELETE
-- grants for anon and authenticated. The RLS policies on the table
-- already denied those writes, so nothing was exposed — but the grants
-- were a second lock left unlocked: any future policy loosened for a
-- legitimate read would have opened writes along with it.
--
-- Client code only ever calls supabase.auth.* — it never queries a
-- table with the anon key. Every athlete read and write goes through
-- the API routes on the service-role client, which bypasses RLS and
-- authorises from the signed session cookie. So no client key needs
-- table access here.
--
-- Applied to production 2026-07-28.
-- ================================================================

REVOKE ALL ON TABLE public.athletes FROM anon, authenticated;

COMMENT ON TABLE public.athletes IS
  'Service-role access only. Reached through the API routes, which authorise from the signed session cookie.';
