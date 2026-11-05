-- PART FB - close five pre-existing read/write holes found in the policies (not linter warnings; real access problems). Safe to run more than once.
--
-- WHAT WAS WRONG (from audit_step_fb_preflight, after the FA merge):
--   1. project_messages       SELECT had "auth.uid() IS NOT NULL" -> every signed-in user could read every project message; INSERT allowed
--                              "uid = user_id" alone -> anyone could post into any project. (0 rows, no app code uses the table.)
--   2. vip_invites            SELECT "is_used = false" -> anyone could list unused invite codes; UPDATE let anyone burn an unused code.
--                              No app or function redeems a code (only the staff VIPInviteManager touches the table), so it becomes staff-only.
--   3. project_space_members  SELECT ended in "OR true" -> everyone, even logged out, could read every member list.
--   4. room_message_read_status / project_message_read_status   SELECT ended in "OR true" -> everyone could read all read receipts.
--   5. project_spaces         the staff-grant branch compared space_access_grants.target_id with space_access_grants.id (itself), so ANY active grant
--                              opened EVERY space. It now compares with project_spaces.id.
--
-- WHO CAN READ AFTER THIS (signed in only; anon loses SELECT on these tables):
--   project_messages:      project members and creator.
--   vip_invites:           internal staff (admin / moderator / super_admin) only, all actions.
--   project_space_members: yourself, members of the space, its creator / managers, holders of an active staff access grant for that space,
--                          and anyone for a PUBLIC space (same as the space itself is visible). Private / secret spaces: members only.
--   read-status tables:    your own row, members of the same room / project, holders of an active staff grant for it.
--   The existing RESTRICTIVE staff policies ("only with a grant", "observers leave no receipts") stay and still apply on top.
-- INSERT / UPDATE / DELETE policies of the read-status tables and project_space_members are not changed.
--
-- PREFLIGHT (read only): audit_step_fb_preflight.sql.
-- POST-CHECK (read only, expect 0 rows each):
--   select tablename, policyname from pg_policies where schemaname='public' and tablename in ('project_messages','vip_invites','project_space_members','room_message_read_status','project_message_read_status')
--     and cmd = 'SELECT' and (qual ~* '\mOR true\M' or qual ~* 'IS NOT NULL\) OR');
--   select policyname from pg_policies where tablename='project_spaces' and qual like '%(space_access_grants.id)::text%';
-- ROLLBACK (per table): drop the "fb ..." policies of that table and re-create the old one from the preflight grid you saved
--   (the old ones were all named "merged select anon+authenticated" etc.). For anon: grant select on public.<table> to anon;

-- 1. project_messages ------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "merged select anon+authenticated" ON public.project_messages;
DROP POLICY IF EXISTS "merged insert anon+authenticated" ON public.project_messages;
DROP POLICY IF EXISTS "fb select members" ON public.project_messages;
DROP POLICY IF EXISTS "fb insert members" ON public.project_messages;

CREATE POLICY "fb select members" ON public.project_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_member_of_project(project_id) OR is_project_creator(project_id));
CREATE POLICY "fb insert members" ON public.project_messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND (is_member_of_project(project_id) OR is_project_creator(project_id)));

-- 2. vip_invites: staff only -----------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "merged select anon+authenticated" ON public.vip_invites;
DROP POLICY IF EXISTS "merged insert anon+authenticated" ON public.vip_invites;
DROP POLICY IF EXISTS "merged update anon+authenticated" ON public.vip_invites;
DROP POLICY IF EXISTS "merged delete anon+authenticated" ON public.vip_invites;
DROP POLICY IF EXISTS "fb staff all" ON public.vip_invites;

CREATE POLICY "fb staff all" ON public.vip_invites AS PERMISSIVE FOR ALL TO authenticated
  USING (is_current_user_internal()) WITH CHECK (is_current_user_internal());

-- 3. project_space_members: read scoped ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "merged select anon+authenticated" ON public.project_space_members;
DROP POLICY IF EXISTS "fb select scoped" ON public.project_space_members;

CREATE POLICY "fb select scoped" ON public.project_space_members AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR is_member_of_project(project_space_id)
    OR is_project_creator(project_space_id)
    OR cl_i_manage_space(project_space_id)
    OR EXISTS (SELECT 1 FROM public.space_access_grants g
               WHERE g.user_id = (select auth.uid()) AND g.target_type = 'project_space'
                 AND g.target_id = (project_space_members.project_space_id)::text AND g.expires_at > now())
    OR EXISTS (SELECT 1 FROM public.project_spaces ps
               WHERE ps.id = project_space_members.project_space_id AND ps.project_space_type = 'public')
  );

-- 4. read-status tables: read scoped ---------------------------------------------------------------------------------
DROP POLICY IF EXISTS "merged select anon+authenticated" ON public.room_message_read_status;
DROP POLICY IF EXISTS "fb select scoped" ON public.room_message_read_status;
CREATE POLICY "fb select scoped" ON public.room_message_read_status AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR is_room_member(room_id)
    OR EXISTS (SELECT 1 FROM public.space_access_grants g
               WHERE g.user_id = (select auth.uid()) AND g.target_type = 'room'
                 AND g.target_id = (room_message_read_status.room_id)::text AND g.expires_at > now())
  );

DROP POLICY IF EXISTS "merged select anon+authenticated" ON public.project_message_read_status;
DROP POLICY IF EXISTS "fb select scoped" ON public.project_message_read_status;
CREATE POLICY "fb select scoped" ON public.project_message_read_status AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR is_member_of_project(project_space_id)
    OR is_project_creator(project_space_id)
    OR EXISTS (SELECT 1 FROM public.space_access_grants g
               WHERE g.user_id = (select auth.uid()) AND g.target_type = 'project_space'
                 AND g.target_id = (project_message_read_status.project_space_id)::text AND g.expires_at > now())
  );

-- anon never needs these tables
REVOKE SELECT ON public.project_space_members, public.room_message_read_status, public.project_message_read_status FROM anon;

-- 5. project_spaces: the staff-grant branch compared the grant row with itself --------------------------------------
DO $$
DECLARE r record; fixed text;
BEGIN
  FOR r IN SELECT policyname, qual FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'project_spaces' AND cmd = 'SELECT'
             AND qual LIKE '%(space_access_grants.id)::text%'
  LOOP
    fixed := replace(r.qual, '(space_access_grants.id)::text', '(project_spaces.id)::text');
    EXECUTE format('ALTER POLICY %I ON public.project_spaces USING (%s)', r.policyname, fixed);
    RAISE NOTICE 'fixed grant branch in policy % on project_spaces', r.policyname;
  END LOOP;
END $$;
