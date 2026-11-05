-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PART CE: trust and safety analytics, and the transparency report.
--   * staff_safety_stats(days): for admins. Reports by reason and type, how fast they were handled and how many met
--     their target, what was done, appeals, fast-lane reports, a daily chart and each moderator's workload.
--   * transparency_reports: a super admin makes a draft for a period (numbers only, small counts shown as "<5"),
--     adds a short summary, and a DIFFERENT super admin publishes it (when there is more than one). Published reports
--     are public, drafts are not. A published report is never edited; a correction is a new report.
-- Run after part CD (the marketplace dispute figures appear once part CF is installed). Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE OR REPLACE FUNCTION public._n(p_count bigint, p_suppress boolean)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_suppress AND p_count > 0 AND p_count < 5 THEN to_jsonb('<5'::text) ELSE to_jsonb(p_count) END;
$$;
REVOKE ALL ON FUNCTION public._n(bigint, boolean) FROM PUBLIC, anon, authenticated;

-- the numbers, for any period. With p_suppress, a count of 1 to 4 is shown as "<5" so nobody can be picked out.
CREATE OR REPLACE FUNCTION public._safety_numbers(p_from timestamptz, p_to timestamptz, p_suppress boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_reports jsonb;
  v_actions jsonb;
  v_response jsonb;
  v_appeals jsonb;
  v_disputes jsonb := NULL;
  v_msg jsonb;
BEGIN
  SELECT jsonb_build_object(
    'received', public._n(count(*) FILTER (WHERE created_at >= p_from AND created_at < p_to), p_suppress),
    'closed', public._n(count(*) FILTER (WHERE status IN ('resolved', 'dismissed') AND reviewed_at >= p_from AND reviewed_at < p_to), p_suppress),
    'upheld', public._n(count(*) FILTER (WHERE status = 'resolved' AND reviewed_at >= p_from AND reviewed_at < p_to), p_suppress),
    'dismissed', public._n(count(*) FILTER (WHERE status = 'dismissed' AND reviewed_at >= p_from AND reviewed_at < p_to), p_suppress),
    'still_open', public._n(count(*) FILTER (WHERE status IN ('pending', 'reviewing')), p_suppress),
    'child_safety', public._n(count(*) FILTER (WHERE fast_lane AND created_at >= p_from AND created_at < p_to), p_suppress),
    'child_safety_passed_on', public._n(count(*) FILTER (WHERE authority_reported_at >= p_from AND authority_reported_at < p_to), p_suppress),
    'hidden_while_reviewed', public._n(count(*) FILTER (WHERE 'hide' = ANY (auto_actions) AND created_at >= p_from AND created_at < p_to), p_suppress),
    'flagged_by_rules', public._n(count(*) FILTER (WHERE created_at >= p_from AND created_at < p_to
                                                    AND EXISTS (SELECT 1 FROM unnest(auto_actions) x WHERE x LIKE 'rule:%')), p_suppress),
    'by_reason', COALESCE((SELECT jsonb_object_agg(reason, public._n(c, p_suppress))
                             FROM (SELECT reason, count(*) AS c FROM public.content_reports WHERE created_at >= p_from AND created_at < p_to GROUP BY reason) q), '{}'::jsonb),
    'by_type', COALESCE((SELECT jsonb_object_agg(target_type, public._n(c, p_suppress))
                           FROM (SELECT target_type, count(*) AS c FROM public.content_reports WHERE created_at >= p_from AND created_at < p_to GROUP BY target_type) q), '{}'::jsonb))
    INTO v_reports
    FROM public.content_reports;

  -- child-safety reports about chat messages (part CI), when that part is installed
  IF to_regprocedure('public._fast_lane_message_counts(timestamptz,timestamptz)') IS NOT NULL THEN
    EXECUTE 'SELECT public._fast_lane_message_counts($1, $2)' INTO v_msg USING p_from, p_to;
    v_reports := v_reports || jsonb_build_object(
      'child_safety_messages', public._n(COALESCE((v_msg ->> 'received')::bigint, 0), p_suppress),
      'child_safety_messages_passed_on', public._n(COALESCE((v_msg ->> 'passed_on')::bigint, 0), p_suppress));
  END IF;

  SELECT jsonb_build_object(
    'content_removed', public._n(count(*) FILTER (WHERE action = 'report_takedown'), p_suppress),
    'warnings', public._n(count(*) FILTER (WHERE action = 'report_warn'), p_suppress),
    'reach_limited', public._n(count(*) FILTER (WHERE action = 'report_shadowban'), p_suppress),
    'accounts_suspended', public._n((SELECT count(*) FROM public.user_bans WHERE created_at >= p_from AND created_at < p_to), p_suppress),
    'strikes_issued', public._n((SELECT count(*) FROM public.user_strikes WHERE created_at >= p_from AND created_at < p_to), p_suppress))
    INTO v_actions
    FROM public.audit_logs WHERE created_at >= p_from AND created_at < p_to;

  SELECT jsonb_build_object(
    'median_hours', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM reviewed_at - created_at) / 3600))::numeric, 1),
    'p90_hours', round((percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM reviewed_at - created_at) / 3600))::numeric, 1),
    'within_target_pct', round(100.0 * count(*) FILTER (WHERE due_at IS NOT NULL AND reviewed_at <= due_at) / NULLIF(count(*) FILTER (WHERE due_at IS NOT NULL), 0)))
    INTO v_response
    FROM public.content_reports
   WHERE status IN ('resolved', 'dismissed') AND reviewed_at >= p_from AND reviewed_at < p_to AND reviewed_at >= created_at;

  SELECT jsonb_build_object(
    'filed', public._n(count(*), p_suppress),
    'reversed', public._n(count(*) FILTER (WHERE status = 'reversed'), p_suppress),
    'upheld', public._n(count(*) FILTER (WHERE status = 'upheld'), p_suppress),
    'pending', public._n(count(*) FILTER (WHERE status = 'pending'), p_suppress),
    'of_removals_or_warnings', public._n(count(*) FILTER (WHERE notice_id IS NOT NULL), p_suppress),
    'of_suspensions', public._n(count(*) FILTER (WHERE notice_id IS NULL), p_suppress))
    INTO v_appeals
    FROM public.appeals WHERE created_at >= p_from AND created_at < p_to;

  IF to_regclass('public.marketplace_disputes') IS NOT NULL THEN
    EXECUTE $q$
      SELECT jsonb_build_object(
        'opened', public._n(count(*), $3),
        'resolved', public._n(count(*) FILTER (WHERE status = 'resolved'), $3),
        'withdrawn', public._n(count(*) FILTER (WHERE status = 'withdrawn'), $3),
        'still_open', public._n(count(*) FILTER (WHERE status NOT IN ('resolved', 'withdrawn')), $3),
        'in_favour_of_the_person_who_opened_it', public._n(count(*) FILTER (WHERE outcome = 'favor_opener'), $3),
        'in_favour_of_the_other_side', public._n(count(*) FILTER (WHERE outcome = 'favor_other'), $3),
        'split_or_no_fault', public._n(count(*) FILTER (WHERE outcome IN ('split', 'no_fault')), $3))
      FROM public.marketplace_disputes WHERE created_at >= $1 AND created_at < $2
    $q$ INTO v_disputes USING p_from, p_to, p_suppress;
  END IF;

  RETURN jsonb_build_object('reports', v_reports, 'actions', v_actions, 'response', COALESCE(v_response, '{}'::jsonb),
                            'appeals', v_appeals, 'marketplace_disputes', v_disputes);
END;
$$;
REVOKE ALL ON FUNCTION public._safety_numbers(timestamptz, timestamptz, boolean) FROM PUBLIC, anon, authenticated;

-- ── for admins ──────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_safety_stats(p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_from timestamptz;
  v_to timestamptz := now();
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can see this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF p_days NOT BETWEEN 1 AND 365 THEN RAISE EXCEPTION 'Choose between 1 and 365 days'; END IF;
  v_from := v_to - make_interval(days => p_days);
  RETURN public._safety_numbers(v_from, v_to, false) || jsonb_build_object(
    'days', p_days,
    'overdue_now', (SELECT count(*) FROM public.content_reports WHERE status IN ('pending', 'reviewing') AND due_at < now()),
    'series', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day, 'opened', COALESCE(o.c, 0), 'closed', COALESCE(c.c, 0)) ORDER BY d.day), '[]'::jsonb)
                 FROM (SELECT generate_series(date_trunc('day', v_from)::date, v_to::date, interval '1 day')::date AS day) d
                 LEFT JOIN (SELECT created_at::date AS day, count(*) AS c FROM public.content_reports WHERE created_at >= v_from GROUP BY 1) o ON o.day = d.day
                 LEFT JOIN (SELECT reviewed_at::date AS day, count(*) AS c FROM public.content_reports WHERE reviewed_at >= v_from AND status IN ('resolved', 'dismissed') GROUP BY 1) c ON c.day = d.day),
    'staff', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', s.name, 'rank', s.rank, 'closed', s.closed, 'dismissed', s.dismissed, 'median_hours', s.median_hours) ORDER BY s.closed DESC), '[]'::jsonb)
                FROM (SELECT COALESCE(p.full_name, p.username, 'Staff member') AS name, public.staff_rank(c.reviewed_by) AS rank,
                             count(*) AS closed, count(*) FILTER (WHERE c.status = 'dismissed') AS dismissed,
                             round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM c.reviewed_at - c.created_at) / 3600))::numeric, 1) AS median_hours
                        FROM public.content_reports c LEFT JOIN public.profiles p ON p.id = c.reviewed_by
                       WHERE c.reviewed_at >= v_from AND c.reviewed_by IS NOT NULL AND c.status IN ('resolved', 'dismissed')
                       GROUP BY c.reviewed_by, p.full_name, p.username ORDER BY count(*) DESC LIMIT 15) s));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_safety_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_safety_stats(integer) TO authenticated;

-- ── the transparency report ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transparency_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end   date NOT NULL CHECK (period_end >= period_start),
  title        text NOT NULL,
  summary      text NOT NULL DEFAULT '',
  data         jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  published_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_transparency_status ON public.transparency_reports (status, period_end DESC);
ALTER TABLE public.transparency_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transparency_public_read ON public.transparency_reports;
CREATE POLICY transparency_public_read ON public.transparency_reports FOR SELECT
  USING (status = 'published' OR public.staff_rank(auth.uid()) >= 3);
GRANT SELECT ON public.transparency_reports TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.transparency_reports FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_create_transparency_draft(p_start date, p_end date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
  v_data jsonb;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only super admins can do this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN RAISE EXCEPTION 'Choose a start and an end date'; END IF;
  IF p_end >= current_date THEN RAISE EXCEPTION 'The period must have ended (choose an end date before today)'; END IF;
  IF p_end - p_start > 366 THEN RAISE EXCEPTION 'A report covers at most one year'; END IF;
  IF EXISTS (SELECT 1 FROM public.transparency_reports WHERE status = 'published' AND period_start <= p_end AND period_end >= p_start) THEN
    RAISE EXCEPTION 'A published report already covers part of that period';
  END IF;

  v_data := public._safety_numbers(p_start::timestamptz, (p_end + 1)::timestamptz, true)
            || jsonb_build_object('period', jsonb_build_object('start', p_start, 'end', p_end));

  -- one draft per period: making it again replaces the numbers and keeps the wording
  SELECT id INTO v_id FROM public.transparency_reports WHERE status = 'draft' AND period_start = p_start AND period_end = p_end;
  IF v_id IS NOT NULL THEN
    UPDATE public.transparency_reports SET data = v_data, created_by = auth.uid(), created_at = now() WHERE id = v_id;
  ELSE
    INSERT INTO public.transparency_reports (period_start, period_end, title, data, created_by)
    VALUES (p_start, p_end, 'Transparency report: ' || to_char(p_start, 'DD Mon YYYY') || ' to ' || to_char(p_end, 'DD Mon YYYY'), v_data, auth.uid())
    RETURNING id INTO v_id;
  END IF;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (auth.uid(), 'super_admin', 'transparency_draft', 'transparency_report', v_id::text);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_create_transparency_draft(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_create_transparency_draft(date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_edit_transparency_draft(p_id uuid, p_title text, p_summary text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only super admins can do this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_title, ''))) < 5 OR length(p_title) > 160 THEN RAISE EXCEPTION 'Give the report a title of 5 to 160 characters'; END IF;
  IF length(coalesce(p_summary, '')) > 5000 THEN RAISE EXCEPTION 'Keep the summary under 5000 characters'; END IF;
  UPDATE public.transparency_reports SET title = btrim(p_title), summary = btrim(coalesce(p_summary, '')) WHERE id = p_id AND status = 'draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a draft can be edited'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_edit_transparency_draft(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_edit_transparency_draft(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_delete_transparency_draft(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only super admins can do this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.transparency_reports WHERE id = p_id AND status = 'draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a draft can be deleted'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_delete_transparency_draft(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_delete_transparency_draft(uuid) TO authenticated;

-- publishing is public, so a second super admin must do it (when there is more than one)
CREATE OR REPLACE FUNCTION public.staff_publish_transparency_report(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_r public.transparency_reports%ROWTYPE;
  v_supers integer;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only super admins can do this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_r FROM public.transparency_reports WHERE id = p_id AND status = 'draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a draft can be published'; END IF;
  IF length(btrim(v_r.summary)) < 20 THEN RAISE EXCEPTION 'Write a short summary (at least 20 characters) before publishing'; END IF;
  SELECT count(*) INTO v_supers FROM public.user_roles WHERE role::text = 'super_admin';
  IF v_supers > 1 AND v_r.created_by = auth.uid() THEN
    RAISE EXCEPTION 'A different super admin must publish this report';
  END IF;
  IF EXISTS (SELECT 1 FROM public.transparency_reports WHERE status = 'published' AND period_start <= v_r.period_end AND period_end >= v_r.period_start) THEN
    RAISE EXCEPTION 'A published report already covers part of that period';
  END IF;
  UPDATE public.transparency_reports SET status = 'published', published_by = auth.uid(), published_at = now() WHERE id = p_id;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin', 'transparency_published', 'transparency_report', p_id::text, jsonb_build_object('created_by', v_r.created_by));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_publish_transparency_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_publish_transparency_report(uuid) TO authenticated;

COMMIT;
