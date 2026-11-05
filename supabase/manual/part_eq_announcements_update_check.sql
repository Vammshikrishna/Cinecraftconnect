-- PART EQ - make the announcements UPDATE policy check the NEW row too. Safe to run more than once. Run any time.
--
-- WHAT THE LINTER FOUND ("RLS Policy Always True"): the policy "Manage own or page announcements" (UPDATE) has USING (...) but WITH CHECK (true).
-- USING decides which rows you may edit; WITH CHECK decides what the row may look like afterwards. With "true" the second part checks nothing.
-- NOT EXPLOITABLE TODAY: the trigger announcements_guard() already resets author_id and publisher_page_id to their old values on every update,
-- so an edit can never move an announcement to another author or page. This part removes the dependency on that trigger (defence in depth).
-- THE FIX: WITH CHECK uses the same rule as USING. Because the trigger keeps author and page unchanged, every normal edit still passes.
--
-- PREFLIGHT (read only):  select policyname, cmd, with_check from pg_policies where schemaname = 'public' and tablename = 'announcements' and cmd = 'UPDATE';
--                         -- with_check shows: true
-- POST-CHECK (read only): the same query; with_check now shows the full rule (not "true").

DROP POLICY IF EXISTS "Manage own or page announcements" ON public.announcements;
CREATE POLICY "Manage own or page announcements" ON public.announcements
  FOR UPDATE TO authenticated
  USING (
    (publisher_page_id IS NULL AND author_id = auth.uid())
    OR (publisher_page_id IS NOT NULL AND public.is_page_manager(publisher_page_id, auth.uid()))
    OR public.is_current_user_internal()
  )
  WITH CHECK (
    (publisher_page_id IS NULL AND author_id = auth.uid())
    OR (publisher_page_id IS NOT NULL AND public.is_page_manager(publisher_page_id, auth.uid()))
    OR public.is_current_user_internal()
  );
