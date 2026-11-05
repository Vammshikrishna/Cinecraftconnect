-- PART EF - make the SECOND super admin possible when only one super admin exists. Safe to run more than once.
-- Run after part J (two-person approval), part BI (governance actions) and part DV.
--
-- THE PROBLEM: creating a super admin goes through the approval queue (action 'user.manage_roles', role 'super_admin') and
-- needs a DIFFERENT super admin to approve it. With only one super admin in the project nobody can ever approve, so the second
-- super admin can never be created from the app.
--
-- THE RULE ADDED (and only this): while the project has EXACTLY ONE super admin, that super admin may approve THEIR OWN
-- request to make a second super admin. Everything else about two-person approval stays as it is. To limit the risk of a
-- stolen session, the self-approval is allowed only
--   * for the 'user.manage_roles' action with role 'super_admin',
--   * for a target who is not the requester and is not staff already,
--   * once the request is at least 10 minutes old (time to notice an unexpected request),
--   * while the number of super admins is exactly 1 (as soon as there are two, normal two-person approval applies again).
-- Each such approval writes an audit line 'bootstrap_second_super_admin' with the requester, the target and the reason.
--
-- THE SAFEST ALTERNATIVE (no code at all): the project owner can give a second super admin directly in the Supabase SQL editor
-- (insert a row into public.user_roles for that user with role 'super_admin'); the SQL editor has no end-user session, which the
-- role guard allows. Use that if you prefer to keep the app strictly two-person at all times, and do not run this part.
--
-- PREFLIGHT (read only: run first, they change nothing)
--   -- a) how many super admins exist right now (this part only matters while it is 1)
--   select count(distinct user_id) from public.user_roles where role::text = 'super_admin';
--   -- b) the trigger this part replaces exists (expect 1 row)
--   select tgname from pg_trigger where tgrelid = 'public.gov_approval_queue'::regclass and tgname = 'gov_queue_enforce_dual_control';
--   -- c) pending role requests waiting for an approver
--   select id, maker_id, target_id, payload, created_at from public.gov_approval_queue where status = 'pending' and action = 'user.manage_roles';

BEGIN;

-- true when the signed-in person may approve this queue row themselves under the bootstrap rule
CREATE OR REPLACE FUNCTION public.gov_can_bootstrap_approve(p_queue_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  q public.gov_approval_queue%ROWTYPE;
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RETURN false; END IF;
  SELECT * INTO q FROM public.gov_approval_queue WHERE id = p_queue_id;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN q.status = 'pending'
     AND q.maker_id = v_me
     AND q.action = 'user.manage_roles'
     AND q.payload ->> 'role' = 'super_admin'
     AND q.target_id IS DISTINCT FROM v_me::text
     AND public.staff_rank(v_me) >= 3
     AND (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role::text = 'super_admin') = 1
     AND q.created_at <= now() - interval '10 minutes'
     AND public.staff_rank(q.target_id::uuid) = 0;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.gov_can_bootstrap_approve(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gov_can_bootstrap_approve(uuid) TO authenticated;

-- the dual-control trigger from part J, with the one bootstrap exception
CREATE OR REPLACE FUNCTION public.gov_queue_enforce_dual_control()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bootstrap boolean := false;
BEGIN
  -- Service role / background jobs / SECURITY DEFINER internals (no end-user JWT) are trusted.
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_current_user_internal() THEN
      RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
    END IF;
    NEW.maker_id := auth.uid();      -- cannot impersonate another maker
    NEW.checker_id := NULL;
    NEW.status := 'pending';         -- cannot insert pre-approved rows
    RETURN NEW;
  END IF;

  -- UPDATE: only decisions on pending rows, and only by a different staff member.
  IF NEW.action IS DISTINCT FROM OLD.action OR NEW.target_id IS DISTINCT FROM OLD.target_id
     OR NEW.target_type IS DISTINCT FROM OLD.target_type OR NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.maker_id IS DISTINCT FROM OLD.maker_id THEN
    RAISE EXCEPTION 'Approval requests are immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'pending' OR NEW.status NOT IN ('approved', 'rejected') THEN
      RAISE EXCEPTION 'Invalid status transition % -> %', OLD.status, NEW.status;
    END IF;
    IF NOT public.is_current_user_internal() THEN
      RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
    END IF;
    IF OLD.maker_id = auth.uid() THEN
      -- the ONE exception: the only super admin approving the request that creates the second super admin (see the header).
      -- Rejecting your own request is not needed (a requester can simply leave it), so only approval is allowed here.
      v_bootstrap := NEW.status = 'approved' AND public.gov_can_bootstrap_approve(OLD.id);
      IF NOT v_bootstrap THEN
        RAISE EXCEPTION 'Dual-control violation: the requester cannot approve or reject their own request';
      END IF;
      INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
      VALUES (auth.uid(), 'super_admin', 'bootstrap_second_super_admin', 'user', OLD.target_id,
              jsonb_build_object('queue_id', OLD.id, 'reason', OLD.reason, 'maker_id', OLD.maker_id,
                                 'note', 'self-approved because this project had only one super admin'));
    END IF;
    NEW.checker_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gov_queue_enforce_dual_control ON public.gov_approval_queue;
CREATE TRIGGER gov_queue_enforce_dual_control
  BEFORE INSERT OR UPDATE ON public.gov_approval_queue
  FOR EACH ROW EXECUTE FUNCTION public.gov_queue_enforce_dual_control();

COMMIT;

-- POST-CHECK (read only)
--   select proname from pg_proc where proname = 'gov_can_bootstrap_approve' and pronamespace = 'public'::regnamespace;   -- 1 row
--   select prosrc like '%bootstrap_second_super_admin%' from pg_proc where proname = 'gov_queue_enforce_dual_control';    -- true
--   -- how to use it: as the only super admin, open Staff Matrix, request the role 'super_admin' for another account,
--   -- wait 10 minutes, then approve your own request in the approval queue. The new super admin appears in user_roles and an
--   -- audit line 'bootstrap_second_super_admin' is written. From then on two super admins exist and normal approval applies.
