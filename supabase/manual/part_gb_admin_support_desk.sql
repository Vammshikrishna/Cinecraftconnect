-- PART GB (support desk): give a ticket to a staff member, ready-made replies, and who is working on what. Safe to run more than once.
--
-- WHAT IT ADDS
--   * support_tickets.assigned_at          when the ticket was given to the current owner
--   * staff_desk_staff()                   the people a ticket can be given to (moderators, admins, super admins): id, name, level
--   * support_assign_ticket(ticket, who)   give a ticket to a staff member (or take it back with NULL). Audited. The new owner is told.
--   * more ready-made replies (mod_templates, kind = 'reply') so the support desk has macros from day one
--   * staff_workload()                     open tickets, open reports and overdue tickets per staff member (counts only), admin and up
-- The first reply time is already stored (support_tickets.first_response_at, part AM). The SLA timer is worked out in the app from the priority.
-- The web app keeps working before this is applied: the assignee box shows a note and the macros fall back to the saved replies it can already read.
--
-- PREFLIGHT (read only, all three should be true):
--   select to_regclass('public.support_tickets') is not null as tickets, to_regclass('public.mod_templates') is not null as templates,
--          to_regprocedure('public.staff_rank(uuid)') is not null as rank;
--
-- POST-CHECK (read only):
--   select column_name from information_schema.columns where table_schema = 'public' and table_name = 'support_tickets' and column_name = 'assigned_at';   -- 1 row
--   select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in ('staff_desk_staff', 'support_assign_ticket', 'staff_workload');   -- 3 rows
--   select count(*) from public.mod_templates where kind = 'reply';   -- 5 or more

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON public.support_tickets (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_open ON public.support_tickets (status, created_at);

-- ── who a ticket can be given to ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_desk_staff()
RETURNS TABLE (id uuid, username text, full_name text, level integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.full_name, public.staff_rank(p.id)
    FROM public.profiles p
   WHERE p.id IN (SELECT DISTINCT r.user_id FROM public.user_roles r)
     AND public.staff_rank(p.id) >= 1
   ORDER BY public.staff_rank(p.id) DESC, p.username;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_desk_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_desk_staff() TO authenticated;

-- ── give a ticket to somebody (or take the owner off with NULL) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.support_assign_ticket(p_ticket uuid, p_assignee uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_old uuid;
  v_subject text;
  v_status text;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;
  IF p_assignee IS NOT NULL AND public.staff_rank(p_assignee) < 1 THEN
    RAISE EXCEPTION 'A ticket can only be given to a staff member';
  END IF;
  SELECT assigned_to, subject, status INTO v_old, v_subject, v_status FROM public.support_tickets WHERE id = p_ticket FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;
  IF v_status IN ('resolved', 'closed') THEN
    RAISE EXCEPTION 'This ticket is already closed. Reopen it first.';
  END IF;
  IF v_old IS NOT DISTINCT FROM p_assignee THEN
    RETURN jsonb_build_object('success', true, 'changed', false);
  END IF;

  UPDATE public.support_tickets SET assigned_to = p_assignee, assigned_at = CASE WHEN p_assignee IS NULL THEN NULL ELSE now() END WHERE id = p_ticket;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), CASE public.staff_rank(auth.uid()) WHEN 3 THEN 'super_admin' WHEN 2 THEN 'admin' ELSE 'moderator' END,
          'support_ticket_assign', 'support_ticket', p_ticket::text,
          jsonb_build_object('from', v_old, 'to', p_assignee, 'subject', left(v_subject, 120)));

  IF p_assignee IS NOT NULL AND p_assignee <> auth.uid() THEN
    INSERT INTO public.notifications (user_id, title, message, type, priority, action_url)
    VALUES (p_assignee, 'A support ticket was given to you', left(v_subject, 120), 'staff_alert', 'high', '/admin');
  END IF;
  RETURN jsonb_build_object('success', true, 'changed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.support_assign_ticket(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_assign_ticket(uuid, uuid) TO authenticated;

-- ── ready-made replies (the web app picks them from the reply box) ─────────────────────────────
INSERT INTO public.mod_templates (kind, title, body) VALUES
  ('reply', 'We are looking into it', 'Thanks for getting in touch. We are looking into this now and will update you here as soon as we know more.'),
  ('reply', 'Need more details', 'Thanks for your message. Could you tell us a little more, for example what you were doing when it happened and which device you use? A screenshot helps too.'),
  ('reply', 'Fixed', 'Good news: this is fixed. Please try again and let us know if anything still looks wrong.'),
  ('reply', 'Billing question', 'Thanks for asking about billing. We have checked your account and will follow up here with the details shortly. You will not be charged twice.'),
  ('reply', 'Closing, no reply', 'We have not heard back, so we are closing this request. You can reopen it any time from the Help Center if you still need us.')
ON CONFLICT (kind, title) DO NOTHING;

-- ── who is working on what (counts only) ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_workload()
RETURNS TABLE (staff_id uuid, username text, full_name text, level integer, tickets_open integer, tickets_overdue integer, reports_open integer, last_active timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.full_name, public.staff_rank(p.id),
         COALESCE((SELECT count(*) FROM public.support_tickets t WHERE t.assigned_to = p.id AND t.status IN ('open', 'in_progress')), 0)::integer,
         -- overdue = no staff reply yet and older than the first-reply target for its priority
         COALESCE((SELECT count(*) FROM public.support_tickets t
                    WHERE t.assigned_to = p.id AND t.status IN ('open', 'in_progress') AND t.first_response_at IS NULL
                      AND t.created_at < now() - make_interval(hours => CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 4 WHEN 'medium' THEN 24 ELSE 72 END)), 0)::integer,
         COALESCE((SELECT count(*) FROM public.content_reports r WHERE r.assigned_to = p.id AND r.status IN ('pending', 'reviewing')), 0)::integer,
         (SELECT max(a.created_at) FROM public.audit_logs a WHERE a.actor_id = p.id)
    FROM public.profiles p
   WHERE p.id IN (SELECT DISTINCT r.user_id FROM public.user_roles r)
     AND public.staff_rank(p.id) >= 1
   ORDER BY public.staff_rank(p.id) DESC, p.username;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_workload() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_workload() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
