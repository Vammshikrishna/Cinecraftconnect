-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PART CI: the child-safety fast lane for reported chat messages.
-- A chat message reported as "Child safety concern" is urgent at once: due in 15 minutes, admins alerted (and again if
-- it is overdue), cannot be closed by a moderator, and an admin can record that it was passed to the authorities.
-- The readable text the reporter sent with the report is kept as the record (chat itself is end-to-end encrypted).
-- Run after part CH. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.flagged_messages ADD COLUMN IF NOT EXISTS fast_lane boolean NOT NULL DEFAULT false;
ALTER TABLE public.flagged_messages ADD COLUMN IF NOT EXISTS due_at timestamptz;
ALTER TABLE public.flagged_messages ADD COLUMN IF NOT EXISTS overdue_alerted_at timestamptz;
ALTER TABLE public.flagged_messages ADD COLUMN IF NOT EXISTS authority_reported_at timestamptz;
ALTER TABLE public.flagged_messages ADD COLUMN IF NOT EXISTS authority_reported_by uuid;
ALTER TABLE public.flagged_messages ADD COLUMN IF NOT EXISTS authority_ref text;

CREATE OR REPLACE FUNCTION public.flagged_message_prepare()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.reason = 'child_safety' THEN
    NEW.fast_lane := true;
    NEW.due_at := now() + interval '15 minutes';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_flagged_message_prepare ON public.flagged_messages;
CREATE TRIGGER trg_flagged_message_prepare BEFORE INSERT ON public.flagged_messages
  FOR EACH ROW EXECUTE FUNCTION public.flagged_message_prepare();

CREATE OR REPLACE FUNCTION public.alert_fast_lane_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.notify_staff('Child-safety report', 'A reported chat message needs an admin now.', '/moderation', 2);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_alert_fast_lane_message ON public.flagged_messages;
CREATE TRIGGER trg_alert_fast_lane_message AFTER INSERT ON public.flagged_messages
  FOR EACH ROW WHEN (NEW.fast_lane) EXECUTE FUNCTION public.alert_fast_lane_message();

-- only an admin can close one (a moderator can read it and raise it)
CREATE OR REPLACE FUNCTION public.guard_fast_lane_message_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.fast_lane AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'resolved'
     AND auth.uid() IS NOT NULL AND public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'A child-safety report can only be closed by an admin' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_fast_lane_message_close ON public.flagged_messages;
CREATE TRIGGER trg_guard_fast_lane_message_close BEFORE UPDATE OF status ON public.flagged_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_fast_lane_message_close();

-- the list the console uses, with the fast-lane fields (fast-lane reports first)
CREATE OR REPLACE FUNCTION public.staff_list_flagged_messages(p_status text DEFAULT 'pending')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', f.id, 'message_id', f.message_id, 'channel_id', f.channel_id, 'target_type', f.target_type,
      'reporter_username', rp.username, 'sender_id', s.sender, 'sender_username', sp.username,
      'decrypted_content', f.decrypted_content, 'reason', f.reason, 'status', f.status, 'created_at', f.created_at,
      'fast_lane', f.fast_lane, 'due_at', f.due_at,
      'authority_reported_at', f.authority_reported_at, 'authority_ref', f.authority_ref
    ) ORDER BY f.fast_lane DESC, f.created_at DESC), '[]'::jsonb)
    FROM (SELECT * FROM public.flagged_messages WHERE status = p_status ORDER BY fast_lane DESC, created_at DESC LIMIT 100) f
    LEFT JOIN LATERAL (
      SELECT CASE f.target_type
               WHEN 'dm'            THEN (SELECT dm.sender_id FROM public.direct_messages dm WHERE dm.id = f.message_id)
               WHEN 'room'          THEN (SELECT rm.user_id FROM public.room_messages rm WHERE rm.id = f.message_id)
               WHEN 'project_space' THEN (SELECT pm.user_id FROM public.project_space_messages pm WHERE pm.id = f.message_id)
             END AS sender
    ) s ON true
    LEFT JOIN public.profiles rp ON rp.id = f.reporter_id
    LEFT JOIN public.profiles sp ON sp.id = s.sender);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_flagged_messages(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_list_flagged_messages(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_record_authority_message(p_flag uuid, p_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can record this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_ref, ''))) < 3 THEN RAISE EXCEPTION 'Please enter the reference you were given (at least 3 characters)'; END IF;
  UPDATE public.flagged_messages SET authority_reported_at = now(), authority_reported_by = auth.uid(), authority_ref = btrim(p_ref) WHERE id = p_flag;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'message_report_passed_to_authorities', 'flagged_message', p_flag::text, jsonb_build_object('ref', btrim(p_ref)));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_record_authority_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_record_authority_message(uuid, text) TO authenticated;

-- overdue alerts for these, with the existing 15-minute housekeeping
CREATE OR REPLACE FUNCTION public.alert_overdue_fast_lane_messages()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n integer;
BEGIN
  WITH late AS (
    UPDATE public.flagged_messages SET overdue_alerted_at = now()
     WHERE status = 'pending' AND fast_lane AND due_at < now() AND overdue_alerted_at IS NULL RETURNING id
  )
  SELECT count(*)::int INTO v_n FROM late;
  IF v_n > 0 THEN
    PERFORM public.notify_staff('Child-safety report overdue', v_n || ' reported chat message(s) have waited more than 15 minutes.', '/moderation', 2);
  END IF;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.alert_overdue_fast_lane_messages() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reports_housekeeping()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_over integer;
  v_moved integer;
  v_msgs integer;
BEGIN
  v_over := public.alert_overdue_reports();
  v_moved := public.rebalance_reports();
  v_msgs := public.alert_overdue_fast_lane_messages();
  RETURN jsonb_build_object('overdue_alerts', v_over, 'reassigned', v_moved, 'overdue_messages', v_msgs);
END;
$$;
REVOKE ALL ON FUNCTION public.reports_housekeeping() FROM PUBLIC, anon, authenticated;

-- for the analytics and the transparency report (called by _safety_numbers when this part is installed)
CREATE OR REPLACE FUNCTION public._fast_lane_message_counts(p_from timestamptz, p_to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'received', count(*) FILTER (WHERE fast_lane AND created_at >= p_from AND created_at < p_to),
    'passed_on', count(*) FILTER (WHERE authority_reported_at >= p_from AND authority_reported_at < p_to))
  FROM public.flagged_messages;
$$;
REVOKE ALL ON FUNCTION public._fast_lane_message_counts(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

COMMIT;
