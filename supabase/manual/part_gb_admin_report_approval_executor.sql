-- PART GB (report approvals): make sure an APPROVED staged report action (take down, shadowban, ban) really gets carried out. Safe to run more than once.
--
-- WHY: in the browser test an admin approved a moderator's staged "report.takedown". The queue row became "approved" and left the queue,
-- but the post was still on the author's profile, the report stayed "reviewing", the author got no notice and the audit log had no
-- "report_takedown" line. The part that carries it out (trigger gov_queue_execute_report_actions, part J) was not running on the project.
-- WHAT IT DOES
--   1. (Re)creates the trigger function and the trigger, exactly as in part J (an approval carries the action out, a rejection reopens the report).
--   2. Catches up: every report action that was approved but never carried out (its report is still pending or reviewing) is carried out now,
--      as it would have been at the time of approval. Each one is its own block, so one failure is reported as a NOTICE and does not stop the rest.
--
-- PREFLIGHT (read only):
--   select tgname, tgenabled from pg_trigger where tgrelid = 'public.gov_approval_queue'::regclass and not tgisinternal;
--     -- expect gov_queue_enforce_dual_control and gov_queue_execute_report_actions; if the second is missing this part is needed.
--   select q.id, q.action, q.target_id, r.status as report_status
--     from public.gov_approval_queue q join public.content_reports r on r.id::text = q.target_id
--    where q.target_type = 'content_report' and q.action like 'report.%' and q.status = 'approved' and r.status in ('pending', 'reviewing');
--     -- the approved-but-not-carried-out rows this part will catch up
-- POST-CHECK (read only): the preflight's second query returns 0 rows; the reported post is gone, the report is resolved, the author has a
--   "content removed" notice and the audit log has a "report_takedown" line.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.gov_queue_execute_report_actions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.target_type = 'content_report' AND NEW.action LIKE 'report.%' AND OLD.status = 'pending' THEN
    IF NEW.status = 'approved' THEN
      PERFORM public._apply_report_action(NEW.target_id::uuid, substring(NEW.action FROM 8), NEW.reason, NEW.maker_id, NEW.checker_id);
    ELSIF NEW.status = 'rejected' THEN
      UPDATE public.content_reports SET status = 'pending' WHERE id = NEW.target_id::uuid AND status = 'reviewing';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.gov_queue_execute_report_actions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS gov_queue_execute_report_actions ON public.gov_approval_queue;
CREATE TRIGGER gov_queue_execute_report_actions
  AFTER UPDATE ON public.gov_approval_queue
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.gov_queue_execute_report_actions();

-- catch up on what was approved while the trigger was missing
DO $$
DECLARE
  q record;
BEGIN
  FOR q IN
    SELECT g.id, g.action, g.target_id, g.reason, g.maker_id, g.checker_id
      FROM public.gov_approval_queue g
      JOIN public.content_reports r ON r.id::text = g.target_id
     WHERE g.target_type = 'content_report' AND g.action LIKE 'report.%' AND g.status = 'approved'
       AND r.status IN ('pending', 'reviewing')
     ORDER BY g.created_at
  LOOP
    BEGIN
      PERFORM public._apply_report_action(q.target_id::uuid, substring(q.action FROM 8), q.reason, q.maker_id, q.checker_id);
      RAISE NOTICE 'Carried out % for report %', q.action, q.target_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not carry out % for report % (%)', q.action, q.target_id, SQLERRM;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
