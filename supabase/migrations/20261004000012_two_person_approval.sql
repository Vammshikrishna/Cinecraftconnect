-- Two-person (maker-checker) approval for destructive report actions, enforced in the database.
--  * takedown / shadowban no longer run immediately: they create a pending gov_approval_queue row;
--  * a DIFFERENT staff member must approve it; approval executes the action server-side;
--  * dual control cannot be bypassed from the client (triggers force checker = caller, maker <> checker).
-- "dismiss" stays a single-person action because it is non-destructive.

-- 1. Internal executor (not callable by clients).
CREATE OR REPLACE FUNCTION public._apply_report_action(
  p_report_id uuid, p_action text, p_note text, p_maker uuid, p_checker uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  ELSIF p_action = 'shadowban' THEN
    IF v_author IS NULL THEN
      RAISE EXCEPTION 'Could not determine the author of this content';
    END IF;
    UPDATE public.profiles SET is_shadowbanned = true, shadow_banned_at = now() WHERE id = v_author;
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

-- 2. Client entry point: dismiss runs now; destructive actions are queued for a second person.
CREATE OR REPLACE FUNCTION public.moderator_resolve_report(p_report_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.content_reports%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_internal() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('dismiss', 'takedown', 'shadowban') THEN
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  SELECT * INTO v_report FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  IF p_action = 'dismiss' THEN
    RETURN public._apply_report_action(p_report_id, 'dismiss', p_note, auth.uid(), NULL);
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

-- 3. Dual control enforced on the queue itself.
CREATE OR REPLACE FUNCTION public.gov_queue_enforce_dual_control()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / background jobs / SECURITY DEFINER internals (no end-user JWT) are trusted.
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_current_user_internal() THEN
      RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
    END IF;
    NEW.maker_id := auth.uid();      -- cannot impersonate another maker
    NEW.checker_id := NULL;
    NEW.status := 'pending';         -- cannot insert pre-approved rows
    RETURN NEW;
  END IF;

  -- UPDATE: only decisions on pending rows, and only by a different staff member.
  IF NEW.action IS DISTINCT FROM OLD.action OR NEW.target_id IS DISTINCT FROM OLD.target_id
     OR NEW.target_type IS DISTINCT FROM OLD.target_type OR NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.maker_id IS DISTINCT FROM OLD.maker_id THEN
    RAISE EXCEPTION 'Approval requests are immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'pending' OR NEW.status NOT IN ('approved', 'rejected') THEN
      RAISE EXCEPTION 'Invalid status transition % -> %', OLD.status, NEW.status;
    END IF;
    IF NOT public.is_current_user_internal() THEN
      RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
    END IF;
    IF OLD.maker_id = auth.uid() THEN
      RAISE EXCEPTION 'Dual-control violation: the requester cannot approve or reject their own request';
    END IF;
    NEW.checker_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gov_queue_enforce_dual_control ON public.gov_approval_queue;
CREATE TRIGGER gov_queue_enforce_dual_control
  BEFORE INSERT OR UPDATE ON public.gov_approval_queue
  FOR EACH ROW EXECUTE FUNCTION public.gov_queue_enforce_dual_control();

-- 4. Approval executes the staged report action server-side (rejection reopens the report).
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

DROP TRIGGER IF EXISTS gov_queue_execute_report_actions ON public.gov_approval_queue;
CREATE TRIGGER gov_queue_execute_report_actions
  AFTER UPDATE ON public.gov_approval_queue
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.gov_queue_execute_report_actions();
