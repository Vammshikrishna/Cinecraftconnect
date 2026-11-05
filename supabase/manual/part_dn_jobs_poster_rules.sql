-- PART DN: who may post a job (finding F-02, docs/testing/03-collaboration-business.md). Safe to re-run.
--
-- The apps hide "Post a job" from Fan accounts and from staff (moderator / admin / super admin); the old INSERT policy only
-- checked posted_by = you. This makes the database say the same thing the UI does:
--   * a Fan account cannot insert a job
--   * a staff / internal account cannot insert a job
--   * Creator and Studio accounts (and accounts with no account_type, which the apps treat as Creator) are unchanged
-- It is NOT Studio-only, because the UI lets Creators post too.
--
-- PREFLIGHT (read-only, run first, changes nothing). Existing jobs this rule would not have allowed (they stay; only new inserts are checked):
--   SELECT count(*) AS jobs_by_fans
--     FROM public.jobs j JOIN public.profiles p ON p.id = j.posted_by WHERE p.account_type = 'fan';
--   SELECT count(*) AS jobs_by_staff
--     FROM public.jobs j JOIN public.profiles p ON p.id = j.posted_by WHERE COALESCE(p.is_internal, false);
-- Check the current policy still has the expected name before replacing it:
--   SELECT policyname, cmd, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jobs' AND cmd = 'INSERT';
-- If the preflight shows an extra INSERT policy (other than "Users can create jobs"), it will still OR with this one: drop it by hand.
--
-- Rollback: re-run the CREATE POLICY from part_p_jobs_hiring.sql (line "Users can create jobs").

BEGIN;

DROP POLICY IF EXISTS "Users can create jobs" ON public.jobs;
CREATE POLICY "Users can create jobs" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = posted_by
    AND (page_id IS NULL OR public.is_page_manager(page_id, auth.uid()))
    AND COALESCE((SELECT p.account_type FROM public.profiles p WHERE p.id = auth.uid()), '') <> 'fan'
    AND NOT public.is_current_user_internal()
  );

COMMIT;
