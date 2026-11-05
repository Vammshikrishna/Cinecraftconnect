-- PART EG - remove a super admin from inside the app, with two people. Safe to run more than once.
-- Run after parts J, BI, DV and EF.
--
-- BEFORE THIS PART a super admin could never be removed from the app (the rule "nobody can change another super admin" is
-- deliberate: one stolen account must not be able to strip all the others). This part adds ONE safe way:
--   * one super admin REQUESTS the removal of another super admin (reason of at least 5 characters),
--   * a DIFFERENT super admin APPROVES it (the person being removed can never be the requester or the approver),
--   * it only works while at least THREE super admins exist (requester, approver and the one being removed), so at least two
--     remain afterwards; with fewer than three nothing can be removed from the app (use the SQL editor, see below),
--   * nobody can request or approve their own removal,
--   * removal deletes the role row, turns off their staff flag and writes an audit line 'remove_super_admin'.
-- Everything else stays as before: the old "user.revoke_role" path still refuses to touch a super admin.
--
-- The SQL editor still works for the project owner at any time (it has no signed-in user, so the role guard allows it):
--   delete from public.user_roles where user_id = '<id>' and role::text = 'super_admin';
--
-- PREFLIGHT (read only: run first, they change nothing)
--   select count(distinct user_id) as super_admins from public.user_roles where role::text = 'super_admin';
--   select u.email, r.role from public.user_roles r join auth.users u on u.id = r.user_id order by r.role, u.email;
--   select id, action, target_id, status from public.gov_approval_queue where action = 'staff.remove_super_admin';

BEGIN;

-- 1. the request (the person asking must be a super admin; the queue row is staged, nothing changes yet)
CREATE OR REPLACE FUNCTION public.gov_request_super_admin_removal(p_target uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_count integer;
  v_id uuid;
BEGIN
  IF v_me IS NULL OR public.staff_rank(v_me) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can request this' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Please give a reason (at least 5 characters)';
  END IF;
  IF p_target IS NULL OR p_target = v_me THEN
    RAISE EXCEPTION 'You cannot remove yourself';
  END IF;
  IF public.staff_rank(p_target) < 3 THEN
    RAISE EXCEPTION 'That account is not a super admin';
  END IF;
  SELECT count(DISTINCT user_id) INTO v_count FROM public.user_roles WHERE role::text = 'super_admin';
  IF v_count < 3 THEN
    RAISE EXCEPTION 'A super admin can only be removed here while at least 3 super admins exist (so 2 remain). Use the SQL editor otherwise.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gov_approval_queue
              WHERE status = 'pending' AND action = 'staff.remove_super_admin' AND target_id = p_target::text) THEN
    RAISE EXCEPTION 'This removal is already waiting for a second super admin';
  END IF;

  INSERT INTO public.gov_approval_queue (maker_id, action, target_id, target_type, reason, payload, status)
  VALUES (v_me, 'staff.remove_super_admin', p_target::text, 'user', btrim(p_reason), jsonb_build_object('role', 'super_admin'), 'pending')
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('queued', true, 'id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.gov_request_super_admin_removal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gov_request_super_admin_removal(uuid, text) TO authenticated;

-- 2. the approval carries it out (checks everything again at the moment of approval)
CREATE OR REPLACE FUNCTION public.gov_queue_execute_super_admin_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_target uuid;
  v_count integer;
BEGIN
  IF NEW.action <> 'staff.remove_super_admin' OR OLD.status <> 'pending' OR NEW.status <> 'approved' THEN
    RETURN NULL;
  END IF;
  v_target := NEW.target_id::uuid;

  IF public.staff_rank(NEW.checker_id) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can approve this';
  END IF;
  IF v_target IN (NEW.maker_id, NEW.checker_id) OR NEW.maker_id IS NOT DISTINCT FROM NEW.checker_id THEN
    RAISE EXCEPTION 'The requester, the approver and the person being removed must be three different people';
  END IF;
  IF public.staff_rank(v_target) < 3 THEN
    RAISE EXCEPTION 'That account is no longer a super admin';
  END IF;
  SELECT count(DISTINCT user_id) INTO v_count FROM public.user_roles WHERE role::text = 'super_admin';
  IF v_count < 3 THEN
    RAISE EXCEPTION 'At least 3 super admins must exist to remove one (so 2 remain)';
  END IF;

  PERFORM set_config('app.market_system', '1', true);   -- the role guard lets our own functions change roles
  DELETE FROM public.user_roles WHERE user_id = v_target AND role::text = 'super_admin';
  BEGIN
    UPDATE public.profiles SET is_internal = false WHERE id = v_target;   -- no longer a staff account
  EXCEPTION WHEN OTHERS THEN
    NULL;   -- a protected column on some setups: the role row is what matters
  END;
  PERFORM public.send_governance_notification(v_target, 'role_revoke', 'super_admin');
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (NEW.checker_id, 'super_admin', 'remove_super_admin', 'user', NEW.target_id,
          jsonb_build_object('reason', NEW.reason, 'maker_id', NEW.maker_id, 'checker_id', NEW.checker_id, 'super_admins_before', v_count));
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.gov_queue_execute_super_admin_removal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS gov_queue_execute_super_admin_removal ON public.gov_approval_queue;
CREATE TRIGGER gov_queue_execute_super_admin_removal
  AFTER UPDATE ON public.gov_approval_queue
  FOR EACH ROW EXECUTE FUNCTION public.gov_queue_execute_super_admin_removal();

COMMIT;

-- POST-CHECK (read only)
--   select proname from pg_proc where proname in ('gov_request_super_admin_removal') and pronamespace = 'public'::regnamespace;  -- 1 row
--   select tgname from pg_trigger where tgrelid = 'public.gov_approval_queue'::regclass and tgname = 'gov_queue_execute_super_admin_removal';  -- 1 row
--   -- how it works: with 3 or more super admins, super admin A requests the removal of C (Staff Matrix), super admin B approves it
--   -- in the approval queue; C loses the role and staff access, and the audit log shows 'remove_super_admin'.
