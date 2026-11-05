-- Part GA: moderation team tools
--   * a case claimed by one moderator can only be closed by that moderator (admins can override); idle claims free themselves
--   * escalation needs a reason and a target (admin or super admin) and both are kept on the case
--   * repeat-offender facts for a case or a user lookup (strikes in 90 days, earlier bans)
--   * one timeline per case (reports, claims, notes, escalation, approvals, actions)
--   * duplicate reports close together (the console already shows them as one case)
-- The web app keeps working before this is applied (it shows the old behaviour and a short note).
-- Safe to run more than once.
--
-- PREFLIGHT (read only, should return one row with every column true):
--   select to_regclass('public.content_reports') is not null as reports, to_regprocedure('public.staff_rank(uuid)') is not null as rank,
--          to_regclass('public.user_strikes') is not null as strikes, to_regclass('public.user_bans') is not null as bans,
--          to_regprocedure('public.notify_staff(text,text,text,integer,uuid)') is not null as notify;
--
-- POST-CHECK (after running):
--   select column_name from information_schema.columns where table_schema = 'public' and table_name = 'content_reports'
--    and column_name in ('claimed_at','last_activity_at','escalation_reason','escalated_to','escalated_by','escalated_at');   -- 6 rows
--   select proname from pg_proc where pronamespace = 'public'::regnamespace
--    and proname in ('release_idle_claims','get_repeat_offender','get_case_timeline','staff_escalate_report','moderator_resolve_report','moderator_claim_report');

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ── 1. claim and escalation facts on the case ───────────────────────────────────────────────────
ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS claimed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at   timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_reason  text,
  ADD COLUMN IF NOT EXISTS escalated_to       text,
  ADD COLUMN IF NOT EXISTS escalated_by       uuid,
  ADD COLUMN IF NOT EXISTS escalated_at       timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_reports_escalated_to_check') THEN
    ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_escalated_to_check
      CHECK (escalated_to IS NULL OR escalated_to IN ('admin', 'super_admin')) NOT VALID;
  END IF;
END $$;

-- ── 2. is somebody else still holding this case? (not idle, not off duty) ───────────────────────
CREATE OR REPLACE FUNCTION public.mod_claim_held_by_other(p_report public.content_reports, p_me uuid, p_idle_minutes integer DEFAULT 30)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_report.assigned_to IS NOT NULL
     AND p_report.assigned_to <> p_me
     AND COALESCE(p_report.last_activity_at, p_report.claimed_at, p_report.created_at) > now() - make_interval(mins => p_idle_minutes)
     AND COALESCE((SELECT d.on_duty FROM public.staff_duty d WHERE d.user_id = p_report.assigned_to), true);
$$;
REVOKE ALL ON FUNCTION public.mod_claim_held_by_other(public.content_reports, uuid, integer) FROM PUBLIC, anon, authenticated;

-- ── 3. claim: take over a case whose owner is idle or off duty; remember when ───────────────────
CREATE OR REPLACE FUNCTION public.moderator_claim_report(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r public.content_reports%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_internal() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_r FROM public.content_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND OR v_r.status NOT IN ('pending', 'reviewing') THEN
    RAISE EXCEPTION 'This case is closed';
  END IF;
  IF public.mod_claim_held_by_other(v_r, auth.uid()) AND public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'This case is being handled by another moderator. It frees up after 30 minutes without activity.';
  END IF;
  UPDATE public.content_reports
     SET assigned_to = auth.uid(), claimed_at = now(), last_activity_at = now(),
         status = CASE WHEN status = 'pending' THEN 'reviewing' ELSE status END
   WHERE id = p_report_id;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'moderator', 'report_claim', 'content_report', p_report_id::text,
          jsonb_build_object('took_over_from', v_r.assigned_to));
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.moderator_claim_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderator_claim_report(uuid) TO authenticated;

-- ── 4. idle claims go back to the pool ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_idle_claims(p_minutes integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n integer;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  p_minutes := GREATEST(5, LEAST(COALESCE(p_minutes, 30), 1440));
  WITH freed AS (
    UPDATE public.content_reports r
       SET assigned_to = NULL, status = 'pending', claimed_at = NULL
     WHERE r.assigned_to IS NOT NULL AND r.status = 'reviewing'
       AND COALESCE(r.last_activity_at, r.claimed_at, r.created_at) < now() - make_interval(mins => p_minutes)
       AND NOT EXISTS (SELECT 1 FROM public.gov_approval_queue q
                        WHERE q.status = 'pending' AND q.target_type = 'content_report' AND q.target_id = r.id::text)
    RETURNING r.id, r.assigned_to
  )
  SELECT count(*) INTO v_n FROM freed;
  IF v_n > 0 THEN
    INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
    VALUES (auth.uid(), 'moderator', 'report_idle_release', 'content_report', 'batch', jsonb_build_object('released', v_n, 'idle_minutes', p_minutes));
  END IF;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.release_idle_claims(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_idle_claims(integer) TO authenticated;

-- a note counts as activity, so a moderator who is writing is not freed
CREATE OR REPLACE FUNCTION public.mod_note_touch_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.content_reports SET last_activity_at = now() WHERE id = NEW.report_id AND assigned_to IS NOT NULL;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.mod_note_touch_report() FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF to_regclass('public.moderation_notes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_mod_note_touch ON public.moderation_notes;
    CREATE TRIGGER trg_mod_note_touch AFTER INSERT ON public.moderation_notes
      FOR EACH ROW EXECUTE FUNCTION public.mod_note_touch_report();
  END IF;
END $$;

-- ── 5. closing or acting on a case: not while another moderator holds it (admins may step in) ───
CREATE OR REPLACE FUNCTION public.moderator_resolve_report(p_report_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_report public.content_reports%ROWTYPE;
  v_res jsonb;
  v_author uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_internal() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('dismiss', 'warn', 'takedown', 'shadowban', 'ban') THEN
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  SELECT * INTO v_report FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;
  IF v_report.status IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'This report has already been closed';
  END IF;
  IF public.mod_claim_held_by_other(v_report, auth.uid()) AND public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'This case is being handled by another moderator. Ask them to hand it over, or wait until it frees up.';
  END IF;
  UPDATE public.content_reports SET last_activity_at = now() WHERE id = p_report_id AND assigned_to IS NOT NULL;

  IF p_action = 'dismiss' THEN
    RETURN public._apply_report_action(p_report_id, 'dismiss', p_note, auth.uid(), NULL);
  END IF;

  IF p_action = 'warn' THEN
    v_res := public._apply_report_action(p_report_id, 'warn', p_note, auth.uid(), NULL);
    v_author := NULLIF(v_res ->> 'author_id', '')::uuid;
    IF v_author IS NOT NULL THEN
      PERFORM public._add_strike(v_author, COALESCE(NULLIF(btrim(p_note), ''), v_report.reason), p_report_id, auth.uid());
    END IF;
    RETURN v_res;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gov_approval_queue
    WHERE status = 'pending' AND target_type = 'content_report'
      AND target_id = p_report_id::text AND action = 'report.' || p_action
  ) THEN
    RAISE EXCEPTION 'This action is already waiting for a second approver';
  END IF;

  INSERT INTO public.gov_approval_queue (maker_id, action, target_id, target_type, reason, payload, status)
  VALUES (auth.uid(), 'report.' || p_action, p_report_id::text, 'content_report',
          COALESCE(p_note, 'Report ' || v_report.target_type || ' ' || v_report.target_id),
          jsonb_build_object('report_target_type', v_report.target_type, 'report_target_id', v_report.target_id,
                             'report_reason', v_report.reason),
          'pending');

  UPDATE public.content_reports SET status = 'reviewing' WHERE id = p_report_id AND status = 'pending';

  RETURN jsonb_build_object('success', true, 'queued', true, 'action', p_action);
END;
$$;
REVOKE ALL ON FUNCTION public.moderator_resolve_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderator_resolve_report(uuid, text, text) TO authenticated;

-- ── 6. escalation with a reason and a target ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_escalate_report(p_report_id uuid, p_reason text, p_target text DEFAULT 'admin')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_status text;
  v_priority text;
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501';
  END IF;
  IF p_target NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Choose admin or super admin';
  END IF;
  IF length(v_reason) < 5 THEN
    RAISE EXCEPTION 'Say why this needs to be escalated (at least 5 characters)';
  END IF;
  IF p_target = 'super_admin' AND public.staff_rank(auth.uid()) >= 3 THEN
    RAISE EXCEPTION 'You are already a super admin';
  END IF;

  SELECT status, priority INTO v_status, v_priority FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;
  IF v_status NOT IN ('pending', 'reviewing') THEN RAISE EXCEPTION 'This report has already been closed'; END IF;

  UPDATE public.content_reports
     SET priority = 'urgent', escalation_reason = left(v_reason, 1000), escalated_to = p_target,
         escalated_by = auth.uid(), escalated_at = now(), last_activity_at = now()
   WHERE id = p_report_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'moderator', 'report_escalate', 'content_report', p_report_id::text,
          jsonb_build_object('from_priority', v_priority, 'to_priority', 'urgent', 'target', p_target, 'reason', left(v_reason, 1000)));

  PERFORM public.notify_staff('Case escalated to ' || replace(p_target, '_', ' '),
                              left(v_reason, 160), '/moderation', CASE WHEN p_target = 'super_admin' THEN 3 ELSE 2 END, auth.uid());
  RETURN jsonb_build_object('success', true, 'target', p_target);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_escalate_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_escalate_report(uuid, text, text) TO authenticated;

-- ── 7. repeat-offender facts ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_repeat_offender(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_90 integer := 0;
  v_active integer := 0;
  v_bans integer := 0;
  v_reports integer := 0;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) FILTER (WHERE revoked_at IS NULL AND created_at > now() - interval '90 days'),
         count(*) FILTER (WHERE revoked_at IS NULL AND expires_at > now())
    INTO v_90, v_active FROM public.user_strikes WHERE user_id = p_user;
  IF to_regclass('public.user_bans') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.user_bans WHERE user_id = $1' INTO v_bans USING p_user;
  END IF;
  SELECT count(*) INTO v_reports FROM public.content_reports WHERE reported_user_id = p_user AND created_at > now() - interval '90 days';
  RETURN jsonb_build_object('strikes_90d', v_90, 'strikes_active', v_active, 'previous_bans', v_bans,
                            'reports_90d', v_reports, 'repeat', (v_90 >= 2 OR v_bans >= 1));
EXCEPTION WHEN undefined_column THEN
  -- the report table has no reported_user_id on this database: leave that number out
  RETURN jsonb_build_object('strikes_90d', v_90, 'strikes_active', v_active, 'previous_bans', v_bans,
                            'reports_90d', NULL, 'repeat', (v_90 >= 2 OR v_bans >= 1));
END;
$$;
REVOKE ALL ON FUNCTION public.get_repeat_offender(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_repeat_offender(uuid) TO authenticated;

-- ── 8. one timeline per case ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_case_timeline(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  WITH ev AS (
    SELECT r.created_at AS at, 'reported'::text AS kind, NULL::uuid AS actor, COALESCE(r.reason, '') AS detail
      FROM public.content_reports r WHERE r.id = p_report_id
    UNION ALL
    SELECT a.created_at, a.action, a.actor_id,
           COALESCE(a.metadata ->> 'reason', a.metadata ->> 'note', a.metadata ->> 'target', '')
      FROM public.audit_logs a
     WHERE (a.target_type = 'content_report' AND a.target_id = p_report_id::text)
        -- the closing actions are logged against the reported thing, with the report id in the details
        OR (a.metadata ->> 'report_id') = p_report_id::text
    UNION ALL
    SELECT n.created_at, 'note', COALESCE(NULLIF(to_jsonb(n) ->> 'author_id', ''), NULLIF(to_jsonb(n) ->> 'moderator_id', ''))::uuid, left(n.content, 300)
      FROM public.moderation_notes n WHERE n.report_id = p_report_id
    UNION ALL
    SELECT q.created_at, 'approval_' || q.status, q.maker_id, q.action
      FROM public.gov_approval_queue q WHERE q.target_type = 'content_report' AND q.target_id = p_report_id::text
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('at', e.at, 'kind', e.kind, 'actor', p.username, 'detail', e.detail) ORDER BY e.at), '[]'::jsonb)
    INTO v_out
    FROM ev e LEFT JOIN public.profiles p ON p.id = e.actor;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.get_case_timeline(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_case_timeline(uuid) TO authenticated;

-- ── 8b. several reports about the same thing close together ─────────────────────────────────────
-- The console shows them as one case, but closing only changed the oldest report, so the others stayed in the
-- queue as separate cases. Closing one now closes the open ones about the same post/user/job (each reporter is told).
CREATE OR REPLACE FUNCTION public.close_duplicate_reports()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status IN ('resolved', 'dismissed') AND OLD.status IN ('pending', 'reviewing') THEN
    UPDATE public.content_reports d
       SET status = NEW.status, reviewed_by = NEW.reviewed_by, reviewed_at = COALESCE(NEW.reviewed_at, now()),
           resolution_note = COALESCE(NEW.resolution_note, NEW.status)
     WHERE d.id <> NEW.id AND d.target_type = NEW.target_type AND d.target_id = NEW.target_id
       AND d.status IN ('pending', 'reviewing');
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.close_duplicate_reports() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_close_duplicate_reports ON public.content_reports;
CREATE TRIGGER trg_close_duplicate_reports AFTER UPDATE OF status ON public.content_reports
  FOR EACH ROW WHEN (NEW.status IN ('resolved', 'dismissed') AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.close_duplicate_reports();

-- (Saved queue filters reuse public.staff_saved_views from part GB, scope mod.queue. Run part_gb_admin_saved_views.sql too.)

NOTIFY pgrst, 'reload schema';
COMMIT;
