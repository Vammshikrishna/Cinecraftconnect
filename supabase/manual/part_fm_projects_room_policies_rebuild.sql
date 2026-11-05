-- PART FM (rooms) - joining a PUBLIC discussion room still fails after part FH: POST /rest/v1/room_members returns 500 42P17 "infinite recursion detected in policy for relation room_members". Safe to run more than once.
--
-- WHAT THE TESTS SHOWED (as a signed-in second account, calling the API directly): reading room_members and discussion_rooms works, and the helper functions is_room_member / cj_room_is_public answer fine,
-- but an INSERT into room_members still recurses. So some policy that is LIVE in your project (not in the repo SQL, or an older copy that part FH did not replace) reads room_members or discussion_rooms
-- with a plain subquery; each of those two tables' policies then reads the other, and Postgres gives up.
-- THE FIX (does not depend on what is live): (1) new helper functions that read the tables with row security OFF, so they can never recurse; (2) drop every policy on room_members and discussion_rooms
-- that contains a direct subquery on either table (the notice list shows which ones); (3) re-create the needed policies using only the helpers, for any command that has no policy left. Policies that do not
-- read those two tables (staff-with-grant, creator-owns-room, public rooms ...) are kept.
--
-- PREFLIGHT (read only): select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename in ('room_members', 'discussion_rooms') order by 1, 3, 2;
-- POST-CHECK (read only): the same query: no qual / with_check may contain "FROM room_members" or "FROM discussion_rooms" any more; then join a public room with a second account: it works.
-- ROLLBACK: not needed (the new policies are named cm_*; drop them and re-run part FH to go back).

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.cm_room_is_public(p_room uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT EXISTS (SELECT 1 FROM public.discussion_rooms dr WHERE dr.id = p_room AND (dr.room_type = 'public' OR dr.is_public = true));
$$;
CREATE OR REPLACE FUNCTION public.cm_room_is_creator(p_room uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT EXISTS (SELECT 1 FROM public.discussion_rooms dr WHERE dr.id = p_room AND dr.creator_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.cm_room_is_member(p_room uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = p_room AND rm.user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.cm_room_is_admin(p_room uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = p_room AND rm.user_id = auth.uid() AND lower(COALESCE(rm.role, '')) IN ('admin', 'owner', 'moderator'));
$$;
REVOKE ALL ON FUNCTION public.cm_room_is_public(uuid), public.cm_room_is_creator(uuid), public.cm_room_is_member(uuid), public.cm_room_is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cm_room_is_public(uuid), public.cm_room_is_creator(uuid), public.cm_room_is_member(uuid), public.cm_room_is_admin(uuid) TO anon, authenticated, service_role;

-- (2) drop policies that read room_members / discussion_rooms directly
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('room_members', 'discussion_rooms')
      AND policyname NOT LIKE 'cm\_%'
      AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~* '(from|join)\s+("?public"?\.)?"?(room_members|discussion_rooms)"?'
  LOOP
    RAISE NOTICE 'dropping policy % on %', r.policyname, r.tablename;
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- (3) re-create what is needed, using only the helpers
DROP POLICY IF EXISTS cm_room_members_select ON public.room_members;
CREATE POLICY cm_room_members_select ON public.room_members FOR SELECT
  USING (user_id = auth.uid() OR public.cm_room_is_member(room_id) OR public.cm_room_is_creator(room_id) OR public.cm_room_is_public(room_id));

DROP POLICY IF EXISTS cm_room_members_join ON public.room_members;
CREATE POLICY cm_room_members_join ON public.room_members FOR INSERT
  WITH CHECK (auth.uid() = user_id AND (role IS NULL OR lower(role) = 'member') AND public.cm_room_is_public(room_id));

DROP POLICY IF EXISTS cm_room_members_creator_add ON public.room_members;
CREATE POLICY cm_room_members_creator_add ON public.room_members FOR INSERT
  WITH CHECK (public.cm_room_is_creator(room_id));

DROP POLICY IF EXISTS cm_room_members_member_invite ON public.room_members;
CREATE POLICY cm_room_members_member_invite ON public.room_members FOR INSERT
  WITH CHECK (public.cm_room_is_member(room_id) AND (role IS NULL OR lower(role) = 'member'));

DROP POLICY IF EXISTS cm_room_members_update ON public.room_members;
CREATE POLICY cm_room_members_update ON public.room_members FOR UPDATE
  USING (public.cm_room_is_creator(room_id) OR public.cm_room_is_admin(room_id))
  WITH CHECK (public.cm_room_is_creator(room_id) OR public.cm_room_is_admin(room_id));

DROP POLICY IF EXISTS cm_room_members_delete ON public.room_members;
CREATE POLICY cm_room_members_delete ON public.room_members FOR DELETE
  USING (user_id = auth.uid() OR public.cm_room_is_creator(room_id) OR public.cm_room_is_admin(room_id));

DROP POLICY IF EXISTS cm_discussion_rooms_member_select ON public.discussion_rooms;
CREATE POLICY cm_discussion_rooms_member_select ON public.discussion_rooms FOR SELECT
  USING (creator_id = auth.uid() OR public.cm_room_is_member(id));

-- Public rooms must stay visible to everybody who is signed in (the room list and the join button need it). The earlier public-room policy may have been
-- one of those dropped above, so make sure one exists.
DROP POLICY IF EXISTS cm_discussion_rooms_public_select ON public.discussion_rooms;
CREATE POLICY cm_discussion_rooms_public_select ON public.discussion_rooms FOR SELECT
  USING (room_type = 'public' OR is_public = true);
