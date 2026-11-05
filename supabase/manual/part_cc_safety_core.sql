-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PART CC: the safety core.
--   1. Two-step sign-in now covers the older ban and moderation functions, and approving or rejecting a queued
--      action. Nothing changes until "require two-step sign-in" is switched on in Super admin, Staff security.
--   2. Appeals for content removals and warnings, not only suspensions. A reversal needs a second admin, clears
--      the strike it caused and tells the person.
--   3. A child-safety fast lane: a new report reason that is urgent at once, hidden at once, due in 15 minutes,
--      alerts admins, cannot be dismissed by a moderator, and records when it was passed to the authorities.
--   4. A fuller outcome message to the person who reported.
-- Run after part CB. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 2. appeals for notices ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_notices ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS notice_id uuid REFERENCES public.user_notices(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_appeals_one_per_notice ON public.appeals (notice_id) WHERE notice_id IS NOT NULL;

-- a suspension appeal (as before): ignore appeals about notices when checking for one already waiting
CREATE OR REPLACE FUNCTION public.submit_appeal(p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_ban uuid;
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_message, ''))) < 20 OR length(p_message) > 2000 THEN
    RAISE EXCEPTION 'Please explain in 20 to 2000 characters why the decision should change';
  END IF;
  SELECT id INTO v_ban FROM public.user_bans WHERE user_id = v_me AND is_active ORDER BY created_at DESC LIMIT 1;
  IF v_ban IS NULL THEN
    RAISE EXCEPTION 'There is no active suspension on your account to appeal';
  END IF;
  IF EXISTS (SELECT 1 FROM public.appeals WHERE user_id = v_me AND status = 'pending' AND notice_id IS NULL) THEN
    RAISE EXCEPTION 'You already have an appeal waiting for a decision';
  END IF;
  INSERT INTO public.appeals (user_id, ban_id, message) VALUES (v_me, v_ban, btrim(p_message)) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'appeal_id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_appeal(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_appeal(text) TO authenticated;

-- appeal a removal or a warning: one appeal per notice, within 30 days
CREATE OR REPLACE FUNCTION public.submit_notice_appeal(p_notice uuid, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_n public.user_notices%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_message, ''))) < 20 OR length(p_message) > 2000 THEN
    RAISE EXCEPTION 'Please explain in 20 to 2000 characters why the decision should change';
  END IF;
  SELECT * INTO v_n FROM public.user_notices WHERE id = p_notice AND user_id = v_me;
  IF NOT FOUND THEN RAISE EXCEPTION 'That decision was not found'; END IF;
  IF v_n.kind NOT IN ('content_removed', 'warning') THEN
    RAISE EXCEPTION 'Suspensions are appealed from the suspension page';
  END IF;
  IF v_n.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'This decision was already reversed'; END IF;
  IF v_n.created_at < now() - interval '30 days' THEN
    RAISE EXCEPTION 'The 30 days to appeal this decision have passed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.appeals WHERE notice_id = p_notice) THEN
    RAISE EXCEPTION 'You have already appealed this decision';
  END IF;
  INSERT INTO public.appeals (user_id, notice_id, message) VALUES (v_me, p_notice, btrim(p_message)) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'appeal_id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_notice_appeal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_notice_appeal(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.appeals_notify_staff()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.notify_staff('New appeal',
    CASE WHEN NEW.notice_id IS NULL THEN 'Someone appealed their suspension.' ELSE 'Someone appealed a removal or warning.' END,
    '/admin', 2);
  RETURN NULL;
END;
$$;

-- reversing: a suspension appeal lifts the ban (as before); a notice appeal clears the strike it caused
CREATE OR REPLACE FUNCTION public.gov_queue_execute_appeals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid;
  v_notice uuid;
  v_n public.user_notices%ROWTYPE;
BEGIN
  IF NEW.action <> 'appeal.reverse' OR OLD.status <> 'pending' OR NEW.status <> 'approved' THEN
    RETURN NULL;
  END IF;
  IF public.staff_rank(NEW.checker_id) < 2 THEN RAISE EXCEPTION 'Only an admin can approve an appeal'; END IF;
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.appeals SET status = 'reversed', decided_by = NEW.checker_id, decided_at = now(), decision_note = NEW.reason
   WHERE id = NEW.target_id::uuid AND status = 'pending' RETURNING user_id, notice_id INTO v_user, v_notice;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Appeal not found or already decided'; END IF;

  IF v_notice IS NULL THEN
    UPDATE public.user_bans SET is_active = false, lifted_at = now(), lifted_by = NEW.checker_id WHERE user_id = v_user AND is_active;
    UPDATE public.profiles SET is_banned = false WHERE id = v_user;
    PERFORM public.send_governance_notification(v_user, 'governance', 'Your appeal was successful. Your account access has been restored.');
  ELSE
    UPDATE public.user_notices SET reversed_at = now() WHERE id = v_notice RETURNING * INTO v_n;
    IF v_n.report_id IS NOT NULL THEN
      UPDATE public.user_strikes
         SET revoked_at = now(), revoked_by = NEW.checker_id, revoke_note = 'Appeal accepted'
       WHERE user_id = v_user AND report_id = v_n.report_id AND revoked_at IS NULL;
    END IF;
    PERFORM public.send_governance_notification(v_user, 'governance',
      CASE WHEN v_n.kind = 'content_removed'
           THEN 'Your appeal was accepted. We should not have removed that item and it is no longer held against you. You can post it again if you wish.'
           ELSE 'Your appeal was accepted. The warning has been withdrawn and no longer counts against you.' END);
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (NEW.checker_id, 'admin', 'appeal_reversed', 'user', v_user::text,
          jsonb_build_object('appeal_id', NEW.target_id, 'notice_id', v_notice, 'note', NEW.reason,
                             'maker_id', NEW.maker_id, 'checker_id', NEW.checker_id));
  RETURN NULL;
END;
$$;

-- the standing page: each notice says whether it can be appealed and where an appeal stands
CREATE OR REPLACE FUNCTION public.get_my_account_standing()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'is_banned', COALESCE(p.is_banned, false),
      'ban', (SELECT jsonb_build_object('reason', b.reason, 'ban_type', b.ban_type, 'expires_at', b.expires_at, 'since', b.created_at)
                FROM public.user_bans b WHERE b.user_id = v_me AND b.is_active ORDER BY b.created_at DESC LIMIT 1),
      'muted_until', CASE WHEN p.mute_expires_at > now() THEN p.mute_expires_at END,
      'strikes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('reason', s.reason, 'created_at', s.created_at, 'expires_at', s.expires_at)
                                            ORDER BY s.created_at DESC), '[]'::jsonb)
                    FROM public.user_strikes s WHERE s.user_id = v_me AND s.revoked_at IS NULL AND s.expires_at > now()),
      'notices', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                         'id', n.id, 'kind', n.kind, 'reason', n.reason, 'item', n.item_excerpt, 'created_at', n.created_at,
                         'reversed', n.reversed_at IS NOT NULL,
                         'appeal_status', (SELECT a.status FROM public.appeals a WHERE a.notice_id = n.id),
                         'can_appeal', n.kind IN ('content_removed', 'warning') AND n.reversed_at IS NULL
                                       AND n.created_at > now() - interval '30 days'
                                       AND NOT EXISTS (SELECT 1 FROM public.appeals a WHERE a.notice_id = n.id))
                       ORDER BY n.created_at DESC), '[]'::jsonb)
                    FROM (SELECT * FROM public.user_notices WHERE user_id = v_me ORDER BY created_at DESC LIMIT 20) n),
      'appeal', (SELECT jsonb_build_object('status', a.status, 'created_at', a.created_at, 'decision_note', a.decision_note)
                   FROM public.appeals a WHERE a.user_id = v_me AND a.notice_id IS NULL ORDER BY a.created_at DESC LIMIT 1),
      'can_appeal', COALESCE(p.is_banned, false)
                    AND NOT EXISTS (SELECT 1 FROM public.appeals a WHERE a.user_id = v_me AND a.status = 'pending' AND a.notice_id IS NULL)
    ) FROM public.profiles p WHERE p.id = v_me
  );
END;
$$;

-- ── 3. the child-safety fast lane ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_reason_check;
  ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_reason_check CHECK (reason = ANY (ARRAY[
    'spam', 'harassment', 'hate_speech', 'misinformation', 'explicit_content', 'impersonation', 'fraud', 'other', 'child_safety']));
END $$;

ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS fast_lane boolean NOT NULL DEFAULT false;
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS authority_reported_at timestamptz;
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS authority_reported_by uuid;
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS authority_ref text;

-- same as before, plus: a child-safety report is urgent, hidden at once and due in 15 minutes whatever else applies
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

  SELECT count(*)::int + 1 INTO v_open FROM public.content_reports
   WHERE target_type = NEW.target_type AND target_id = NEW.target_id AND status IN ('pending', 'reviewing');
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

-- admins are told the moment one arrives
CREATE OR REPLACE FUNCTION public.alert_fast_lane_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.notify_staff('Child-safety report', 'A child-safety report needs an admin now. It is already hidden from others where possible.', '/moderation', 2);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_alert_fast_lane_report ON public.content_reports;
CREATE TRIGGER trg_alert_fast_lane_report AFTER INSERT ON public.content_reports
  FOR EACH ROW WHEN (NEW.fast_lane) EXECUTE FUNCTION public.alert_fast_lane_report();

-- a moderator cannot dismiss one: only an admin can say it is not a problem
CREATE OR REPLACE FUNCTION public.guard_fast_lane_dismiss()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.fast_lane AND NEW.status = 'dismissed' AND OLD.status IS DISTINCT FROM 'dismissed'
     AND auth.uid() IS NOT NULL AND public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'A child-safety report can only be dismissed by an admin' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_fast_lane_dismiss ON public.content_reports;
CREATE TRIGGER trg_guard_fast_lane_dismiss BEFORE UPDATE OF status ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.guard_fast_lane_dismiss();

-- overdue alerts: a fast-lane report that is overdue also goes to admins
CREATE OR REPLACE FUNCTION public.alert_overdue_reports()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_count integer;
  v_fast integer;
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
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.alert_overdue_reports() FROM PUBLIC, anon, authenticated;

-- record that a report was passed to the authorities (who, when, their reference). Admins only.
CREATE OR REPLACE FUNCTION public.staff_record_authority_report(p_report uuid, p_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can record this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  IF length(btrim(coalesce(p_ref, ''))) < 3 THEN RAISE EXCEPTION 'Please enter the reference you were given (at least 3 characters)'; END IF;
  UPDATE public.content_reports
     SET authority_reported_at = now(), authority_reported_by = auth.uid(), authority_ref = btrim(p_ref)
   WHERE id = p_report;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'report_passed_to_authorities', 'content_report', p_report::text, jsonb_build_object('ref', btrim(p_ref)));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_record_authority_report(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_record_authority_report(uuid, text) TO authenticated;

-- the same function as before, plus one line that records which action closed the report
CREATE OR REPLACE FUNCTION public._apply_report_action(
  p_report_id uuid, p_action text, p_note text, p_maker uuid, p_checker uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_report public.content_reports%ROWTYPE;
  v_author uuid;
  v_tid uuid;
  v_deleted integer := 0;
BEGIN
  SELECT * INTO v_report FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  BEGIN
    v_tid := v_report.target_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_tid := NULL;
  END;

  IF v_tid IS NOT NULL THEN
    v_author := CASE v_report.target_type
      WHEN 'user'    THEN v_tid
      WHEN 'post'    THEN (SELECT author_id FROM public.posts WHERE id = v_tid)
      WHEN 'comment' THEN (SELECT user_id FROM public.post_comments WHERE id = v_tid)
      WHEN 'job'     THEN (SELECT posted_by FROM public.jobs WHERE id = v_tid)
      WHEN 'listing' THEN (SELECT user_id FROM public.marketplace_listings WHERE id = v_tid)
      WHEN 'room'    THEN (SELECT creator_id FROM public.discussion_rooms WHERE id = v_tid)
      ELSE NULL
    END;
  END IF;

  IF p_action = 'takedown' THEN
    IF v_tid IS NULL OR v_report.target_type NOT IN ('post', 'comment', 'job', 'listing', 'room') THEN
      RAISE EXCEPTION 'Cannot take down target type % (use user management for accounts; messages are encrypted)', v_report.target_type;
    END IF;
    IF v_report.target_type = 'post' THEN DELETE FROM public.posts WHERE id = v_tid;
    ELSIF v_report.target_type = 'comment' THEN DELETE FROM public.post_comments WHERE id = v_tid;
    ELSIF v_report.target_type = 'job' THEN DELETE FROM public.jobs WHERE id = v_tid;
    ELSIF v_report.target_type = 'listing' THEN DELETE FROM public.marketplace_listings WHERE id = v_tid;
    ELSIF v_report.target_type = 'room' THEN DELETE FROM public.discussion_rooms WHERE id = v_tid;
    END IF;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted = 0 THEN
      RAISE EXCEPTION 'Content no longer exists';
    END IF;
    IF v_author IS NOT NULL THEN
      PERFORM public.send_governance_notification(v_author, 'content_removed', p_note);
    END IF;
  ELSIF p_action = 'shadowban' THEN
    IF v_author IS NULL THEN
      RAISE EXCEPTION 'Could not determine the author of this content';
    END IF;
    UPDATE public.profiles SET is_shadowbanned = true, shadow_banned_at = now() WHERE id = v_author;
  ELSIF p_action = 'warn' THEN
    IF v_author IS NULL THEN
      RAISE EXCEPTION 'Could not determine the author of this content';
    END IF;
    PERFORM public.send_governance_notification(v_author, 'warn', COALESCE(NULLIF(btrim(p_note), ''), v_report.reason));
  ELSIF p_action = 'ban' THEN
    IF v_author IS NULL THEN
      RAISE EXCEPTION 'Could not determine the author of this content';
    END IF;
    PERFORM public._apply_user_ban(v_author, COALESCE(NULLIF(btrim(p_note), ''), 'Reported: ' || v_report.reason),
                                   'permanent', NULL, p_maker, p_checker);
  ELSIF p_action <> 'dismiss' THEN
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  -- lets the trigger that tells the reporter say what was done
  PERFORM set_config('app.report_action', p_action, true);
  UPDATE public.content_reports
     SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'resolved' END,
         reviewed_by = COALESCE(p_checker, p_maker),
         reviewed_at = now(),
         resolution_note = COALESCE(p_note, p_action)
   WHERE id = p_report_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (COALESCE(p_checker, p_maker), 'moderator', 'report_' || p_action, v_report.target_type, v_report.target_id,
          jsonb_build_object('report_id', p_report_id, 'author_id', v_author, 'note', p_note,
                             'maker_id', p_maker, 'checker_id', p_checker));

  RETURN jsonb_build_object('success', true, 'action', p_action, 'author_id', v_author);
END;
$$;
REVOKE ALL ON FUNCTION public._apply_report_action(uuid, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── 4. the person who reported hears what happened ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_after_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_dis integer;
  v_up integer;
  v_action text;
  v_what text;
BEGIN
  PERFORM set_config('app.market_system', '1', true);

  IF NOT EXISTS (SELECT 1 FROM public.content_reports r
                  WHERE r.target_type = NEW.target_type AND r.target_id = NEW.target_id
                    AND r.id <> NEW.id AND r.status IN ('pending', 'reviewing') AND 'hide' = ANY (r.auto_actions)) THEN
    PERFORM public._auto_show_target(NEW.target_type, NEW.target_id);
  END IF;

  -- what was done, in plain words, without saying who it was done to
  v_action := COALESCE(current_setting('app.report_action', true), '');
  v_what := CASE v_action
    WHEN 'takedown' THEN 'We removed what you reported.'
    WHEN 'warn'     THEN 'We warned the person responsible.'
    WHEN 'ban'      THEN 'We suspended the account involved.'
    WHEN 'shadowban' THEN 'We limited the reach of the account involved.'
    ELSE 'We took action.' END;

  INSERT INTO public.notifications (user_id, title, message, type, priority)
  VALUES (NEW.reported_by,
          CASE WHEN NEW.status = 'resolved' THEN 'Thanks for your report' ELSE 'We reviewed your report' END,
          'About your report (' || replace(NEW.reason, '_', ' ') || '): ' ||
          CASE WHEN NEW.status = 'resolved'
               THEN v_what || ' Thank you for helping keep CineCraft Connect safe.'
               ELSE 'We looked into it and it does not break our rules. You can always report again if something changes.' END,
          'report_outcome', 'medium');

  IF NEW.status = 'dismissed' THEN
    SELECT count(*) FILTER (WHERE status = 'dismissed')::int, count(*) FILTER (WHERE status = 'resolved')::int
      INTO v_dis, v_up FROM public.content_reports WHERE reported_by = NEW.reported_by AND status IN ('resolved', 'dismissed');
    IF v_dis >= 10 AND v_dis % 10 = 0 AND v_up::numeric / (v_up + v_dis) <= 0.2 THEN
      INSERT INTO public.notifications (user_id, title, message, type, priority)
      VALUES (NEW.reported_by, 'A reminder about reporting',
              'Most of your recent reports did not break our rules. Please report only things that do, so we can reach real problems faster.',
              'report_outcome', 'medium');
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- ── 1. two-step sign-in on approving or rejecting a queued action ───────────────────────────────
CREATE OR REPLACE FUNCTION public.gov_queue_require_mfa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IS DISTINCT FROM 'pending' AND auth.uid() IS NOT NULL AND NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_gov_queue_require_mfa ON public.gov_approval_queue;
CREATE TRIGGER trg_gov_queue_require_mfa BEFORE UPDATE OF status ON public.gov_approval_queue
  FOR EACH ROW EXECUTE FUNCTION public.gov_queue_require_mfa();

-- ── 1. two-step sign-in on the older staff functions ────────────────────────────────────────────
-- Each function keeps its name and arguments. The original body moves to _impl_<name> (closed to the app) and a thin
-- wrapper with the old name checks two-step sign-in first and then calls it. Running this again re-wraps any
-- function an earlier part has replaced, and skips the ones already wrapped.
DO $$
DECLARE
  f record;
  v_names text[] := ARRAY[
    'moderator_resolve_report', 'moderator_claim_report', 'moderator_apply_bundle', 'add_moderation_note',
    'issue_strike', 'revoke_strike', 'uphold_appeal', 'request_appeal_reversal', 'resolve_flagged_message',
    'list_flagged_messages', 'get_user_record', 'set_on_duty', 'gov_request_action', 'staff_search',
    'get_report_precedents', 'get_admin_stats', 'get_risk_distribution', 'get_my_day'];
  v_impl text;
  v_call text;
  v_arg text;
  v_i integer;
  v_body text;
  v_vol text;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname, p.proargnames, p.pronargs, p.proretset, p.prorettype, p.provolatile, p.prosrc,
           pg_get_function_identity_arguments(p.oid) AS idargs,
           pg_get_function_arguments(p.oid) AS fullargs,
           pg_get_function_result(p.oid) AS result
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = ANY (v_names)
  LOOP
    v_impl := '_impl_' || f.proname;
    IF position('public.' || v_impl || '(' IN f.prosrc) > 0 THEN
      CONTINUE; -- already a wrapper
    END IF;
    IF f.pronargs > 0 AND (f.proargnames IS NULL OR array_length(f.proargnames, 1) < f.pronargs OR '' = ANY (f.proargnames)) THEN
      RAISE NOTICE 'Skipping %: its arguments are not all named', f.proname;
      CONTINUE;
    END IF;

    -- an older copy from a previous wrap is replaced by the current original
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s)', v_impl, f.idargs);
    EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I', f.proname, f.idargs, v_impl);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', v_impl, f.idargs);

    v_call := '';
    FOR v_i IN 1 .. f.pronargs LOOP
      v_call := v_call || CASE WHEN v_i > 1 THEN ', ' ELSE '' END || format('%I', f.proargnames[v_i]);
    END LOOP;

    v_vol := CASE f.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' ELSE 'VOLATILE' END;
    IF f.proretset THEN
      v_body := format('RETURN QUERY SELECT * FROM public.%I(%s);', v_impl, v_call);
    ELSIF f.prorettype = 'void'::regtype THEN
      v_body := format('PERFORM public.%I(%s);', v_impl, v_call);
    ELSE
      v_body := format('RETURN public.%I(%s);', v_impl, v_call);
    END IF;

    EXECUTE format(
      'CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql %s SECURITY DEFINER SET search_path = public, pg_temp AS $f$ '
      || 'BEGIN IF auth.uid() IS NOT NULL AND NOT public.staff_mfa_ok() THEN '
      || 'RAISE EXCEPTION ''Two-step sign-in is required for this action'' USING ERRCODE = ''42501''; END IF; %s END; $f$',
      f.proname, f.fullargs, f.result, v_vol, v_body);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', f.proname, f.idargs);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', f.proname, f.idargs);
  END LOOP;
END $$;

COMMIT;
