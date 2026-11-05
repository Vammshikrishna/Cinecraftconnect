-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PART DJ: report abuse protection (audit findings F-6 and F-4).
--   1. A person cannot report their own content or themselves.
--   2. A person cannot file a second open report on the same thing (also enforced by a unique index).
--   3. One account can file at most 20 reports per hour.
--   4. "How many people reported this" now counts DISTINCT reporters, not report rows. The priority steps
--      (3 = high, 5 = urgent) and the admin rules ("Hide at 5 reports") therefore cannot be triggered by one account.
--   5. staff_escalate_report(): the moderator "Escalate to Admin" button now calls this function, because part CZ
--      revoked direct UPDATE on content_reports.
-- Everything else in report_prepare stays exactly as in part CC (snapshot, reporter reliability, rules, child-safety fast lane).
-- Run after part CC, part CK (a_cj_reset_report_flags) and part CZ. Safe to run more than once.
--
-- ── PREFLIGHT (read only: run these first in the SQL editor; they change nothing) ───────────────
--   -- a) the pieces this part builds on must exist (expect 5 rows)
--   select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and proname in ('report_prepare', '_report_target_author', '_apply_rules', 'staff_rank', 'notify_staff');
--   -- b) the triggers on content_reports and their order (expect a_cj_reset_report_flags before trg_report_prepare)
--   select tgname from pg_trigger where tgrelid = 'public.content_reports'::regclass and not tgisinternal order by tgname;
--   -- c) open duplicates that would block the unique index (0 rows is ideal; otherwise the index is skipped with a NOTICE)
--   select reported_by, target_type, target_id, count(*) from public.content_reports
--    where reported_by is not null and coalesce(source, 'user') = 'user' and status in ('pending', 'reviewing')
--    group by 1, 2, 3 having count(*) > 1;
--   -- d) reports people filed about themselves or their own post/comment/job/listing/room (history only, not changed)
--   select r.id, r.target_type, r.created_at from public.content_reports r
--    where r.reported_by is not null and public._report_target_author(r.target_type, r.target_id) = r.reported_by;
--   -- e) accounts that already filed more than 20 reports within one hour (they would have been refused)
--   select reported_by, date_trunc('hour', created_at) as hour, count(*) from public.content_reports
--    where reported_by is not null group by 1, 2 having count(*) > 20 order by 3 desc;
--   -- f) targets that look hidden or urgent only because of repeat reports by one account
--   select target_type, target_id, count(*) as rows, count(distinct reported_by) as people from public.content_reports
--    where status in ('pending', 'reviewing') group by 1, 2 having count(*) >= 3 and count(distinct reported_by) < 3;
-- ════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1-3. the guard that runs before a report is saved ───────────────────────────────────────────
-- Reports made by the system (automatic cases, source <> 'user', no signed-in user) are left alone.
-- The name starts with "b_" so it runs after a_cj_reset_report_flags and before trg_report_prepare.
CREATE OR REPLACE FUNCTION public.dj_report_abuse_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_author uuid;
  v_recent integer;
  c_hourly_limit CONSTANT integer := 20;
BEGIN
  IF NEW.reported_by IS NULL OR auth.uid() IS NULL OR COALESCE(NEW.source, 'user') <> 'user' THEN
    RETURN NEW;
  END IF;

  -- not yourself, not your own content
  v_author := public._report_target_author(NEW.target_type, NEW.target_id);
  IF v_author IS NOT NULL AND v_author = NEW.reported_by THEN
    RAISE EXCEPTION 'You cannot report your own content or your own account' USING ERRCODE = 'P0001';
  END IF;

  -- not twice while the first report is still open
  IF EXISTS (SELECT 1 FROM public.content_reports r
              WHERE r.reported_by = NEW.reported_by AND r.target_type = NEW.target_type AND r.target_id = NEW.target_id
                AND r.status IN ('pending', 'reviewing') AND COALESCE(r.source, 'user') = 'user') THEN
    RAISE EXCEPTION 'You already reported this. Our team is looking at it.' USING ERRCODE = 'P0001';
  END IF;

  -- not a flood
  SELECT count(*)::int INTO v_recent FROM public.content_reports r
   WHERE r.reported_by = NEW.reported_by AND r.created_at > now() - interval '1 hour';
  IF v_recent >= c_hourly_limit THEN
    RAISE EXCEPTION 'You have sent a lot of reports in the last hour. Please try again later.' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.dj_report_abuse_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS b_dj_report_abuse_guard ON public.content_reports;
CREATE TRIGGER b_dj_report_abuse_guard BEFORE INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.dj_report_abuse_guard();

-- belt and braces for two reports sent at the same instant: one open report per person per thing.
-- Skipped (with a notice) if old duplicates exist; the trigger above still blocks new ones.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_content_reports_one_open_per_reporter
    ON public.content_reports (reported_by, target_type, target_id)
    WHERE reported_by IS NOT NULL AND status IN ('pending', 'reviewing') AND source = 'user';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Open duplicate reports exist: unique index skipped. Close them and run this part again.';
END $$;

-- ── 4. distinct reporters, not report rows ──────────────────────────────────────────────────────
-- Identical to part CC except for the count of open reports on the same target: each person counts once, and all
-- automatic (system) cases together count as one source.
CREATE OR REPLACE FUNCTION public.report_prepare()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_open integer;
  v_up integer;
  v_dis integer;
  v_rule record;
  v_author uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      NEW.due_at := LEAST(COALESCE(OLD.due_at, 'infinity'::timestamptz), now() + public.report_due_interval(NEW.priority));
    END IF;
    RETURN NEW;
  END IF;

  NEW.evidence := public._report_snapshot(NEW.target_type, NEW.target_id);
  v_author := public._report_target_author(NEW.target_type, NEW.target_id);

  SELECT count(*) FILTER (WHERE status = 'resolved')::int, count(*) FILTER (WHERE status = 'dismissed')::int
    INTO v_up, v_dis FROM public.content_reports WHERE reported_by = NEW.reported_by AND status IN ('resolved', 'dismissed');
  IF v_up + v_dis >= 5 AND v_up::numeric / (v_up + v_dis) >= 0.8 AND public.report_priority_rank(NEW.priority) < 3 THEN
    NEW.priority := CASE WHEN NEW.priority = 'low' THEN 'medium' ELSE 'high' END;
    NEW.auto_actions := NEW.auto_actions || 'trusted_reporter';
  ELSIF v_dis >= 8 AND v_up::numeric / GREATEST(v_up + v_dis, 1) <= 0.1 THEN
    NEW.priority := 'low';
    NEW.auto_actions := NEW.auto_actions || 'low_reliability';
  END IF;

  -- how many DIFFERENT people (this report included) have an open report on the same thing
  SELECT count(*)::int INTO v_open FROM (
    SELECT COALESCE(r.reported_by::text, 'system') AS k FROM public.content_reports r
     WHERE r.target_type = NEW.target_type AND r.target_id = NEW.target_id AND r.status IN ('pending', 'reviewing')
    UNION
    SELECT COALESCE(NEW.reported_by::text, 'system')
  ) people;
  IF v_open >= 5 AND public.report_priority_rank(NEW.priority) < 4 THEN
    NEW.priority := 'urgent';
  ELSIF v_open >= 3 AND public.report_priority_rank(NEW.priority) < 3 THEN
    NEW.priority := 'high';
  END IF;

  SELECT * INTO v_rule FROM public._apply_rules(NEW.target_type, NEW.reason, v_open, NEW.evidence, v_author);
  IF v_rule.o_priority IS NOT NULL AND public.report_priority_rank(v_rule.o_priority) > public.report_priority_rank(NEW.priority) THEN
    NEW.priority := v_rule.o_priority;
  END IF;
  IF v_rule.o_hide THEN NEW.auto_actions := NEW.auto_actions || 'hide'; END IF;
  IF array_length(v_rule.o_names, 1) > 0 THEN NEW.auto_actions := NEW.auto_actions || ('rule:' || array_to_string(v_rule.o_names, ', ')); END IF;

  NEW.due_at := now() + public.report_due_interval(NEW.priority);

  -- the fast lane overrides everything above, including a low-reliability reporter
  IF NEW.reason = 'child_safety' THEN
    NEW.fast_lane := true;
    NEW.priority := 'urgent';
    NEW.status := 'pending';
    IF NOT ('hide' = ANY (NEW.auto_actions)) THEN NEW.auto_actions := NEW.auto_actions || 'hide'; END IF;
    NEW.auto_actions := array_remove(NEW.auto_actions, 'low_reliability') || 'child_safety';
    NEW.due_at := now() + interval '15 minutes';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 5. "Escalate to Admin" for moderators ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_escalate_report(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_status text;
  v_priority text;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501';
  END IF;

  SELECT status, priority INTO v_status, v_priority FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;
  IF v_status NOT IN ('pending', 'reviewing') THEN RAISE EXCEPTION 'This report has already been closed'; END IF;
  IF v_priority = 'urgent' THEN
    RETURN jsonb_build_object('success', true, 'already_urgent', true);
  END IF;

  -- report_prepare moves the deadline forward only (never later); the urgent-report alert trigger tells staff
  UPDATE public.content_reports SET priority = 'urgent' WHERE id = p_report_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'moderator', 'report_escalate', 'content_report', p_report_id::text,
          jsonb_build_object('from_priority', v_priority, 'to_priority', 'urgent'));

  PERFORM public.notify_staff('Case escalated', 'A moderator escalated a case to urgent. It needs an admin.', '/moderation', 2, auth.uid());
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_escalate_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_escalate_report(uuid) TO authenticated;

COMMIT;

-- ── Not covered here (see the audit notes) ──────────────────────────────────────────────────────
--   * "own content" is only known for user, post, comment, job, listing and room reports (the author lookup in part BM).
--     Announcements, reviews, cinema entries and pitch items are not checked.
--   * Chat-message flags (flagged_messages) have no per-hour limit yet.
--   * Several fake accounts can still report together; the distinct-reporter count stops one account, not a group.
