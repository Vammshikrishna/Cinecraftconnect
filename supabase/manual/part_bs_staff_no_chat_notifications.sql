-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- part_bs: staff accounts never receive room or project-space chat notifications
--
-- A staff member only looks inside a room or project space through audited access, and only while the grant is
-- active. Chat notifications carry message text, and they stay in the notification list after the grant ends, so
-- they must never be created for a staff account in the first place.
--
--   1. Stop     a trigger drops any "new message" notification for a room or a project space when it is addressed to
--               a staff account. It sits on the notifications table itself, so it also covers the database triggers
--               and the push-delivery edge function (which writes with the service role).
--   2. Clean    removes the room and project-space chat notifications staff accounts already have (and with them the
--               message text and encrypted copies those rows hold).
--
-- Direct messages and every other notification type (reports, approvals, access requests, system notices) are NOT
-- touched: they are not chat inside a room or a project space.
-- Run after part_bq. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- one definition of "a notification about a message inside a room or a project space"
CREATE OR REPLACE FUNCTION public.is_space_chat_notification(p_type text, p_action_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_type = 'new_message'
     AND p_action_url IS NOT NULL
     AND (p_action_url LIKE '/discussion-rooms/%' OR p_action_url LIKE '/projects/%');
$$;


-- ── 1. stop creating them for staff ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.skip_staff_chat_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_space_chat_notification(NEW.type, NEW.action_url) AND public.is_staff_user(NEW.user_id) THEN
    RETURN NULL; -- the row is simply not created
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS skip_staff_chat_notification ON public.notifications;
CREATE TRIGGER skip_staff_chat_notification
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.skip_staff_chat_notification();


-- ── 2. remove the ones that already exist ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_removed integer;
BEGIN
  DELETE FROM public.notifications n
  WHERE public.is_space_chat_notification(n.type, n.action_url)
    AND public.is_staff_user(n.user_id);
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  IF v_removed > 0 THEN
    INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
    VALUES (
      'staff.chat_notifications_removed', auth.uid(), 'all', 'notifications',
      'Staff accounts do not keep room or project-space chat notifications',
      jsonb_build_object('removed', v_removed)
    );
  END IF;
END $$;


-- ── check ───────────────────────────────────────────────────────────────────────────────────────
-- SELECT count(*) FROM public.notifications n
--  WHERE public.is_space_chat_notification(n.type, n.action_url) AND public.is_staff_user(n.user_id);   -- 0
-- Post in a room that a staff account used to be in: the staff account gets no notification; members still do.
