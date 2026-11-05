-- Part GH (queue export): CSV export of the moderation queue the moderator is looking at. Safe to run more than once.
--
-- WHAT IT ADDS (staff only, and only after two-step sign-in when that is switched on)
--   * mod_export_queue(case_ids)   takes the case ids shown in the filtered queue (at most 1000) and returns one row per case:
--       case id, type, status, priority, SLA state (overdue / soon / ok / none), created, claimed-by handle, escalation reason (first 200 characters).
--       NO emails, phone numbers, reporter names, report details or message text. Writes one audit entry "export_mod_queue" (who, rows asked, rows returned).
-- The app builds the CSV file in the browser. It keeps working before this is applied: the Export button shows a short note.
--
-- PREFLIGHT (read only, one row, all true):
--   select to_regprocedure('public.staff_rank(uuid)') is not null as rank, to_regprocedure('public.staff_mfa_ok()') is not null as mfa,
--          exists (select 1 from information_schema.columns where table_name = 'content_reports' and column_name = 'escalation_reason') as ga_applied;
-- POST-CHECK (read only): sign in as a moderator, open Moderation, filter the queue, press Export CSV: a file downloads and the audit log
--   gets an "export_mod_queue" line.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.mod_export_queue(p_case_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_ids uuid[] := COALESCE(p_case_ids, '{}'::uuid[]);
  v_out jsonb;
  v_n integer;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 OR NOT public.is_current_user_internal() THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501';
  END IF;
  IF cardinality(v_ids) = 0 THEN RAISE EXCEPTION 'There are no cases to export'; END IF;
  IF cardinality(v_ids) > 1000 THEN RAISE EXCEPTION 'Export at most 1000 cases at a time. Narrow the filter first'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'case_id', r.id, 'type', r.target_type, 'status', r.status, 'priority', r.priority,
           'sla', CASE WHEN r.status NOT IN ('pending', 'reviewing') OR r.due_at IS NULL THEN 'none'
                       WHEN r.due_at < now() THEN 'overdue' WHEN r.due_at < now() + interval '1 hour' THEN 'soon' ELSE 'ok' END,
           'created_at', r.created_at, 'claimed_by', o.username, 'escalation_reason', left(r.escalation_reason, 200)
         ) ORDER BY r.created_at DESC), '[]'::jsonb), count(*)
    INTO v_out, v_n
    FROM public.content_reports r LEFT JOIN public.profiles o ON o.id = r.assigned_to
   WHERE r.id = ANY (v_ids);

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), CASE public.staff_rank(auth.uid()) WHEN 3 THEN 'super_admin' WHEN 2 THEN 'admin' ELSE 'moderator' END,
          'export_mod_queue', 'export', 'mod_queue', jsonb_build_object('asked', cardinality(v_ids), 'rows', v_n));
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION app_private.mod_export_queue(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.mod_export_queue(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mod_export_queue(p_case_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, app_private, pg_temp AS $$
  SELECT app_private.mod_export_queue(p_case_ids);
$$;
REVOKE ALL ON FUNCTION public.mod_export_queue(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_export_queue(uuid[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
