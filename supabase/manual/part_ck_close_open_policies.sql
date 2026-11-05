-- PART CK - close open policies (audit step 1b)
-- Run in the Supabase SQL editor AFTER part_cj. Based on the LIVE policies read in audit step 0.
-- These changes need no app change. Anything the apps still depend on (project membership auto-join, calls,
-- notifications, group keys) is left for the next step so nothing breaks.
--
-- Fixes:
--   project_space_messages  - the always-true read policy and the "anyone can post" policy (v2) are removed
--   discussion_rooms        - private rooms are no longer readable by everyone; the broken staff-grant policy is repaired
--   room_members            - the roster is visible to members and for public rooms only; nobody can give themselves the admin role
--   space_access_grants     - an admin can no longer insert an access grant directly (only approve_space_access creates them)
--   job_applications        - the old unrestricted INSERT policy is removed so the new application rules apply
--   jobs                    - a job can no longer be moved onto a company page the poster does not manage
--   company_page_members    - only the page owner can remove an admin from the team
--   content_reports         - a reporter can no longer choose the automatic actions or the fast-lane flag

-- ---------------------------------------------------------------------------
-- Helpers (used inside policies, so API roles need EXECUTE; they return only a yes/no about a room)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 1. project_space_messages: remove the always-true read and uid-only write policies (v2).
--    Members and project creators keep working through the other policies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "space_members_view_messages_v2" ON public.project_space_messages;
DROP POLICY IF EXISTS "space_members_send_messages_v2" ON public.project_space_messages;

-- ---------------------------------------------------------------------------
-- 2. discussion_rooms: private rooms are visible to their members and creator only.
--    Public rooms stay visible to everyone through "Everyone can view public discussion rooms".
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view discussion rooms" ON public.discussion_rooms;

DROP POLICY IF EXISTS "Staff can view discussion rooms with active grant" ON public.discussion_rooms;
CREATE POLICY "Staff can view discussion rooms with active grant" ON public.discussion_rooms
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.space_access_grants g
    WHERE g.user_id = auth.uid()
      AND g.target_type = 'room'
      AND g.target_id = discussion_rooms.id::text
      AND g.expires_at > now()
  ));

-- ---------------------------------------------------------------------------
-- 3. room_members: roster only for members, the creator, yourself, or public rooms.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view room members" ON public.room_members;
CREATE POLICY "Room roster visible to members and for public rooms" ON public.room_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_room_member(room_id)
    OR public.is_room_creator(room_id, auth.uid())
    OR public.cj_room_is_public(room_id)
  );

-- Nobody can add themselves (or someone else) with a role other than "member" unless they already run the room.
DROP POLICY IF EXISTS "Room members can invite members" ON public.room_members;
CREATE POLICY "Room members can invite members" ON public.room_members
  FOR INSERT
  WITH CHECK (
    public.is_room_member(room_id)
    AND (
      role IS NULL
      OR lower(role) = 'member'
      OR public.is_room_creator(room_id, auth.uid())
      OR public.is_room_admin(room_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can join public rooms" ON public.room_members;
CREATE POLICY "Users can join public rooms" ON public.room_members
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (role IS NULL OR lower(role) = 'member')
    AND EXISTS (
      SELECT 1 FROM public.discussion_rooms dr
      WHERE dr.id = room_members.room_id
        AND (dr.room_type = 'public' OR dr.is_public = true)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. space_access_grants: grants are created only by approve_space_access (a definer function).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can insert space access grants" ON public.space_access_grants;
REVOKE INSERT, UPDATE ON public.space_access_grants FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. job_applications: remove the old unrestricted INSERT policy; "Applicants can apply to open jobs" stays.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create applications" ON public.job_applications;

-- ---------------------------------------------------------------------------
-- 6. jobs: moving a job onto a company page needs the same right as creating one there.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cj_guard_job_page()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.market_is_system() OR public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;
  IF NEW.page_id IS NOT NULL
     AND NEW.page_id IS DISTINCT FROM OLD.page_id
     AND NOT public.is_page_manager(NEW.page_id, auth.uid()) THEN
    RAISE EXCEPTION 'You can only post a job on a company page you manage' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cj_guard_job_page ON public.jobs;
CREATE TRIGGER trg_cj_guard_job_page
  BEFORE UPDATE OF page_id ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.cj_guard_job_page();

-- ---------------------------------------------------------------------------
-- 7. company_page_members: a content admin cannot remove a super admin / analyst from the team.
--    The removed person (leaving) and the page owner can always do it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cj_guard_member_removal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.market_is_system() OR public.is_current_user_internal() OR OLD.user_id = auth.uid() THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_page_admins a WHERE a.page_id = OLD.page_id AND a.user_id = OLD.user_id)
     AND NOT EXISTS (SELECT 1 FROM public.company_pages p WHERE p.id = OLD.page_id AND p.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the page owner can remove an admin from the team' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cj_guard_member_removal ON public.company_page_members;
CREATE TRIGGER trg_cj_guard_member_removal
  BEFORE DELETE ON public.company_page_members
  FOR EACH ROW EXECUTE FUNCTION public.cj_guard_member_removal();

-- ---------------------------------------------------------------------------
-- 8. content_reports: the reporter cannot choose the automatic actions or the fast-lane flag.
--    The name starts with "a_" so it runs before trg_report_prepare, which then sets them from the real rules.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cj_reset_report_flags()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.market_is_system() THEN
    RETURN NEW;
  END IF;
  NEW.auto_actions := ARRAY[]::text[];
  NEW.fast_lane := false;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS a_cj_reset_report_flags ON public.content_reports;
CREATE TRIGGER a_cj_reset_report_flags
  BEFORE INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.cj_reset_report_flags();
