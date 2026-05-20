-- Fix recursive RLS: is_current_athlete queries the athletes table, but the
-- athletes SELECT policy calls is_current_athlete — causing infinite recursion
-- and "stack depth limit exceeded" (PostgreSQL error 54001) on select=*.
-- Adding SECURITY DEFINER makes the function run as its owner, bypassing RLS
-- on the inner athletes query and breaking the cycle.
CREATE OR REPLACE FUNCTION public.is_current_athlete(target_athlete_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.athletes
    WHERE athletes.id = target_athlete_id
      AND athletes.supabase_user_id = auth.uid()
  );
$function$;
