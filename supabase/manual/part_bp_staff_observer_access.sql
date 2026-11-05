-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- part_bp: staff "audited access" is an OBSERVER visit, not membership
--
-- Today a staff member who passes the "Audited Access" gate is treated like a member everywhere:
-- they can post in a room, their reads are recorded like a member's, and the encryption key that was
-- handed to them stays in the database after the grant ends.
--
-- This part makes the database enforce what the screens will show (read-only, time-boxed):
--
--   1. is_staff_observer()      one place that answers "is this person a staff member who is only visiting?"
--   2. Read-only                a staff observer cannot post messages or write read receipts in a room or a project
--                               space. Done with RESTRICTIVE policies, so every existing policy keeps working
--                               exactly as before for everybody else: they can only remove access, never add it.
--   3. Keys end with the visit  the observer's key copy is deleted when the grant is removed or has expired, and
--                               cannot be read once the grant is over.
--   4. end_staff_access()       the "Lock" button: ends the visit, removes the key copy, writes the audit line.
--   5. purge_expired_staff_access()  removes expired grants (and, through the trigger, their keys). Safe to call
--                               at any time; schedule it if pg_cron is available (see the end of the file).
--
-- Not changed: how access is requested or approved, the 2-hour limit, the emergency override, the audit ledger,
-- the policies that let a grant holder READ messages, and everything members and creators can do.
-- Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ── 1. who counts as a staff observer ───────────────────────────────────────────────────────────
-- A staff role, and NOT the creator or a member of that room / project space.
-- (A staff member who genuinely belongs to a space keeps the rights they already had there.)
CREATE OR REPLACE FUNCTION public.is_staff_observer(p_user uuid, p_target_type text, p_target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user
        AND ur.role IN ('moderator'::public.app_role, 'admin'::public.app_role, 'super_admin'::public.app_role)
    )
    AND NOT (
      CASE p_target_type
        WHEN 'room' THEN
          EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = p_target_id AND rm.user_id = p_user)
          OR EXISTS (SELECT 1 FROM public.discussion_rooms dr WHERE dr.id = p_target_id AND dr.creator_id = p_user)
        WHEN 'project_space' THEN
          EXISTS (SELECT 1 FROM public.project_space_members pm WHERE pm.project_space_id = p_target_id AND pm.user_id = p_user)
          OR EXISTS (
            SELECT 1
            FROM public.project_spaces ps
            LEFT JOIN public.projects p ON p.id = ps.project_id
            WHERE ps.id = p_target_id AND (ps.creator_id = p_user OR p.creator_id = p_user)
          )
        ELSE false
      END
    );
$$;

REVOKE ALL ON FUNCTION public.is_staff_observer(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_observer(uuid, text, uuid) TO authenticated;


-- ── 2. read-only: no posting, no read receipts ──────────────────────────────────────────────────
-- RESTRICTIVE = "and also". Existing permissive policies decide who may do something; these only take it
-- away from a staff observer.
DROP POLICY IF EXISTS "Staff observers cannot post room messages" ON public.room_messages;
CREATE POLICY "Staff observers cannot post room messages"
ON public.room_messages AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (NOT public.is_staff_observer(auth.uid(), 'room', room_id));

DROP POLICY IF EXISTS "Staff observers cannot post project space messages" ON public.project_space_messages;
CREATE POLICY "Staff observers cannot post project space messages"
ON public.project_space_messages AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (NOT public.is_staff_observer(auth.uid(), 'project_space', project_space_id));

-- an observer reading a room must not show up as "seen by" for the people in it
DROP POLICY IF EXISTS "Staff observers leave no read receipts (rooms)" ON public.room_message_read_status;
CREATE POLICY "Staff observers leave no read receipts (rooms)"
ON public.room_message_read_status AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (NOT public.is_staff_observer(auth.uid(), 'room', room_id));

DROP POLICY IF EXISTS "Staff observers do not update read receipts (rooms)" ON public.room_message_read_status;
CREATE POLICY "Staff observers do not update read receipts (rooms)"
ON public.room_message_read_status AS RESTRICTIVE FOR UPDATE TO authenticated
USING (NOT public.is_staff_observer(auth.uid(), 'room', room_id))
WITH CHECK (NOT public.is_staff_observer(auth.uid(), 'room', room_id));

DROP POLICY IF EXISTS "Staff observers leave no read receipts (projects)" ON public.project_message_read_status;
CREATE POLICY "Staff observers leave no read receipts (projects)"
ON public.project_message_read_status AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (NOT public.is_staff_observer(auth.uid(), 'project_space', project_space_id));

DROP POLICY IF EXISTS "Staff observers do not update read receipts (projects)" ON public.project_message_read_status;
CREATE POLICY "Staff observers do not update read receipts (projects)"
ON public.project_message_read_status AS RESTRICTIVE FOR UPDATE TO authenticated
USING (NOT public.is_staff_observer(auth.uid(), 'project_space', project_space_id))
WITH CHECK (NOT public.is_staff_observer(auth.uid(), 'project_space', project_space_id));


-- ── 3. the key copy lives exactly as long as the visit ──────────────────────────────────────────
-- 3a. an observer can read their key copy only while a grant is active
DROP POLICY IF EXISTS "Staff observers read keys only during an active grant" ON public.group_keys;
CREATE POLICY "Staff observers read keys only during an active grant"
ON public.group_keys AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT public.is_staff_observer(auth.uid(), target_type, target_id)
  OR EXISTS (
    SELECT 1 FROM public.space_access_grants g
    WHERE g.user_id = auth.uid()
      AND g.target_type = group_keys.target_type
      AND g.target_id = group_keys.target_id::text
      AND g.expires_at > now()
  )
);

-- 3b. when a grant row goes away (Lock, expiry cleanup, an admin revoking it), the key copy goes with it,
--     unless the person is a real member of that space
CREATE OR REPLACE FUNCTION public.drop_staff_key_with_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid;
BEGIN
  BEGIN
    v_target := OLD.target_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN OLD;
  END;

  -- another active grant for the same person and space keeps the key
  IF EXISTS (
    SELECT 1 FROM public.space_access_grants g
    WHERE g.user_id = OLD.user_id AND g.target_type = OLD.target_type
      AND g.target_id = OLD.target_id AND g.expires_at > now() AND g.id <> OLD.id
  ) THEN
    RETURN OLD;
  END IF;

  IF public.is_staff_observer(OLD.user_id, OLD.target_type, v_target) THEN
    DELETE FROM public.group_keys
    WHERE user_id = OLD.user_id AND target_type = OLD.target_type AND target_id = v_target;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS drop_staff_key_with_grant ON public.space_access_grants;
CREATE TRIGGER drop_staff_key_with_grant
AFTER DELETE ON public.space_access_grants
FOR EACH ROW EXECUTE FUNCTION public.drop_staff_key_with_grant();


-- ── 4. the Lock button: end my visit now ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.end_staff_access(p_target_type text, p_target_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  DELETE FROM public.space_access_grants
  WHERE user_id = auth.uid() AND target_type = p_target_type AND target_id = p_target_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
    VALUES (
      'chat.end_access', auth.uid(), p_target_id, p_target_type,
      'Staff ended their own audited access',
      jsonb_build_object('grants_removed', v_count)
    );
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.end_staff_access(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_staff_access(text, text) TO authenticated;


-- ── 5. expired grants clean themselves up ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_expired_staff_access()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.space_access_grants WHERE expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_staff_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_staff_access() TO authenticated;

-- Optional (only if the pg_cron extension is enabled in your project): run the cleanup every 10 minutes.
-- SELECT cron.schedule('purge-expired-staff-access', '*/10 * * * *', $$SELECT public.purge_expired_staff_access();$$);


-- ── check ───────────────────────────────────────────────────────────────────────────────────────
-- Run these as a normal member first (should still work), then as a staff account that only visits:
--   insert a message into the room  -> rejected (new row violates row-level security policy)
--   select from the room's messages -> still works while the grant is active
--   after "Lock": select from group_keys for that room -> no row
