-- PART FH (rooms) - joining a public discussion room fails with "infinite recursion detected in policy for relation room_members" (HTTP 500).
-- Safe to run more than once. Found by the browser test: a second account opens a public room and the join (POST /rest/v1/room_members) returns 500.
--
-- WHAT WENT WRONG: the INSERT rules on room_members ("Users can join public rooms", "Room creator can add members") check the room with an inline
-- sub-select on discussion_rooms. That sub-select is itself row-level-security checked, and one of the discussion_rooms read rules
-- ("Members can view private discussion rooms") sub-selects room_members again, so Postgres sees room_members -> discussion_rooms -> room_members
-- and stops with 42P17. (Reading the roster was not affected because its rules call SECURITY DEFINER helpers, which skip row-level security.)
-- THE FIX: the three rules below ask the same questions through SECURITY DEFINER helper functions (the same pattern part CK already uses for the
-- roster), so no rule reads another protected table directly and the loop cannot form. Who is allowed to do what does not change.
--
-- PREFLIGHT (read only; paste the result back if the post-check still fails):
--   select polrelid::regclass as tbl, polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr, pg_get_expr(polwithcheck, polrelid) as check_expr
--   from pg_policy where polrelid in ('public.room_members'::regclass, 'public.discussion_rooms'::regclass) order by 1, 2;
-- POST-CHECK (read only): sign in as a second account, open a public room and press Join: no 500 and the person appears in the member list.

-- helper: is this room public? (already created by part CK; repeated here so this part runs on its own)
CREATE OR REPLACE FUNCTION public.cj_room_is_public(p_room uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.discussion_rooms dr
    WHERE dr.id = p_room AND (dr.room_type = 'public' OR dr.is_public = true)
  );
$function$;
REVOKE ALL ON FUNCTION public.cj_room_is_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cj_room_is_public(uuid) TO anon, authenticated, service_role;

-- 1. join a public room as yourself, with the plain member role
DROP POLICY IF EXISTS "Users can join public rooms" ON public.room_members;
CREATE POLICY "Users can join public rooms" ON public.room_members
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (role IS NULL OR lower(role) = 'member')
    AND public.cj_room_is_public(room_id)
  );

-- 2. the room creator can add members (the creator is added when the room is created, before the creator is a member)
DROP POLICY IF EXISTS "Room creator can add members" ON public.room_members;
CREATE POLICY "Room creator can add members" ON public.room_members
  FOR INSERT
  WITH CHECK (public.is_room_creator(room_id, auth.uid()));

-- 3. private rooms are readable by their members: ask through the definer helper instead of reading room_members directly
DROP POLICY IF EXISTS "Members can view private discussion rooms" ON public.discussion_rooms;
CREATE POLICY "Members can view private discussion rooms" ON public.discussion_rooms
  FOR SELECT
  USING (public.is_room_member(id));
