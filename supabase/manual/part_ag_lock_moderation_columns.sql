-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AG (lock) – moderation columns on profiles are no longer readable by members
--   restriction_flags, shadow_banned_at, is_shadowbanned, force_password_reset
-- RUN THIS LAST: only after part_ag_profile_security.sql has been run AND the new web + mobile builds are live
-- (the new builds no longer read these columns; they use get_my_account_state() for the person's own state).
-- SQL functions that set these columns are SECURITY DEFINER and keep working. trust_score stays readable (the staff
-- screens use it). If you add a column to profiles later, run:  GRANT SELECT (<column>) ON public.profiles TO anon, authenticated;
-- To undo: GRANT SELECT ON public.profiles TO anon, authenticated;
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

REVOKE SELECT ON public.profiles FROM anon, authenticated;

DO $$
DECLARE
  v_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'profiles'
     AND column_name NOT IN ('restriction_flags', 'shadow_banned_at', 'is_shadowbanned', 'force_password_reset');
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO anon, authenticated', v_cols);
END $$;

COMMIT;
