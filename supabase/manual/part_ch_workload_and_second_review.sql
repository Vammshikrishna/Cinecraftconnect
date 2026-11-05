-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PART CH: workload and a second look.
--   * Service-time targets are now settings (minutes per priority) in Admin → Detection & Workload.
--   * A case that is twice as late as its target is escalated to the admins, on top of the alert when it first passes.
--   * Every 15 minutes, open cases that belong to nobody, or to someone who is off duty, go to the on-duty person with
--     the lightest load (a child-safety case only to an admin; never to the person who reported it).
--   * Second review: a share of closed cases (a setting; every child-safety case) is handed to a different staff member
--     who sees the case and the decision and says whether they agree. A disagreement alerts the admins. It never
--     changes the decision by itself.
-- Run after part CG. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

-- targets from settings (part CG: sla_*_min)
CREATE OR REPLACE FUNCTION public.report_due_interval(p_priority text)
RETURNS interval LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT make_interval(mins => CASE p_priority WHEN 'urgent' THEN public._ss('sla_urgent_min') WHEN 'high' THEN public._ss('sla_high_min')
                                               WHEN 'low' THEN public._ss('sla_low_min') ELSE public._ss('sla_medium_min') END);
$$;

-- alerts: first when a case passes its target, again when it is twice as late (and the fast lane reaches admins)
CREATE OR REPLACE FUNCTION public.alert_overdue_reports()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_count integer;
  v_fast integer;
  v_late integer;
BEGIN
  WITH due AS (
    UPDATE public.content_reports SET overdue_alerted_at = now()
     WHERE status IN ('pending', 'reviewing') AND due_at < now() AND overdue_alerted_at IS NULL
    RETURNING id, fast_lane
  )
  SELECT count(*)::int, (count(*) FILTER (WHERE fast_lane))::int INTO v_count, v_fast FROM due;
  IF v_count > 0 THEN
    PERFORM public.notify_staff('Reports are overdue', v_count || ' report(s) passed their response target.', '/moderation', 1);
  END IF;
  IF v_fast > 0 THEN
    PERFORM public.notify_staff('Child-safety report overdue', v_fast || ' child-safety report(s) have waited more than 15 minutes.', '/moderation', 2);
  END IF;

  WITH late AS (
    UPDATE public.content_reports SET escalated_at = now(), escalation_level = COALESCE(escalation_level, 0) + 1
     WHERE status IN ('pending', 'reviewing') AND escalated_at IS NULL AND due_at IS NOT NULL
       AND now() > due_at + (due_at - created_at)
    RETURNING id
  )
  SELECT count(*)::int INTO v_late FROM late;
  IF v_late > 0 THEN
    PERFORM public.notify_staff('Reports far past their target', v_late || ' report(s) are more than twice as late as their target. They need an admin.', '/moderation', 2);
  END IF;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.alert_overdue_reports() FROM PUBLIC, anon, authenticated;

-- hand open cases to the right person
CREATE OR REPLACE FUNCTION public.rebalance_reports()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r record;
  v_to uuid;
  v_n integer := 0;
BEGIN
  FOR r IN
    SELECT c.id, c.assigned_to, c.fast_lane, c.reported_by
      FROM public.content_reports c
     WHERE c.status IN ('pending', 'reviewing')
       AND (c.assigned_to IS NULL OR NOT COALESCE((SELECT d.on_duty FROM public.staff_duty d WHERE d.user_id = c.assigned_to), false))
     ORDER BY public.report_priority_rank(c.priority) DESC, c.due_at NULLS LAST
     LIMIT 200
  LOOP
    SELECT d.user_id INTO v_to FROM public.staff_duty d
     WHERE d.on_duty AND public.staff_rank(d.user_id) >= CASE WHEN r.fast_lane THEN 2 ELSE 1 END
       AND (r.reported_by IS NULL OR d.user_id <> r.reported_by)
     ORDER BY (SELECT count(*) FROM public.content_reports x WHERE x.assigned_to = d.user_id AND x.status IN ('pending', 'reviewing')), random()
     LIMIT 1;
    IF v_to IS NOT NULL AND v_to IS DISTINCT FROM r.assigned_to THEN
      UPDATE public.content_reports SET assigned_to = v_to WHERE id = r.id;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.rebalance_reports() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reports_housekeeping()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_over integer;
  v_moved integer;
BEGIN
  v_over := public.alert_overdue_reports();
  v_moved := public.rebalance_reports();
  RETURN jsonb_build_object('overdue_alerts', v_over, 'reassigned', v_moved);
END;
$$;
REVOKE ALL ON FUNCTION public.reports_housekeeping() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname IN ('alert-overdue-reports', 'reports-housekeeping');
      PERFORM cron.schedule('reports-housekeeping', '*/15 * * * *', $cron$SELECT public.reports_housekeeping();$cron$);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule reports_housekeeping (%). Call it every 15 minutes from your own schedule.', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron is not enabled. Call reports_housekeeping() every 15 minutes from your own schedule.';
  END IF;
END $$;

-- ── second review ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid NOT NULL REFERENCES public.content_reports(id) ON DELETE CASCADE,
  original_by     uuid NOT NULL,
  original_status text NOT NULL,
  reviewer_id     uuid NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'agree', 'disagree')),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_one_per_report ON public.qa_reviews (report_id);
CREATE INDEX IF NOT EXISTS idx_qa_reviewer ON public.qa_reviews (reviewer_id, status);
ALTER TABLE public.qa_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qa_reviews_read ON public.qa_reviews;
CREATE POLICY qa_reviews_read ON public.qa_reviews FOR SELECT USING (reviewer_id = auth.uid() OR public.staff_rank(auth.uid()) >= 2);
REVOKE INSERT, UPDATE, DELETE ON public.qa_reviews FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.qa_sample_case()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_pct integer;
  v_to uuid;
BEGIN
  BEGIN
    IF NEW.reviewed_by IS NULL OR EXISTS (SELECT 1 FROM public.qa_reviews WHERE report_id = NEW.id) THEN RETURN NULL; END IF;
    v_pct := CASE WHEN NEW.fast_lane THEN 100 ELSE public._ss('qa_sample_pct') END;
    IF v_pct <= 0 OR random() * 100 >= v_pct THEN RETURN NULL; END IF;

    SELECT s.user_id INTO v_to
      FROM (SELECT DISTINCT r.user_id FROM public.user_roles r WHERE public.staff_rank(r.user_id) >= CASE WHEN NEW.fast_lane THEN 2 ELSE 1 END) s
     WHERE s.user_id <> NEW.reviewed_by AND (NEW.reported_by IS NULL OR s.user_id <> NEW.reported_by)
     ORDER BY COALESCE((SELECT d.on_duty FROM public.staff_duty d WHERE d.user_id = s.user_id), false) DESC,
              (SELECT count(*) FROM public.qa_reviews q WHERE q.reviewer_id = s.user_id AND q.status = 'pending'), random()
     LIMIT 1;
    IF v_to IS NULL THEN RETURN NULL; END IF;

    INSERT INTO public.qa_reviews (report_id, original_by, original_status, reviewer_id) VALUES (NEW.id, NEW.reviewed_by, NEW.status, v_to);
    INSERT INTO public.notifications (user_id, title, message, type, priority, action_url)
    VALUES (v_to, 'A closed case to double-check', 'You were picked to give a second opinion on a decision.', 'staff_alert', 'medium', '/moderation');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'qa_sample_case failed: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_qa_sample_case ON public.content_reports;
CREATE TRIGGER trg_qa_sample_case AFTER UPDATE OF status ON public.content_reports
  FOR EACH ROW WHEN (NEW.status IN ('resolved', 'dismissed') AND OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.qa_sample_case();

CREATE OR REPLACE FUNCTION public.staff_my_qa_reviews(p_status text DEFAULT 'pending')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', q.id, 'status', q.status, 'created_at', q.created_at, 'note', q.note,
      'original_status', q.original_status,
      'target_type', c.target_type, 'reason', c.reason, 'priority', c.priority, 'fast_lane', c.fast_lane, 'source', c.source,
      'details', c.details, 'evidence', c.evidence, 'resolution_note', c.resolution_note, 'auto_actions', c.auto_actions
    ) ORDER BY q.created_at DESC), '[]'::jsonb)
    FROM (SELECT * FROM public.qa_reviews WHERE reviewer_id = auth.uid() AND (p_status = 'all' OR status = p_status) ORDER BY created_at DESC LIMIT 50) q
    JOIN public.content_reports c ON c.id = q.report_id);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_my_qa_reviews(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_my_qa_reviews(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_submit_qa_review(p_id uuid, p_verdict text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  q public.qa_reviews%ROWTYPE;
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF p_verdict NOT IN ('agree', 'disagree') THEN RAISE EXCEPTION 'Choose agree or disagree'; END IF;
  IF p_verdict = 'disagree' AND length(btrim(coalesce(p_note, ''))) < 10 THEN RAISE EXCEPTION 'Say why you disagree (at least 10 characters)'; END IF;
  UPDATE public.qa_reviews SET status = p_verdict, note = NULLIF(btrim(coalesce(p_note, '')), ''), reviewed_at = now()
   WHERE id = p_id AND reviewer_id = auth.uid() AND status = 'pending' RETURNING * INTO q;
  IF NOT FOUND THEN RAISE EXCEPTION 'That review was not found or is already done'; END IF;
  IF p_verdict = 'disagree' THEN
    PERFORM public.notify_staff('A second reviewer disagrees', 'A second reviewer disagreed with a closed decision. It is waiting in the review list.', '/admin', 2, auth.uid());
    INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
    VALUES (auth.uid(), 'moderator', 'qa_disagree', 'content_report', q.report_id::text, jsonb_build_object('original_by', q.original_by, 'note', btrim(p_note)));
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_submit_qa_review(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_submit_qa_review(uuid, text, text) TO authenticated;

-- admins: the disagreements, and how often each person's decisions are confirmed
CREATE OR REPLACE FUNCTION public.staff_qa_overview(p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can see this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF p_days NOT BETWEEN 1 AND 365 THEN RAISE EXCEPTION 'Choose between 1 and 365 days'; END IF;
  RETURN jsonb_build_object(
    'days', p_days,
    'sampled', (SELECT count(*) FROM public.qa_reviews WHERE created_at > now() - make_interval(days => p_days)),
    'pending', (SELECT count(*) FROM public.qa_reviews WHERE status = 'pending'),
    'agreed', (SELECT count(*) FROM public.qa_reviews WHERE status = 'agree' AND reviewed_at > now() - make_interval(days => p_days)),
    'disagreed', (SELECT count(*) FROM public.qa_reviews WHERE status = 'disagree' AND reviewed_at > now() - make_interval(days => p_days)),
    'by_person', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', t.name, 'reviewed', t.reviewed, 'disagreed', t.disagreed) ORDER BY t.reviewed DESC), '[]'::jsonb)
                    FROM (SELECT COALESCE(p.full_name, p.username, 'Staff member') AS name, count(*) AS reviewed, count(*) FILTER (WHERE q.status = 'disagree') AS disagreed
                            FROM public.qa_reviews q LEFT JOIN public.profiles p ON p.id = q.original_by
                           WHERE q.status <> 'pending' AND q.reviewed_at > now() - make_interval(days => p_days) GROUP BY q.original_by, p.full_name, p.username) t),
    'disagreements', (SELECT COALESCE(jsonb_agg(jsonb_build_object('report_id', d.report_id, 'note', d.note, 'original_status', d.original_status, 'reviewed_at', d.reviewed_at,
                                                                    'original_name', COALESCE(po.full_name, po.username, 'Staff member'), 'reviewer_name', COALESCE(pr.full_name, pr.username, 'Staff member'))
                                                  ORDER BY d.reviewed_at DESC), '[]'::jsonb)
                        FROM (SELECT * FROM public.qa_reviews WHERE status = 'disagree' ORDER BY reviewed_at DESC LIMIT 20) d
                        LEFT JOIN public.profiles po ON po.id = d.original_by LEFT JOIN public.profiles pr ON pr.id = d.reviewer_id));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_qa_overview(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_qa_overview(integer) TO authenticated;

COMMIT;
