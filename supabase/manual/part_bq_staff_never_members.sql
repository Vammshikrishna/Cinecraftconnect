-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- part_bq: a staff account can never be a member of a room or a project space
--
-- Staff (moderator, admin, super admin) only ever VISIT a room or a project space, through audited access
-- (part_bp). They are not members, so the database now refuses to make them one, whichever way it is tried:
--
--   1. is_staff_user()               one place that answers "is this account staff?"
--   2. Membership is refused         adding a staff account to room_members or project_space_members fails with a clear
--                                    message (this also covers a staff account creating a room or a project space, because
--                                    the creator is added as the first member)
--   3. Join requests are refused     a staff account cannot ask to join (room_join_requests, project_space_join_requests)
--   4. Promotion cleans up           when someone is given a staff role, the memberships and join requests they already
--                                    had are removed (and written to the audit ledger), so the rule also holds for people
--                                    who became staff later
--   5. One-time cleanup              removes the staff memberships that exist today (also audited)
--
-- Run part_bp first. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ── 1. who is staff ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_staff_user(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user
      AND ur.role IN ('moderator'::public.app_role, 'admin'::public.app_role, 'super_admin'::public.app_role)
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_user(uuid) TO authenticated;


-- ── 2 + 3. refuse memberships and join requests ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refuse_staff_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_staff_user(NEW.user_id) THEN
    RAISE EXCEPTION 'Staff accounts cannot be members of rooms or project spaces. Use audited access to look inside one.'
      USING ERRCODE = 'check_violation',
            HINT = 'Staff only visit a space through audited access.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refuse_staff_membership ON public.room_members;
CREATE TRIGGER refuse_staff_membership
BEFORE INSERT OR UPDATE OF user_id ON public.room_members
FOR EACH ROW EXECUTE FUNCTION public.refuse_staff_membership();

DROP TRIGGER IF EXISTS refuse_staff_membership ON public.project_space_members;
CREATE TRIGGER refuse_staff_membership
BEFORE INSERT OR UPDATE OF user_id ON public.project_space_members
FOR EACH ROW EXECUTE FUNCTION public.refuse_staff_membership();

DROP TRIGGER IF EXISTS refuse_staff_join_request ON public.room_join_requests;
CREATE TRIGGER refuse_staff_join_request
BEFORE INSERT ON public.room_join_requests
FOR EACH ROW EXECUTE FUNCTION public.refuse_staff_membership();

DROP TRIGGER IF EXISTS refuse_staff_join_request ON public.project_space_join_requests;
CREATE TRIGGER refuse_staff_join_request
BEFORE INSERT ON public.project_space_join_requests
FOR EACH ROW EXECUTE FUNCTION public.refuse_staff_membership();


-- ── 4. becoming staff removes existing memberships ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_staff_memberships(p_user uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rooms integer;
  v_spaces integer;
BEGIN
  DELETE FROM public.room_members WHERE user_id = p_user;
  GET DIAGNOSTICS v_rooms = ROW_COUNT;
  DELETE FROM public.project_space_members WHERE user_id = p_user;
  GET DIAGNOSTICS v_spaces = ROW_COUNT;
  DELETE FROM public.room_join_requests WHERE user_id = p_user;
  DELETE FROM public.project_space_join_requests WHERE user_id = p_user;

  IF v_rooms + v_spaces > 0 THEN
    INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
    VALUES (
      'staff.memberships_removed', auth.uid(), p_user::text, 'user',
      'Staff accounts cannot be members of rooms or project spaces',
      jsonb_build_object('rooms', v_rooms, 'project_spaces', v_spaces)
    );
  END IF;
  RETURN v_rooms + v_spaces;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_staff_memberships(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.on_staff_role_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('moderator'::public.app_role, 'admin'::public.app_role, 'super_admin'::public.app_role) THEN
    PERFORM public.remove_staff_memberships(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_staff_role_assigned ON public.user_roles;
CREATE TRIGGER on_staff_role_assigned
AFTER INSERT OR UPDATE OF role ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.on_staff_role_assigned();


-- ── 5. one-time cleanup of what exists today ────────────────────────────────────────────────────
-- (look first with:  SELECT user_id FROM public.room_members rm WHERE public.is_staff_user(rm.user_id);
--                    SELECT user_id FROM public.project_space_members pm WHERE public.is_staff_user(pm.user_id); )
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM public.room_members
      UNION SELECT user_id FROM public.project_space_members
      UNION SELECT user_id FROM public.room_join_requests
      UNION SELECT user_id FROM public.project_space_join_requests
    ) x
    WHERE public.is_staff_user(user_id)
  LOOP
    PERFORM public.remove_staff_memberships(r.user_id);
  END LOOP;
END $$;


-- ── check ───────────────────────────────────────────────────────────────────────────────────────
-- As a service/SQL-editor user, try:  INSERT INTO public.room_members (room_id, user_id) VALUES ('<room>', '<a staff user id>');
-- → ERROR: Staff accounts cannot be members of rooms or project spaces.
-- A normal user is added exactly as before.
