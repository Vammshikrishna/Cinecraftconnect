-- part_dz_mobile_group1_fixes.sql
-- PREFLIGHT (read-only, run first):
--   SELECT proname FROM pg_proc WHERE proname = 'blocked_user_ids_both_ways';
--   SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'blocked_users';
-- Safe to re-run. Applied by hand by the owner.
--
-- Why: the mobile "New Message" search must hide people I blocked AND people who blocked me.
-- RLS on blocked_users normally lets a user read only their own rows, so the app cannot see
-- who blocked it. This SECURITY DEFINER function returns only ids related to the caller.
-- The app works without it (it falls back to hiding only the people I blocked).

CREATE OR REPLACE FUNCTION public.blocked_user_ids_both_ways()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.blocked_user_id FROM public.blocked_users b WHERE b.user_id = auth.uid()
  UNION
  SELECT b.user_id FROM public.blocked_users b WHERE b.blocked_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.blocked_user_ids_both_ways() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blocked_user_ids_both_ways() TO authenticated;
