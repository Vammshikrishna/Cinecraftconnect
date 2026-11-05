-- PART BJ: governance features.
--   * Strikes: a warning adds a strike (kept 180 days). At 3 active strikes the person is muted for 7 days automatically;
--     staff are told at 3 and again at 5 so they can consider a suspension.
--   * Appeals: a suspended person can appeal. An admin upholds it (at once) or asks to reverse it (a second admin approves).
--   * User record: one call returns everything staff did to or about an account, for the timeline screen.
--   * Reported messages: people who report a chat message send the readable text along (messages are encrypted), but no
--     staff screen ever showed it. list_flagged_messages / resolve_flagged_message give staff that queue.
--   * Staff alerts: moderators and admins get a notification for an urgent report, a new reported message, a new appeal
--     and an approval waiting for them.
--   * Moderation notes can be saved again (the screen wrote a column that is not there on some databases).
-- Run after part BI. Safe to run twice.
BEGIN;

-- ── staff alerts ────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_staff(p_title text, p_message text, p_url text, p_min_rank integer DEFAULT 1, p_exclude uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, priority, action_url)
  SELECT DISTINCT r.user_id, p_title, p_message, 'staff_alert', 'high', p_url
    FROM public.user_roles r
   WHERE public.staff_rank(r.user_id) >= p_min_rank
     AND (p_exclude IS NULL OR r.user_id <> p_exclude);
END;
$$;
REVOKE ALL ON FUNCTION public.notify_staff(text, text, text, integer, uuid) FROM PUBLIC, anon, authenticated;

-- ── strikes ─────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_strikes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issued_by   uuid,
  reason      text NOT NULL,
  report_id   uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '180 days'),
  revoked_at  timestamptz,
  revoked_by  uuid,
  revoke_note text
);
CREATE INDEX IF NOT EXISTS idx_user_strikes_user ON public.user_strikes (user_id, created_at DESC);
ALTER TABLE public.user_strikes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_strikes_read ON public.user_strikes;
CREATE POLICY user_strikes_read ON public.user_strikes FOR SELECT
  USING (user_id = auth.uid() OR public.staff_rank(auth.uid()) >= 1);

CREATE OR REPLACE FUNCTION public._add_strike(p_user uuid, p_reason text, p_report uuid, p_by uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_count integer;
  v_name text;
BEGIN
  INSERT INTO public.user_strikes (user_id, issued_by, reason, report_id) VALUES (p_user, p_by, p_reason, p_report);
  SELECT count(*)::int INTO v_count FROM public.user_strikes
   WHERE user_id = p_user AND revoked_at IS NULL AND expires_at > now();
  SELECT COALESCE(username, 'user') INTO v_name FROM public.profiles WHERE id = p_user;

  IF v_count = 3 THEN
    PERFORM set_config('app.market_system', '1', true);
    UPDATE public.profiles
       SET last_muted_at = now(), mute_expires_at = now() + interval '7 days',
           restriction_flags = array_append(COALESCE(restriction_flags, ARRAY[]::text[]), 'messaging_restricted')
     WHERE id = p_user;
    PERFORM public.send_governance_notification(p_user, 'mute', 'Three active warnings');
    INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
    VALUES (p_by, 'system', 'auto_mute_strikes', 'user', p_user::text, jsonb_build_object('strikes', v_count));
    PERFORM public.notify_staff('Strike 3 reached', '@' || v_name || ' now has 3 active strikes and was muted for 7 days.', '/admin', 2);
  ELSIF v_count >= 5 THEN
    PERFORM public.notify_staff('Consider a suspension', '@' || v_name || ' has ' || v_count || ' active strikes.', '/admin', 2);
  END IF;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public._add_strike(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.issue_strike(p_user uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_count integer;
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  IF NOT public.gov_can_act_on(p_user) THEN RAISE EXCEPTION 'You cannot give a strike to yourself or to someone of the same or a higher staff rank'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Please give a reason (at least 5 characters)'; END IF;
  v_count := public._add_strike(p_user, p_reason, NULL, auth.uid());
  PERFORM public.send_governance_notification(p_user, 'warn', p_reason);
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'staff', 'issue_strike', 'user', p_user::text, jsonb_build_object('reason', p_reason, 'active_strikes', v_count));
  RETURN jsonb_build_object('success', true, 'active_strikes', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.issue_strike(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_strike(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_strike(p_strike uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid;
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can remove a strike' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Please say why (at least 5 characters)'; END IF;
  UPDATE public.user_strikes SET revoked_at = now(), revoked_by = auth.uid(), revoke_note = p_note
   WHERE id = p_strike AND revoked_at IS NULL RETURNING user_id INTO v_user;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Strike not found or already removed'; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'revoke_strike', 'user', v_user::text, jsonb_build_object('strike_id', p_strike, 'note', p_note));
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_strike(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_strike(uuid, text) TO authenticated;

-- a warning from a report now also counts as a strike
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

-- ── appeals ─────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appeals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ban_id        uuid,
  message       text NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'upheld', 'reversed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  decided_by    uuid,
  decided_at    timestamptz,
  decision_note text
);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON public.appeals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appeals_user ON public.appeals (user_id, created_at DESC);
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS appeals_read ON public.appeals;
CREATE POLICY appeals_read ON public.appeals FOR SELECT
  USING (user_id = auth.uid() OR public.staff_rank(auth.uid()) >= 1);

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
  IF EXISTS (SELECT 1 FROM public.appeals WHERE user_id = v_me AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have an appeal waiting for a decision';
  END IF;
  INSERT INTO public.appeals (user_id, ban_id, message) VALUES (v_me, v_ban, btrim(p_message)) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'appeal_id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_appeal(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_appeal(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.appeals_notify_staff()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.notify_staff('New appeal', 'Someone appealed their suspension.', '/admin', 2);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_appeals_notify_staff ON public.appeals;
CREATE TRIGGER trg_appeals_notify_staff AFTER INSERT ON public.appeals FOR EACH ROW EXECUTE FUNCTION public.appeals_notify_staff();

-- the decision stands: at once
CREATE OR REPLACE FUNCTION public.uphold_appeal(p_appeal uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid;
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can decide appeals' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Please give a reason (at least 5 characters)'; END IF;
  UPDATE public.appeals SET status = 'upheld', decided_by = auth.uid(), decided_at = now(), decision_note = p_note
   WHERE id = p_appeal AND status = 'pending' RETURNING user_id INTO v_user;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Appeal not found or already decided'; END IF;
  PERFORM public.send_governance_notification(v_user, 'governance', 'Your appeal was reviewed and the decision stands. ' || p_note);
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'appeal_upheld', 'user', v_user::text, jsonb_build_object('appeal_id', p_appeal, 'note', p_note));
END;
$$;
REVOKE ALL ON FUNCTION public.uphold_appeal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.uphold_appeal(uuid, text) TO authenticated;

-- reversing it needs a second admin
CREATE OR REPLACE FUNCTION public.request_appeal_reversal(p_appeal uuid, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can decide appeals' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Please give a reason (at least 5 characters)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.appeals WHERE id = p_appeal AND status = 'pending') THEN
    RAISE EXCEPTION 'Appeal not found or already decided';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gov_approval_queue WHERE status = 'pending' AND action = 'appeal.reverse' AND target_id = p_appeal::text) THEN
    RAISE EXCEPTION 'This is already waiting for a second approver';
  END IF;
  INSERT INTO public.gov_approval_queue (maker_id, action, target_id, target_type, reason, payload, status)
  VALUES (auth.uid(), 'appeal.reverse', p_appeal::text, 'appeal', p_note, '{}'::jsonb, 'pending');
  RETURN jsonb_build_object('success', true, 'queued', true);
END;
$$;
REVOKE ALL ON FUNCTION public.request_appeal_reversal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_appeal_reversal(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.gov_queue_execute_appeals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid;
BEGIN
  IF NEW.action <> 'appeal.reverse' OR OLD.status <> 'pending' OR NEW.status <> 'approved' THEN
    RETURN NULL;
  END IF;
  IF public.staff_rank(NEW.checker_id) < 2 THEN RAISE EXCEPTION 'Only an admin can approve an appeal'; END IF;
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.appeals SET status = 'reversed', decided_by = NEW.checker_id, decided_at = now(), decision_note = NEW.reason
   WHERE id = NEW.target_id::uuid AND status = 'pending' RETURNING user_id INTO v_user;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Appeal not found or already decided'; END IF;
  UPDATE public.user_bans SET is_active = false, lifted_at = now(), lifted_by = NEW.checker_id WHERE user_id = v_user AND is_active;
  UPDATE public.profiles SET is_banned = false WHERE id = v_user;
  PERFORM public.send_governance_notification(v_user, 'governance', 'Your appeal was successful. Your account access has been restored.');
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (NEW.checker_id, 'admin', 'appeal_reversed', 'user', v_user::text,
          jsonb_build_object('appeal_id', NEW.target_id, 'note', NEW.reason, 'maker_id', NEW.maker_id, 'checker_id', NEW.checker_id));
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS gov_queue_execute_appeals ON public.gov_approval_queue;
CREATE TRIGGER gov_queue_execute_appeals AFTER UPDATE ON public.gov_approval_queue
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.gov_queue_execute_appeals();

-- ── reported chat messages ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_flagged_messages(p_status text DEFAULT 'pending')
RETURNS TABLE (
  id uuid, message_id uuid, channel_id uuid, target_type text, reporter_id uuid, reporter_username text,
  sender_id uuid, sender_username text, decrypted_content text, reason text, status text, created_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT f.id, f.message_id, f.channel_id, f.target_type, f.reporter_id, rp.username,
         s.sender, sp.username, f.decrypted_content, f.reason, f.status, f.created_at
    FROM public.flagged_messages f
    LEFT JOIN LATERAL (
      SELECT CASE f.target_type
               WHEN 'dm'            THEN (SELECT dm.sender_id FROM public.direct_messages dm WHERE dm.id = f.message_id)
               WHEN 'room'          THEN (SELECT rm.user_id FROM public.room_messages rm WHERE rm.id = f.message_id)
               WHEN 'project_space' THEN (SELECT pm.user_id FROM public.project_space_messages pm WHERE pm.id = f.message_id)
             END AS sender
    ) s ON true
    LEFT JOIN public.profiles rp ON rp.id = f.reporter_id
    LEFT JOIN public.profiles sp ON sp.id = s.sender
   WHERE f.status = p_status
   ORDER BY f.created_at DESC
   LIMIT 100;
END;
$$;
REVOKE ALL ON FUNCTION public.list_flagged_messages(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_flagged_messages(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_flagged_message(p_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_f public.flagged_messages%ROWTYPE;
  v_sender uuid;
  v_count integer;
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  IF p_action NOT IN ('dismiss', 'warn') THEN RAISE EXCEPTION 'Unknown action %', p_action; END IF;
  SELECT * INTO v_f FROM public.flagged_messages WHERE id = p_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found or already handled'; END IF;

  IF p_action = 'warn' THEN
    SELECT CASE v_f.target_type
             WHEN 'dm'            THEN (SELECT dm.sender_id FROM public.direct_messages dm WHERE dm.id = v_f.message_id)
             WHEN 'room'          THEN (SELECT rm.user_id FROM public.room_messages rm WHERE rm.id = v_f.message_id)
             WHEN 'project_space' THEN (SELECT pm.user_id FROM public.project_space_messages pm WHERE pm.id = v_f.message_id)
           END INTO v_sender;
    IF v_sender IS NULL THEN RAISE EXCEPTION 'The sender could not be found (the message may have been deleted)'; END IF;
    IF NOT public.gov_can_act_on(v_sender) THEN RAISE EXCEPTION 'You cannot warn yourself or someone of the same or a higher staff rank'; END IF;
    v_count := public._add_strike(v_sender, COALESCE(NULLIF(btrim(p_note), ''), 'A message you sent broke the rules (' || v_f.reason || ')'), NULL, auth.uid());
    PERFORM public.send_governance_notification(v_sender, 'warn', COALESCE(NULLIF(btrim(p_note), ''), v_f.reason));
  END IF;

  UPDATE public.flagged_messages SET status = 'resolved', reviewed_by = auth.uid(), reviewed_at = now() WHERE id = p_id;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'moderator', 'flagged_message_' || p_action, 'message', v_f.message_id::text,
          jsonb_build_object('flag_id', p_id, 'sender_id', v_sender, 'note', p_note));
  RETURN jsonb_build_object('success', true, 'action', p_action, 'active_strikes', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_flagged_message(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_flagged_message(uuid, text, text) TO authenticated;

-- ── moderation notes ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_moderation_note(p_report uuid, p_content text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_content, ''))) = 0 THEN RAISE EXCEPTION 'A note cannot be empty'; END IF;
  -- the column is author_id on some databases and moderator_id on others
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'moderation_notes' AND column_name = 'author_id') THEN
    EXECUTE 'INSERT INTO public.moderation_notes (report_id, author_id, content) VALUES ($1, $2, $3)' USING p_report, auth.uid(), btrim(p_content);
  ELSE
    EXECUTE 'INSERT INTO public.moderation_notes (report_id, moderator_id, content) VALUES ($1, $2, $3)' USING p_report, auth.uid(), btrim(p_content);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.add_moderation_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_moderation_note(uuid, text) TO authenticated;

-- ── alerts for staff ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.alert_staff_urgent_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.priority = 'urgent' AND (TG_OP = 'INSERT' OR OLD.priority IS DISTINCT FROM 'urgent') THEN
    PERFORM public.notify_staff('Urgent report', 'A report was marked urgent and needs a look.', '/moderation', 1);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_alert_staff_urgent_report ON public.content_reports;
CREATE TRIGGER trg_alert_staff_urgent_report AFTER INSERT OR UPDATE OF priority ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.alert_staff_urgent_report();

CREATE OR REPLACE FUNCTION public.alert_staff_flagged_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.notify_staff('Reported message', 'A chat message was reported (' || NEW.reason || ').', '/moderation', 1);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_alert_staff_flagged_message ON public.flagged_messages;
CREATE TRIGGER trg_alert_staff_flagged_message AFTER INSERT ON public.flagged_messages
  FOR EACH ROW EXECUTE FUNCTION public.alert_staff_flagged_message();

CREATE OR REPLACE FUNCTION public.alert_staff_approval_waiting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_rank integer := CASE WHEN NEW.action IN ('system.config', 'user.manage_roles', 'user.revoke_role') THEN 3
                         WHEN NEW.action IN ('user.ban', 'report.ban', 'appeal.reverse') THEN 2
                         ELSE 1 END;
BEGIN
  PERFORM public.notify_staff('Waiting for your approval', left(COALESCE(NEW.reason, NEW.action), 140),
                              CASE WHEN v_rank = 3 THEN '/super-admin' ELSE '/admin' END, v_rank, NEW.maker_id);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_alert_staff_approval_waiting ON public.gov_approval_queue;
CREATE TRIGGER trg_alert_staff_approval_waiting AFTER INSERT ON public.gov_approval_queue
  FOR EACH ROW EXECUTE FUNCTION public.alert_staff_approval_waiting();

-- ── one record of everything about an account ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_record(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'profile', (SELECT jsonb_build_object('id', p.id, 'username', p.username, 'full_name', p.full_name, 'avatar_url', p.avatar_url,
                  'account_type', p.account_type, 'is_verified', p.is_verified, 'is_banned', p.is_banned,
                  'is_shadowbanned', p.is_shadowbanned, 'muted_until', p.mute_expires_at, 'created_at', (SELECT u.created_at FROM auth.users u WHERE u.id = p.id))
                  FROM public.profiles p WHERE p.id = p_user),
    'rank', public.staff_rank(p_user),
    'strikes', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC), '[]'::jsonb) FROM (
                  SELECT id, reason, created_at, expires_at, revoked_at, revoke_note FROM public.user_strikes
                   WHERE user_id = p_user ORDER BY created_at DESC LIMIT 30) s),
    'bans', (SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC), '[]'::jsonb) FROM (
                  SELECT id, reason, ban_type, expires_at, is_active, created_at, lifted_at FROM public.user_bans
                   WHERE user_id = p_user ORDER BY created_at DESC LIMIT 20) b),
    'reports_against', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb) FROM (
                  SELECT id, target_type, reason, status, created_at, resolution_note FROM public.content_reports c
                   WHERE (c.target_type = 'user' AND c.target_id = p_user::text)
                      OR (c.target_type = 'post' AND c.target_id IN (SELECT po.id::text FROM public.posts po WHERE po.author_id = p_user))
                      OR (c.target_type = 'comment' AND c.target_id IN (SELECT pc.id::text FROM public.post_comments pc WHERE pc.user_id = p_user))
                   ORDER BY c.created_at DESC LIMIT 30) r),
    'reports_filed', (SELECT count(*) FROM public.content_reports WHERE reported_by = p_user),
    'appeals', (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]'::jsonb) FROM (
                  SELECT id, message, status, created_at, decided_at, decision_note FROM public.appeals
                   WHERE user_id = p_user ORDER BY created_at DESC LIMIT 10) a),
    'audit', (SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC), '[]'::jsonb) FROM (
                  SELECT action, actor_role, created_at, metadata FROM public.audit_logs
                   WHERE target_type = 'user' AND target_id = p_user::text ORDER BY created_at DESC LIMIT 50) l)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_user_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_record(uuid) TO authenticated;

COMMIT;
