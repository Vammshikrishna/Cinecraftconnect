-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- part_br: a staff account sees nothing inside a room or project space without an ACTIVE audited-access grant
--
-- Found in use: after "End access" a staff account still saw the last message of every room in the list, and the
-- member numbers. Older policies, such as ones that let anybody read a public room, let it through, and the room
-- list reads messages directly.
--
-- This part closes that for good at the database, whatever other policies say. Each rule is RESTRICTIVE, which means
-- "and also": it can only remove access, so nothing is opened for anybody, and members, creators and normal users
-- are untouched (staff accounts are never members, see part_bq).
--
--   A staff account can read the messages, the member list, the read receipts and the member count of a room or a
--   project space ONLY while it holds an active, unexpired grant for exactly that room or space.
--
-- Run after part_bp and part_bq. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ── helper: does this account hold an active grant for this target? ──────────────────────────────
CREATE OR REPLACE FUNCTION public.has_active_staff_grant(p_user uuid, p_target_type text, p_target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_access_grants g
    WHERE g.user_id = p_user
      AND g.target_type = p_target_type
      AND g.target_id = p_target_id::text
      AND g.expires_at > now()
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_staff_grant(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_staff_grant(uuid, text, uuid) TO authenticated;


-- ── messages ────────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff read room messages only with a grant" ON public.room_messages;
CREATE POLICY "Staff read room messages only with a grant"
ON public.room_messages AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.is_staff_user(auth.uid()) OR public.has_active_staff_grant(auth.uid(), 'room', room_id));

DROP POLICY IF EXISTS "Staff read project messages only with a grant" ON public.project_space_messages;
CREATE POLICY "Staff read project messages only with a grant"
ON public.project_space_messages AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.is_staff_user(auth.uid()) OR public.has_active_staff_grant(auth.uid(), 'project_space', project_space_id));


-- ── member lists ────────────────────────────────────────────────────────────────────────────────
-- (a staff account with a grant has always been able to see a project space's members; rooms had no such rule,
--  so one is added: it only applies to staff holding a grant for that room)
DROP POLICY IF EXISTS "Staff can view room members with active grant" ON public.room_members;
CREATE POLICY "Staff can view room members with active grant"
ON public.room_members FOR SELECT TO authenticated
USING (public.is_staff_user(auth.uid()) AND public.has_active_staff_grant(auth.uid(), 'room', room_id));

DROP POLICY IF EXISTS "Staff read room members only with a grant" ON public.room_members;
CREATE POLICY "Staff read room members only with a grant"
ON public.room_members AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.is_staff_user(auth.uid()) OR public.has_active_staff_grant(auth.uid(), 'room', room_id));

DROP POLICY IF EXISTS "Staff read project members only with a grant" ON public.project_space_members;
CREATE POLICY "Staff read project members only with a grant"
ON public.project_space_members AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.is_staff_user(auth.uid()) OR public.has_active_staff_grant(auth.uid(), 'project_space', project_space_id));


-- ── who has read what ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff read room receipts only with a grant" ON public.room_message_read_status;
CREATE POLICY "Staff read room receipts only with a grant"
ON public.room_message_read_status AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.is_staff_user(auth.uid()) OR public.has_active_staff_grant(auth.uid(), 'room', room_id));

DROP POLICY IF EXISTS "Staff read project receipts only with a grant" ON public.project_message_read_status;
CREATE POLICY "Staff read project receipts only with a grant"
ON public.project_message_read_status AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.is_staff_user(auth.uid()) OR public.has_active_staff_grant(auth.uid(), 'project_space', project_space_id));


-- ── member counts ───────────────────────────────────────────────────────────────────────────────
-- the count function runs with elevated rights, so it has to apply the rule itself: a staff account gets a count
-- only for rooms it holds a grant for (the others come back as 0 and the screens show no number for staff)
CREATE OR REPLACE FUNCTION public.room_member_counts(p_room_ids uuid[])
RETURNS TABLE (room_id uuid, member_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT ids.id AS room_id,
         CASE
           WHEN public.is_staff_user(auth.uid()) AND NOT public.has_active_staff_grant(auth.uid(), 'room', ids.id) THEN 0
           ELSE (SELECT count(*)::int FROM public.room_members m WHERE m.room_id = ids.id)
         END AS member_count
    FROM unnest(p_room_ids) AS ids(id);
$$;
REVOKE ALL ON FUNCTION public.room_member_counts(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.room_member_counts(uuid[]) TO authenticated;


-- ── ending a visit also closes the request it came from ────────────────────────────────────────
-- Found in use: after End access the request still said 'approved', so the Audited Access screen treated the
-- person as already let in. A request is now closed ('expired') together with its grant.
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

  UPDATE public.space_access_requests
     SET status = 'expired'
   WHERE requester_id = auth.uid() AND target_type = p_target_type AND target_id = p_target_id AND status = 'approved';

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
  UPDATE public.space_access_requests SET status = 'expired' WHERE status = 'approved' AND expires_at <= now();
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_staff_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_staff_access() TO authenticated;


-- ── check ───────────────────────────────────────────────────────────────────────────────────────
-- As a staff account with NO grant:  select count(*) from room_messages;      -> 0
--                                    select count(*) from room_members;       -> 0
--                                    select * from room_member_counts(array['<room id>']::uuid[]);  -> 0
-- After passing Audited Access for one room: only that room's rows appear, until the grant ends.
-- As a normal member everything reads exactly as before.
