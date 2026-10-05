-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AM – Help Center
--   * people can finally SEE the replies on their requests (a ticket thread), and are notified of every staff reply
--     and when a request is resolved
--   * new request topics (account, appeal) and attachments (up to 3), optional diagnostics
--   * reopen / close / rate ("how did we do?") a request
--   * security: nobody can edit their own ticket's status / assignee / priority, post as another person, or write
--     internal notes through the API; limits on requests and replies
--   * "was this article helpful?" feedback for help articles
-- Run after part AL, then deploy the new web + mobile builds.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. columns and topics ────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS attachments text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS diagnostics jsonb;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS csat_rating smallint;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS csat_comment text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS csat_at timestamptz;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS first_response_at timestamptz;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS last_staff_message_at timestamptz;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS last_user_message_at timestamptz;

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_csat_rating_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_csat_rating_check CHECK (csat_rating IS NULL OR csat_rating BETWEEN 1 AND 5);
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_category_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_category_check
  CHECK (category = ANY (ARRAY['general', 'technical', 'billing', 'report_abuse', 'feature_request', 'account', 'appeal']));

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON public.support_ticket_messages (ticket_id, created_at);

-- ── 2. who is staff ──────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_support_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(public.is_current_user_internal(), false)
      OR COALESCE(public.has_role('moderator'::public.app_role, auth.uid()), false)
      OR COALESCE(public.has_role('admin'::public.app_role, auth.uid()), false)
      OR COALESCE(public.has_role('super_admin'::public.app_role, auth.uid()), false);
$$;
GRANT EXECUTE ON FUNCTION public.is_support_staff() TO authenticated, service_role;

-- ── 3. guards ────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_support_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_a text;
BEGIN
  IF public.market_is_system() THEN
    RETURN NEW;
  END IF;

  IF public.is_support_staff() THEN
    NEW.updated_at := now();
    IF TG_OP = 'UPDATE' AND NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
      NEW.resolved_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Use the Help Center to reply to, close or reopen a request' USING ERRCODE = 'P0001';
  END IF;

  -- INSERT by a member
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only open requests as yourself' USING ERRCODE = 'P0001';
  END IF;
  NEW.subject := left(btrim(COALESCE(NEW.subject, '')), 120);
  NEW.message := left(btrim(COALESCE(NEW.message, '')), 4000);
  IF char_length(NEW.subject) < 3 OR char_length(NEW.message) < 10 THEN
    RAISE EXCEPTION 'Please add a subject and a few details' USING ERRCODE = 'P0001';
  END IF;
  NEW.status := 'open';
  NEW.assigned_to := NULL;
  NEW.priority := CASE WHEN NEW.category IN ('appeal', 'report_abuse') THEN 'high' ELSE 'medium' END;
  NEW.csat_rating := NULL; NEW.csat_comment := NULL; NEW.csat_at := NULL;
  NEW.first_response_at := NULL; NEW.resolved_at := NULL; NEW.last_staff_message_at := NULL;
  NEW.last_user_message_at := now();
  NEW.created_at := now();
  NEW.updated_at := now();
  IF COALESCE(array_length(NEW.attachments, 1), 0) > 3 THEN
    RAISE EXCEPTION 'You can attach up to 3 screenshots' USING ERRCODE = 'P0001';
  END IF;
  FOREACH v_a IN ARRAY COALESCE(NEW.attachments, '{}') LOOP
    IF v_a NOT LIKE 'support:%' THEN
      RAISE EXCEPTION 'Invalid attachment' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  IF NEW.diagnostics IS NOT NULL AND char_length(NEW.diagnostics::text) > 4000 THEN
    NEW.diagnostics := NULL;
  END IF;
  IF (SELECT count(*) FROM public.support_tickets WHERE user_id = NEW.user_id AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'You have sent a lot of requests today. Please try again tomorrow.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.support_tickets WHERE user_id = NEW.user_id AND status IN ('open', 'in_progress')) >= 10 THEN
    RAISE EXCEPTION 'You have 10 open requests. Please wait for replies, or close ones you no longer need.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_support_ticket ON public.support_tickets;
CREATE TRIGGER trg_guard_support_ticket BEFORE INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.guard_support_ticket();

CREATE OR REPLACE FUNCTION public.guard_support_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_status text;
BEGIN
  IF public.market_is_system() THEN
    RETURN NEW;
  END IF;
  NEW.sender_id := auth.uid();
  NEW.content := left(btrim(COALESCE(NEW.content, '')), 4000);
  IF NEW.content = '' THEN
    RAISE EXCEPTION 'Write a message first' USING ERRCODE = 'P0001';
  END IF;
  NEW.created_at := now();
  IF public.is_support_staff() THEN
    RETURN NEW;
  END IF;
  NEW.is_internal := false;
  SELECT status INTO v_status FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF v_status = 'closed' THEN
    RAISE EXCEPTION 'This request is closed. Reopen it to reply.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.support_ticket_messages WHERE sender_id = auth.uid() AND created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'You are sending messages too quickly. Please wait a little.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_support_message ON public.support_ticket_messages;
CREATE TRIGGER trg_guard_support_message BEFORE INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_support_message();

-- after a message: keep the ticket in step, and tell the person about staff replies
CREATE OR REPLACE FUNCTION public.after_support_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  t public.support_tickets%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  PERFORM set_config('app.market_system', '1', true);
  IF NEW.sender_id = t.user_id THEN
    UPDATE public.support_tickets
       SET last_user_message_at = now(), updated_at = now(),
           status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END,
           resolved_at = CASE WHEN status = 'resolved' THEN NULL ELSE resolved_at END
     WHERE id = t.id;
  ELSIF NOT COALESCE(NEW.is_internal, false) THEN
    UPDATE public.support_tickets
       SET last_staff_message_at = now(), first_response_at = COALESCE(first_response_at, now()), updated_at = now(),
           status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END
     WHERE id = t.id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (t.user_id, NEW.sender_id, 'support_reply', 'New reply from support', left(NEW.content, 120),
            '/settings/help/requests/' || t.id::text, t.id, false);
  END IF;
  PERFORM set_config('app.market_system', '', true);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_after_support_message ON public.support_ticket_messages;
CREATE TRIGGER trg_after_support_message AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.after_support_message();

CREATE OR REPLACE FUNCTION public.notify_ticket_resolved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (NEW.user_id, auth.uid(), 'support_resolved', 'Your request was resolved', left(NEW.subject, 120) || ' - tell us how we did',
            '/settings/help/requests/' || NEW.id::text, NEW.id, false);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_ticket_resolved ON public.support_tickets;
CREATE TRIGGER trg_notify_ticket_resolved AFTER UPDATE OF status ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_resolved();

-- ── 4. my requests, reopen / close / rate ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_support_tickets()
RETURNS TABLE (
  id uuid, subject text, category text, priority text, status text, created_at timestamptz, updated_at timestamptz,
  message_count integer, last_message_at timestamptz, staff_replied boolean, csat_rating smallint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT t.id, t.subject, t.category, t.priority, t.status, t.created_at, t.updated_at,
         (SELECT count(*) FROM public.support_ticket_messages m WHERE m.ticket_id = t.id AND NOT COALESCE(m.is_internal, false))::integer,
         GREATEST(t.created_at, COALESCE(t.last_staff_message_at, t.created_at), COALESCE(t.last_user_message_at, t.created_at)),
         -- true when support wrote last and the request is still open: "they replied, your turn"
         (t.last_staff_message_at IS NOT NULL AND t.last_staff_message_at >= COALESCE(t.last_user_message_at, t.created_at) AND t.status IN ('open', 'in_progress')),
         t.csat_rating
    FROM public.support_tickets t
   WHERE t.user_id = auth.uid()
   ORDER BY (t.status IN ('open', 'in_progress')) DESC, t.updated_at DESC
   LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.my_support_tickets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_support_tickets() TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_support_ticket(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  t public.support_tickets%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = p_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0001';
  END IF;
  IF t.status NOT IN ('resolved', 'closed') THEN
    RAISE EXCEPTION 'This request is still open' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(t.resolved_at, t.updated_at) < now() - interval '14 days' THEN
    RAISE EXCEPTION 'This request was closed more than 14 days ago. Please start a new request.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.support_tickets SET status = 'open', resolved_at = NULL, updated_at = now(), last_user_message_at = now() WHERE id = p_id;
  PERFORM set_config('app.market_system', '', true);
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.reopen_support_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_support_ticket(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_support_ticket(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n integer;
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.support_tickets SET status = 'closed', resolved_at = COALESCE(resolved_at, now()), updated_at = now()
   WHERE id = p_id AND user_id = auth.uid() AND status IN ('open', 'in_progress', 'resolved');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.market_system', '', true);
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.close_support_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_support_ticket(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rate_support_ticket(p_id uuid, p_rating integer, p_comment text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n integer;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Choose 1 to 5 stars' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.support_tickets
     SET csat_rating = p_rating, csat_comment = left(NULLIF(btrim(COALESCE(p_comment, '')), ''), 500), csat_at = now()
   WHERE id = p_id AND user_id = auth.uid() AND status IN ('resolved', 'closed');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.market_system', '', true);
  IF v_n = 0 THEN
    RAISE EXCEPTION 'You can rate a request once it is resolved' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.rate_support_ticket(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rate_support_ticket(uuid, integer, text) TO authenticated;

-- ── 5. "was this article helpful?" ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.help_article_feedback (
  article_id text NOT NULL CHECK (char_length(article_id) BETWEEN 1 AND 80),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  helpful boolean NOT NULL,
  comment text CHECK (comment IS NULL OR char_length(comment) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);
ALTER TABLE public.help_article_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS help_article_feedback_own ON public.help_article_feedback;
CREATE POLICY help_article_feedback_own ON public.help_article_feedback FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_support_staff());
REVOKE ALL ON public.help_article_feedback FROM anon, PUBLIC;
GRANT SELECT ON public.help_article_feedback TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_help_feedback(p_article text, p_helpful boolean, p_comment text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  IF p_article IS NULL OR char_length(p_article) > 80 THEN
    RAISE EXCEPTION 'Unknown article' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.help_article_feedback (article_id, user_id, helpful, comment)
  VALUES (p_article, auth.uid(), COALESCE(p_helpful, false), left(NULLIF(btrim(COALESCE(p_comment, '')), ''), 300))
  ON CONFLICT (article_id, user_id) DO UPDATE SET helpful = EXCLUDED.helpful, comment = EXCLUDED.comment, created_at = now();
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_help_feedback(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_help_feedback(text, boolean, text) TO authenticated;

COMMIT;
