-- PART BI: governance actions that really run, and run on the server.
--
-- Fixes:
--  * Moderators' Warn / Ban and the Report Triage actions did nothing (they only wrote an audit line in the browser).
--  * Super Admin flag changes, policy edits and role changes did nothing, or ran only from the browser.
--  * Suspending an account was a single click with no reason, no second person and no check of who was suspended.
--  * ANY moderator could change staff roles (the "Admins can manage roles" policy allowed it), including promoting
--    themselves to super admin. Staff roles can now only change through the approval queue.
--  * Temporary bans never ended. Expired ones are now lifted.
--  * The admin numbers were wrong (the "pending support" count, the fraud-alert count, a made-up revenue figure).
--
-- How it works now
--  * Staff rank: user 0 < moderator 1 < admin 2 < super admin 3. Nobody can act on themselves or on someone of the
--    same or higher rank.
--  * gov_request_action() puts a ban / role change / role revoke / flag change / policy edit into gov_approval_queue.
--    A DIFFERENT staff member of enough rank approves it, and the database then performs it and writes the audit line.
--  * Warn and Dismiss run at once (they are not destructive). Takedown, Shadowban and Ban need a second person (part J).
--
-- Run after part BH. Then deploy web. Safe to run twice.
BEGIN;

-- ── rank helpers ────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_rank(p_user uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(max(CASE r.role::text WHEN 'super_admin' THEN 3 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 1 ELSE 0 END), 0)
    FROM public.user_roles r WHERE r.user_id = p_user;
$$;

-- may the signed-in person act on this account? Not themselves, and only someone of a lower rank.
CREATE OR REPLACE FUNCTION public.gov_can_act_on(p_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND p_target IS DISTINCT FROM auth.uid()
     AND public.staff_rank(auth.uid()) > public.staff_rank(p_target);
$$;

-- ── staff roles only change through the approval queue ──────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.guard_user_roles_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- functions of ours set this flag; sign-up and the service role have no signed-in staff member
  IF public.market_is_system() OR auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  -- an ordinary "user" row (what sign-up creates) is harmless
  IF TG_OP = 'INSERT' AND NEW.role::text = 'user' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Staff roles can only be changed through the approval queue' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_user_roles_write ON public.user_roles;
CREATE TRIGGER trg_guard_user_roles_write BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_roles_write();

-- the one-time "claim the first super admin" function sets the flag, so the guard lets it through
CREATE OR REPLACE FUNCTION public.claim_admin_access()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'A Super Admin already exists. Access denied.';
  END IF;
  PERFORM set_config('app.market_system', '1', true);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'super_admin'::public.app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin'::public.app_role;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (auth.uid(), 'super_admin', 'claim_initial_admin', 'user', auth.uid()::text);
END;
$$;

-- ── bans ────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._apply_user_ban(
  p_target uuid, p_reason text, p_ban_type text, p_expires timestamptz, p_maker uuid, p_checker uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_target IS NULL OR p_target = p_maker OR p_target = p_checker THEN
    RAISE EXCEPTION 'You cannot suspend yourself';
  END IF;
  IF public.staff_rank(p_target) >= public.staff_rank(p_maker)
     OR (p_checker IS NOT NULL AND public.staff_rank(p_target) >= public.staff_rank(p_checker)) THEN
    RAISE EXCEPTION 'You cannot suspend someone of the same or a higher staff rank';
  END IF;
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.user_bans SET is_active = false, lifted_at = now(), lifted_by = COALESCE(p_checker, p_maker)
   WHERE user_id = p_target AND is_active;
  INSERT INTO public.user_bans (user_id, banned_by, reason, ban_type, expires_at, is_active)
  VALUES (p_target, COALESCE(p_checker, p_maker), p_reason, p_ban_type, p_expires, true);
  UPDATE public.profiles SET is_banned = true WHERE id = p_target;
  PERFORM public.send_governance_notification(p_target, 'ban', p_reason);
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (COALESCE(p_checker, p_maker),
          CASE public.staff_rank(COALESCE(p_checker, p_maker)) WHEN 3 THEN 'super_admin' WHEN 2 THEN 'admin' ELSE 'moderator' END,
          'ban_user', 'user', p_target::text,
          jsonb_build_object('reason', p_reason, 'ban_type', p_ban_type, 'expires_at', p_expires,
                             'maker_id', p_maker, 'checker_id', p_checker));
END;
$$;
REVOKE ALL ON FUNCTION public._apply_user_ban(uuid, text, text, timestamptz, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- the old one-click ban is no longer callable by signed-in users; the queue replaces it
REVOKE EXECUTE ON FUNCTION public.ban_user(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_user_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- lifts bans whose time has passed; runs from a schedule (below) and can be called by hand
CREATE OR REPLACE FUNCTION public.lift_expired_bans()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  WITH expired AS (
    UPDATE public.user_bans SET is_active = false, lifted_at = now()
     WHERE is_active AND expires_at IS NOT NULL AND expires_at <= now()
    RETURNING user_id
  )
  SELECT count(*) INTO v_count FROM expired;
  UPDATE public.profiles p SET is_banned = false
   WHERE p.is_banned
     AND NOT EXISTS (SELECT 1 FROM public.user_bans b WHERE b.user_id = p.id AND b.is_active);
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.lift_expired_bans() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('lift-expired-bans', '*/10 * * * *', 'SELECT public.lift_expired_bans()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule lift_expired_bans (%). Call it from your own schedule.', SQLERRM;
END $$;

-- ── requests that need a second person ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gov_request_action(
  p_action text, p_target_type text, p_target_id text, p_reason text, p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_rank integer := public.staff_rank(auth.uid());
  v_target uuid;
  v_days integer;
  v_role text;
BEGIN
  IF v_me IS NULL OR v_rank < 1 THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Please give a reason (at least 5 characters)';
  END IF;

  IF p_action = 'user.ban' THEN
    IF v_rank < 2 THEN RAISE EXCEPTION 'Only admins can suspend accounts'; END IF;
    IF p_target_type <> 'user' THEN RAISE EXCEPTION 'A suspension needs a user'; END IF;
    v_target := p_target_id::uuid;
    IF NOT public.gov_can_act_on(v_target) THEN
      RAISE EXCEPTION 'You cannot suspend yourself or someone of the same or a higher staff rank';
    END IF;
    v_days := NULLIF(p_payload ->> 'days', '')::integer;
    IF v_days IS NOT NULL AND (v_days < 1 OR v_days > 365) THEN
      RAISE EXCEPTION 'A temporary suspension is 1 to 365 days';
    END IF;

  ELSIF p_action = 'system.config' THEN
    IF v_rank < 3 THEN RAISE EXCEPTION 'Only a super admin can change platform settings'; END IF;
    IF p_target_type = 'platform_flags' THEN
      IF NOT EXISTS (SELECT 1 FROM public.platform_flags WHERE id = p_target_id::uuid) THEN RAISE EXCEPTION 'Flag not found'; END IF;
      IF jsonb_typeof(p_payload -> 'value') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'A flag is on or off'; END IF;
    ELSIF p_target_type = 'platform_policies' THEN
      IF NOT EXISTS (SELECT 1 FROM public.platform_policies WHERE id = p_target_id::uuid) THEN RAISE EXCEPTION 'Policy not found'; END IF;
      IF length(btrim(coalesce(p_payload ->> 'title', ''))) = 0 OR length(btrim(coalesce(p_payload ->> 'content', ''))) = 0 THEN
        RAISE EXCEPTION 'A policy needs a title and text';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unknown setting type';
    END IF;

  ELSIF p_action IN ('user.manage_roles', 'user.revoke_role') THEN
    IF v_rank < 3 THEN RAISE EXCEPTION 'Only a super admin can change staff roles'; END IF;
    v_target := p_target_id::uuid;
    IF NOT public.gov_can_act_on(v_target) THEN
      RAISE EXCEPTION 'You cannot change your own role or the role of another super admin';
    END IF;
    v_role := p_payload ->> 'role';
    IF v_role NOT IN ('user', 'moderator', 'admin', 'super_admin') THEN RAISE EXCEPTION 'Unknown role'; END IF;

  ELSE
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  IF EXISTS (SELECT 1 FROM public.gov_approval_queue
              WHERE status = 'pending' AND action = p_action AND target_type = p_target_type AND target_id = p_target_id) THEN
    RAISE EXCEPTION 'This is already waiting for a second approver';
  END IF;

  INSERT INTO public.gov_approval_queue (maker_id, action, target_id, target_type, reason, payload, status)
  VALUES (v_me, p_action, p_target_id, p_target_type, p_reason, COALESCE(p_payload, '{}'::jsonb), 'pending');

  RETURN jsonb_build_object('success', true, 'queued', true);
END;
$$;
REVOKE ALL ON FUNCTION public.gov_request_action(text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gov_request_action(text, text, text, text, jsonb) TO authenticated;

-- when the second person approves, the database does it (checks the approver's rank again)
CREATE OR REPLACE FUNCTION public.gov_queue_execute_actions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_checker_rank integer := public.staff_rank(NEW.checker_id);
  v_target uuid;
  v_days integer;
  v_role text;
  v_old_role text;
BEGIN
  IF NEW.action LIKE 'report.%' OR OLD.status <> 'pending' OR NEW.status <> 'approved' THEN
    RETURN NULL;
  END IF;
  IF NEW.action NOT IN ('user.ban', 'system.config', 'user.manage_roles', 'user.revoke_role') THEN
    RETURN NULL;
  END IF;

  PERFORM set_config('app.market_system', '1', true);

  IF NEW.action = 'user.ban' THEN
    IF v_checker_rank < 2 THEN RAISE EXCEPTION 'Only an admin can approve a suspension'; END IF;
    v_target := NEW.target_id::uuid;
    v_days := NULLIF(NEW.payload ->> 'days', '')::integer;
    PERFORM public._apply_user_ban(v_target, NEW.reason,
      CASE WHEN v_days IS NULL THEN 'permanent' ELSE 'temporary' END,
      CASE WHEN v_days IS NULL THEN NULL ELSE now() + make_interval(days => v_days) END,
      NEW.maker_id, NEW.checker_id);

  ELSIF NEW.action = 'system.config' THEN
    IF v_checker_rank < 3 THEN RAISE EXCEPTION 'Only a super admin can approve a platform change'; END IF;
    IF NEW.target_type = 'platform_flags' THEN
      UPDATE public.platform_flags SET value = (NEW.payload ->> 'value')::boolean, updated_by = NEW.checker_id, updated_at = now()
       WHERE id = NEW.target_id::uuid;
    ELSIF NEW.target_type = 'platform_policies' THEN
      UPDATE public.platform_policies SET title = NEW.payload ->> 'title', content = NEW.payload ->> 'content', updated_at = now()
       WHERE id = NEW.target_id::uuid;
    END IF;
    INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
    VALUES (NEW.checker_id, 'super_admin', 'system_config', NEW.target_type, NEW.target_id,
            jsonb_build_object('reason', NEW.reason, 'change', NEW.payload, 'maker_id', NEW.maker_id, 'checker_id', NEW.checker_id));

  ELSIF NEW.action = 'user.manage_roles' THEN
    IF v_checker_rank < 3 THEN RAISE EXCEPTION 'Only a super admin can approve a role change'; END IF;
    v_target := NEW.target_id::uuid;
    v_role := NEW.payload ->> 'role';
    IF v_target IN (NEW.maker_id, NEW.checker_id) OR public.staff_rank(v_target) >= 3 THEN
      RAISE EXCEPTION 'You cannot change your own role or the role of another super admin';
    END IF;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_target, v_role::public.app_role)
      ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
    PERFORM public.send_governance_notification(v_target, 'role_assign', v_role);
    INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
    VALUES (NEW.checker_id, 'super_admin', 'assign_role', 'user', NEW.target_id,
            jsonb_build_object('role', v_role, 'reason', NEW.reason, 'maker_id', NEW.maker_id, 'checker_id', NEW.checker_id));

  ELSIF NEW.action = 'user.revoke_role' THEN
    IF v_checker_rank < 3 THEN RAISE EXCEPTION 'Only a super admin can approve a role change'; END IF;
    v_target := NEW.target_id::uuid;
    v_role := NEW.payload ->> 'role';
    IF v_target IN (NEW.maker_id, NEW.checker_id) OR public.staff_rank(v_target) >= 3 THEN
      RAISE EXCEPTION 'You cannot change your own role or the role of another super admin';
    END IF;
    DELETE FROM public.user_roles WHERE user_id = v_target AND role::text = v_role;
    PERFORM public.send_governance_notification(v_target, 'role_revoke', v_role);
    INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
    VALUES (NEW.checker_id, 'super_admin', 'revoke_role', 'user', NEW.target_id,
            jsonb_build_object('role', v_role, 'reason', NEW.reason, 'maker_id', NEW.maker_id, 'checker_id', NEW.checker_id));
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS gov_queue_execute_actions ON public.gov_approval_queue;
CREATE TRIGGER gov_queue_execute_actions
  AFTER UPDATE ON public.gov_approval_queue
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.gov_queue_execute_actions();

-- ── report actions: add Warn (at once) and Ban (second person) ─────────────────────────────────
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

CREATE OR REPLACE FUNCTION public.moderator_resolve_report(p_report_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_report public.content_reports%ROWTYPE;
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

  -- not destructive: run now
  IF p_action IN ('dismiss', 'warn') THEN
    RETURN public._apply_report_action(p_report_id, p_action, p_note, auth.uid(), NULL);
  END IF;

  -- a moderator may ask for a ban; an admin has to approve it (checked when it is approved, below)
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

-- a ban that came from a report needs an admin to approve it
CREATE OR REPLACE FUNCTION public.gov_queue_check_report_ban_approver()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.action = 'report.ban' AND NEW.status = 'approved' AND public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Only an admin can approve a ban';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS gov_queue_check_report_ban_approver ON public.gov_approval_queue;
CREATE TRIGGER gov_queue_check_report_ban_approver
  BEFORE UPDATE ON public.gov_approval_queue
  FOR EACH ROW EXECUTE FUNCTION public.gov_queue_check_report_ban_approver();

-- claiming a case
CREATE OR REPLACE FUNCTION public.moderator_claim_report(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_internal() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.content_reports
     SET assigned_to = auth.uid(), status = CASE WHEN status = 'pending' THEN 'reviewing' ELSE status END
   WHERE id = p_report_id AND status IN ('pending', 'reviewing')
     AND (assigned_to IS NULL OR assigned_to = auth.uid() OR public.staff_rank(auth.uid()) >= 2);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This case is closed or already taken by someone else';
  END IF;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (auth.uid(), 'moderator', 'report_claim', 'content_report', p_report_id::text);
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.moderator_claim_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderator_claim_report(uuid) TO authenticated;

-- ── numbers on the admin screens ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_active bigint;
  v_fraud bigint;
  v_support bigint;
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  -- people whose profile changed in the last hour (there is no session table to count)
  SELECT count(*) INTO v_active FROM public.profiles WHERE updated_at > now() - interval '1 hour';
  SELECT count(*) INTO v_fraud FROM public.content_reports WHERE reason IN ('fraud', 'scam') AND status IN ('pending', 'reviewing');
  SELECT count(*) INTO v_support FROM public.support_tickets WHERE status NOT IN ('resolved', 'closed');
  RETURN jsonb_build_object('active_sessions', v_active, 'fraud_alerts', v_fraud, 'pending_support', v_support);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;

-- risk spread, counted in the database (an account with no score is counted separately)
CREATE OR REPLACE FUNCTION public.get_risk_distribution()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN (SELECT jsonb_build_object(
    'low',     count(*) FILTER (WHERE trust_score >= 70),
    'medium',  count(*) FILTER (WHERE trust_score >= 40 AND trust_score < 70),
    'high',    count(*) FILTER (WHERE trust_score < 40),
    'unrated', count(*) FILTER (WHERE trust_score IS NULL),
    'total',   count(*)) FROM public.profiles);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_risk_distribution() TO authenticated;

COMMIT;
