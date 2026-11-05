-- PART FX (super admin, 1) - the audit log must record when a two-person request is STARTED and when it is REJECTED. Safe to run more than once.
--
-- WHAT THE TEST FOUND: the Approvals screen says "Approvals and rejections are recorded in the audit log", but only an APPROVED request wrote an audit row.
-- A request that was staged and then rejected (or is still waiting) left no trace: the audit log could not answer "who asked for this role, who said no, and why".
-- THE FIX: a trigger on gov_approval_queue writes one audit row when a request is staged ('request_<action>', by the maker) and one when it is rejected
-- ('reject_<action>', by the checker, with the reason). Approvals keep using the existing rows. The audit table stays append-only (nothing here updates or deletes it).
--
-- PREFLIGHT (read only): select count(*) from public.audit_logs where action like 'request\_%' or action like 'reject\_%';    -- 0 now
-- POST-CHECK  (read only): stage a request and reject it in the Super admin console, then the same query returns 2 rows and the Security > Audit log shows them.

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.gov_queue_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid;
  v_role text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_actor := NEW.maker_id;
    v_role := CASE public.staff_rank(v_actor) WHEN 3 THEN 'super_admin' WHEN 2 THEN 'admin' WHEN 1 THEN 'moderator' ELSE 'staff' END;
    INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
    VALUES (v_actor, v_role, 'request_' || replace(NEW.action, '.', '_'), COALESCE(NEW.target_type, 'request'), COALESCE(NEW.target_id::text, NEW.id::text),
            jsonb_build_object('reason', NEW.reason, 'change', NEW.payload, 'maker_id', NEW.maker_id, 'queue_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'rejected' THEN
    v_actor := COALESCE(NEW.checker_id, auth.uid());
    v_role := CASE public.staff_rank(v_actor) WHEN 3 THEN 'super_admin' WHEN 2 THEN 'admin' WHEN 1 THEN 'moderator' ELSE 'staff' END;
    INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
    VALUES (v_actor, v_role, 'reject_' || replace(NEW.action, '.', '_'), COALESCE(NEW.target_type, 'request'), COALESCE(NEW.target_id::text, NEW.id::text),
            jsonb_build_object('reason', NEW.decision_reason, 'asked_reason', NEW.reason, 'maker_id', NEW.maker_id, 'checker_id', v_actor, 'queue_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.gov_queue_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_gov_queue_audit ON public.gov_approval_queue;
CREATE TRIGGER trg_gov_queue_audit AFTER INSERT OR UPDATE OF status ON public.gov_approval_queue
  FOR EACH ROW EXECUTE FUNCTION public.gov_queue_audit();

NOTIFY pgrst, 'reload schema';
