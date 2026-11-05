-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PART CF: the marketplace dispute centre.
-- When a booking or an accepted vendor quote goes wrong, either side can open a dispute. The other side has five days to
-- answer, both can add messages, and an admin decides (for the person who opened it, for the other side, split, or no
-- fault). Everyone is told. A decision records an amount when one is agreed; paying money back is still done from
-- Payments → Refunds when the booking was paid through the app.
-- Staff accounts do not take part in marketplace deals, so they cannot open or answer a dispute; they review and decide.
-- Run after part CE. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_disputes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              text NOT NULL CHECK (kind IN ('booking', 'quote')),
  booking_id        uuid REFERENCES public.marketplace_bookings(id) ON DELETE SET NULL,
  quote_id          uuid REFERENCES public.vendor_quotes(id) ON DELETE SET NULL,
  opened_by         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  other_party       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opener_role       text NOT NULL CHECK (opener_role IN ('buyer', 'seller')),
  reason            text NOT NULL CHECK (reason IN ('not_delivered', 'not_as_described', 'damaged', 'no_show', 'payment', 'off_platform_payment', 'scam', 'other')),
  description       text NOT NULL CHECK (length(description) BETWEEN 20 AND 2000),
  amount_claimed    numeric CHECK (amount_claimed IS NULL OR amount_claimed >= 0),
  status            text NOT NULL DEFAULT 'awaiting_response' CHECK (status IN ('awaiting_response', 'under_review', 'resolved', 'withdrawn')),
  response_due_at   timestamptz NOT NULL DEFAULT (now() + interval '5 days'),
  assigned_to       uuid,
  outcome           text CHECK (outcome IS NULL OR outcome IN ('favor_opener', 'favor_other', 'split', 'no_fault')),
  outcome_note      text,
  resolution_amount numeric CHECK (resolution_amount IS NULL OR resolution_amount >= 0),
  order_id          uuid,
  decided_by        uuid,
  decided_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mp_dispute_booking ON public.marketplace_disputes (booking_id) WHERE booking_id IS NOT NULL AND status IN ('awaiting_response', 'under_review');
CREATE UNIQUE INDEX IF NOT EXISTS uq_mp_dispute_quote ON public.marketplace_disputes (quote_id) WHERE quote_id IS NOT NULL AND status IN ('awaiting_response', 'under_review');
CREATE INDEX IF NOT EXISTS idx_mp_dispute_status ON public.marketplace_disputes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_dispute_opener ON public.marketplace_disputes (opened_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_dispute_other ON public.marketplace_disputes (other_party, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketplace_dispute_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  uuid NOT NULL REFERENCES public.marketplace_disputes(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL,
  author_role text NOT NULL CHECK (author_role IN ('opener', 'other', 'staff')),
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mp_dispute_msgs ON public.marketplace_dispute_messages (dispute_id, created_at);

ALTER TABLE public.marketplace_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_dispute_messages ENABLE ROW LEVEL SECURITY;
-- reading only: every change goes through the functions below
DROP POLICY IF EXISTS mp_disputes_read ON public.marketplace_disputes;
CREATE POLICY mp_disputes_read ON public.marketplace_disputes FOR SELECT
  USING (opened_by = auth.uid() OR other_party = auth.uid() OR public.staff_rank(auth.uid()) >= 1);
DROP POLICY IF EXISTS mp_dispute_msgs_read ON public.marketplace_dispute_messages;
CREATE POLICY mp_dispute_msgs_read ON public.marketplace_dispute_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.marketplace_disputes d WHERE d.id = dispute_id
                 AND (d.opened_by = auth.uid() OR d.other_party = auth.uid() OR public.staff_rank(auth.uid()) >= 1)));
REVOKE INSERT, UPDATE, DELETE ON public.marketplace_disputes, public.marketplace_dispute_messages FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public._mp_notify(p_user uuid, p_title text, p_message text, p_dispute uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO public.notifications (user_id, type, title, message, action_url, related_id)
  VALUES (p_user, 'marketplace_dispute', p_title, p_message, '/marketplace/disputes', p_dispute);
$$;
REVOKE ALL ON FUNCTION public._mp_notify(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- ── opening one ─────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_marketplace_dispute(p_kind text, p_ref uuid, p_reason text, p_description text, p_amount numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_id uuid;
  v_other uuid;
  v_role text;
  v_booking public.marketplace_bookings%ROWTYPE;
  v_quote public.vendor_quotes%ROWTYPE;
  v_vendor_owner uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF public.staff_rank(v_me) >= 1 THEN RAISE EXCEPTION 'Staff accounts do not take part in marketplace deals' USING ERRCODE = '42501'; END IF;
  IF p_reason NOT IN ('not_delivered', 'not_as_described', 'damaged', 'no_show', 'payment', 'off_platform_payment', 'scam', 'other') THEN
    RAISE EXCEPTION 'Choose what went wrong';
  END IF;
  IF length(btrim(coalesce(p_description, ''))) < 20 OR length(p_description) > 2000 THEN
    RAISE EXCEPTION 'Please describe what happened in 20 to 2000 characters';
  END IF;
  IF p_amount IS NOT NULL AND (p_amount < 0 OR p_amount > 10000000) THEN RAISE EXCEPTION 'That amount is not valid'; END IF;
  IF (SELECT count(*) FROM public.marketplace_disputes WHERE opened_by = v_me AND created_at > now() - interval '30 days') >= 5 THEN
    RAISE EXCEPTION 'You have opened several disputes recently. Please wait for them to be decided first.';
  END IF;

  IF p_kind = 'booking' THEN
    SELECT * INTO v_booking FROM public.marketplace_bookings WHERE id = p_ref AND parent_booking_id IS NULL;
    IF NOT FOUND OR v_me NOT IN (v_booking.renter_id, v_booking.owner_id) THEN RAISE EXCEPTION 'That booking was not found'; END IF;
    IF v_booking.status::text NOT IN ('confirmed', 'completed', 'cancelled') THEN RAISE EXCEPTION 'A booking can be disputed once it is confirmed'; END IF;
    IF v_booking.status::text = 'confirmed' AND v_booking.start_date > current_date THEN RAISE EXCEPTION 'You can open a dispute once the booking has started'; END IF;
    IF v_booking.end_date < current_date - 30 THEN RAISE EXCEPTION 'The 30 days to open a dispute for this booking have passed'; END IF;
    v_role := CASE WHEN v_me = v_booking.renter_id THEN 'buyer' ELSE 'seller' END;
    v_other := CASE WHEN v_me = v_booking.renter_id THEN v_booking.owner_id ELSE v_booking.renter_id END;
    INSERT INTO public.marketplace_disputes (kind, booking_id, opened_by, other_party, opener_role, reason, description, amount_claimed)
    VALUES ('booking', p_ref, v_me, v_other, v_role, p_reason, btrim(p_description), p_amount) RETURNING id INTO v_id;
  ELSIF p_kind = 'quote' THEN
    SELECT * INTO v_quote FROM public.vendor_quotes WHERE id = p_ref;
    IF NOT FOUND THEN RAISE EXCEPTION 'That quote was not found'; END IF;
    SELECT owner_id INTO v_vendor_owner FROM public.vendors WHERE id = v_quote.vendor_id;
    IF v_me NOT IN (v_quote.requester_id, v_vendor_owner) THEN RAISE EXCEPTION 'That quote was not found'; END IF;
    IF v_quote.status NOT IN ('accepted', 'completed', 'cancelled') THEN RAISE EXCEPTION 'A quote can be disputed once it has been accepted'; END IF;
    IF v_quote.status = 'accepted' AND v_quote.start_date > current_date THEN RAISE EXCEPTION 'You can open a dispute once the job has started'; END IF;
    IF v_quote.end_date < current_date - 30 THEN RAISE EXCEPTION 'The 30 days to open a dispute for this job have passed'; END IF;
    v_role := CASE WHEN v_me = v_quote.requester_id THEN 'buyer' ELSE 'seller' END;
    v_other := CASE WHEN v_me = v_quote.requester_id THEN v_vendor_owner ELSE v_quote.requester_id END;
    INSERT INTO public.marketplace_disputes (kind, quote_id, opened_by, other_party, opener_role, reason, description, amount_claimed)
    VALUES ('quote', p_ref, v_me, v_other, v_role, p_reason, btrim(p_description), p_amount) RETURNING id INTO v_id;
  ELSE
    RAISE EXCEPTION 'Unknown kind';
  END IF;

  PERFORM public._mp_notify(v_other, 'A dispute was opened',
    'The other side opened a dispute about a marketplace deal. You have 5 days to answer.', v_id);
  PERFORM public.notify_staff('New marketplace dispute', 'A marketplace dispute was opened (' || replace(p_reason, '_', ' ') || ').', '/admin', 2);
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'A dispute is already open for this deal';
END;
$$;
REVOKE ALL ON FUNCTION public.open_marketplace_dispute(text, uuid, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_marketplace_dispute(text, uuid, text, text, numeric) TO authenticated;

-- ── answering, withdrawing ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reply_marketplace_dispute(p_id uuid, p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  d public.marketplace_disputes%ROWTYPE;
  v_role text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_body, ''))) < 1 OR length(p_body) > 2000 THEN RAISE EXCEPTION 'Write a message of up to 2000 characters'; END IF;
  SELECT * INTO d FROM public.marketplace_disputes WHERE id = p_id AND v_me IN (opened_by, other_party) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That dispute was not found'; END IF;
  IF d.status NOT IN ('awaiting_response', 'under_review') THEN RAISE EXCEPTION 'This dispute is closed'; END IF;
  v_role := CASE WHEN v_me = d.opened_by THEN 'opener' ELSE 'other' END;
  IF (SELECT count(*) FROM public.marketplace_dispute_messages WHERE dispute_id = p_id AND author_id = v_me) >= 20 THEN
    RAISE EXCEPTION 'You have reached the limit of messages on this dispute';
  END IF;
  INSERT INTO public.marketplace_dispute_messages (dispute_id, author_id, author_role, body) VALUES (p_id, v_me, v_role, btrim(p_body));
  UPDATE public.marketplace_disputes
     SET status = CASE WHEN v_role = 'other' AND status = 'awaiting_response' THEN 'under_review' ELSE status END, updated_at = now()
   WHERE id = p_id;
  PERFORM public._mp_notify(CASE WHEN v_me = d.opened_by THEN d.other_party ELSE d.opened_by END,
                            'New message on a dispute', 'The other side added a message to your dispute.', p_id);
  IF v_role = 'other' AND d.status = 'awaiting_response' THEN
    PERFORM public.notify_staff('Dispute answered', 'The other side answered a marketplace dispute. It is ready for review.', '/admin', 2);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.reply_marketplace_dispute(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_marketplace_dispute(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.withdraw_marketplace_dispute(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  d public.marketplace_disputes%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.marketplace_disputes WHERE id = p_id AND opened_by = auth.uid() AND status IN ('awaiting_response', 'under_review');
  IF NOT FOUND THEN RAISE EXCEPTION 'Only the person who opened an open dispute can withdraw it'; END IF;
  UPDATE public.marketplace_disputes SET status = 'withdrawn', decided_at = now(), updated_at = now() WHERE id = p_id;
  PERFORM public._mp_notify(d.other_party, 'A dispute was withdrawn', 'The other side withdrew the dispute they opened.', p_id);
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_marketplace_dispute(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_marketplace_dispute(uuid) TO authenticated;

-- ── reading, for the two sides and for staff ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._mp_item(p_kind text, p_booking uuid, p_quote uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN p_kind = 'booking'
              THEN COALESCE((SELECT l.title FROM public.marketplace_bookings b JOIN public.marketplace_listings l ON l.id = b.listing_id WHERE b.id = p_booking), 'A booking')
              ELSE COALESCE((SELECT v.business_name FROM public.vendor_quotes q JOIN public.vendors v ON v.id = q.vendor_id WHERE q.id = p_quote), 'A vendor job') END;
$$;
REVOKE ALL ON FUNCTION public._mp_item(text, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_marketplace_disputes()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', d.id, 'kind', d.kind, 'item', public._mp_item(d.kind, d.booking_id, d.quote_id), 'reason', d.reason, 'status', d.status,
      'i_opened', d.opened_by = auth.uid(), 'other_name', COALESCE(p.full_name, p.username, 'The other side'),
      'response_due_at', d.response_due_at, 'outcome', d.outcome, 'created_at', d.created_at, 'updated_at', d.updated_at
    ) ORDER BY d.updated_at DESC), '[]'::jsonb)
    FROM public.marketplace_disputes d
    LEFT JOIN public.profiles p ON p.id = CASE WHEN d.opened_by = auth.uid() THEN d.other_party ELSE d.opened_by END
    WHERE auth.uid() IN (d.opened_by, d.other_party));
END;
$$;
REVOKE ALL ON FUNCTION public.my_marketplace_disputes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_marketplace_disputes() TO authenticated;

-- one dispute with its messages; the two sides see names, staff see the same plus who is who
CREATE OR REPLACE FUNCTION public.marketplace_dispute_detail(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  d public.marketplace_disputes%ROWTYPE;
  v_staff boolean := public.staff_rank(auth.uid()) >= 1;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT * INTO d FROM public.marketplace_disputes WHERE id = p_id;
  IF NOT FOUND OR NOT (v_staff OR auth.uid() IN (d.opened_by, d.other_party)) THEN RAISE EXCEPTION 'That dispute was not found'; END IF;
  IF v_staff AND auth.uid() NOT IN (d.opened_by, d.other_party) AND NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'id', d.id, 'kind', d.kind, 'item', public._mp_item(d.kind, d.booking_id, d.quote_id), 'reason', d.reason, 'description', d.description,
    'amount_claimed', d.amount_claimed, 'status', d.status, 'opener_role', d.opener_role, 'response_due_at', d.response_due_at,
    'outcome', d.outcome, 'outcome_note', d.outcome_note, 'resolution_amount', d.resolution_amount, 'order_id', d.order_id,
    'decided_at', d.decided_at, 'created_at', d.created_at, 'assigned_to', d.assigned_to,
    'i_opened', d.opened_by = auth.uid(), 'i_am_party', auth.uid() IN (d.opened_by, d.other_party),
    'opener', (SELECT jsonb_build_object('id', p.id, 'name', COALESCE(p.full_name, p.username, 'Member')) FROM public.profiles p WHERE p.id = d.opened_by),
    'other', (SELECT jsonb_build_object('id', p.id, 'name', COALESCE(p.full_name, p.username, 'Member')) FROM public.profiles p WHERE p.id = d.other_party),
    'messages', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'id', m.id, 'role', m.author_role, 'body', m.body, 'created_at', m.created_at,
                   'mine', m.author_id = auth.uid(),
                   'name', CASE m.author_role WHEN 'staff' THEN 'CineCraft team'
                                              WHEN 'opener' THEN (SELECT COALESCE(p.full_name, p.username, 'Member') FROM public.profiles p WHERE p.id = d.opened_by)
                                              ELSE (SELECT COALESCE(p.full_name, p.username, 'Member') FROM public.profiles p WHERE p.id = d.other_party) END
                 ) ORDER BY m.created_at), '[]'::jsonb) FROM public.marketplace_dispute_messages m WHERE m.dispute_id = d.id));
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_dispute_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_dispute_detail(uuid) TO authenticated;

-- ── staff ───────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_list_marketplace_disputes(p_status text DEFAULT 'active')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', d.id, 'kind', d.kind, 'item', public._mp_item(d.kind, d.booking_id, d.quote_id), 'reason', d.reason, 'status', d.status,
      'opener_role', d.opener_role, 'amount_claimed', d.amount_claimed, 'created_at', d.created_at, 'response_due_at', d.response_due_at,
      'overdue', d.status = 'awaiting_response' AND d.response_due_at < now(), 'assigned_to', d.assigned_to,
      'opener_name', COALESCE(po.full_name, po.username, 'Member'), 'other_name', COALESCE(pt.full_name, pt.username, 'Member'),
      'outcome', d.outcome,
      -- how often each side has lost a dispute in the last 90 days
      'opener_lost_90d', (SELECT count(*) FROM public.marketplace_disputes x WHERE x.status = 'resolved' AND x.decided_at > now() - interval '90 days'
                           AND ((x.other_party = d.opened_by AND x.outcome = 'favor_opener') OR (x.opened_by = d.opened_by AND x.outcome = 'favor_other'))),
      'other_lost_90d', (SELECT count(*) FROM public.marketplace_disputes x WHERE x.status = 'resolved' AND x.decided_at > now() - interval '90 days'
                          AND ((x.other_party = d.other_party AND x.outcome = 'favor_opener') OR (x.opened_by = d.other_party AND x.outcome = 'favor_other'))),
      'messages', (SELECT count(*) FROM public.marketplace_dispute_messages m WHERE m.dispute_id = d.id)
    ) ORDER BY d.created_at DESC), '[]'::jsonb)
    FROM (SELECT * FROM public.marketplace_disputes
           WHERE (p_status = 'all') OR (p_status = 'active' AND status IN ('awaiting_response', 'under_review')) OR (p_status = status)
           ORDER BY created_at DESC LIMIT 100) d
    LEFT JOIN public.profiles po ON po.id = d.opened_by
    LEFT JOIN public.profiles pt ON pt.id = d.other_party);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_marketplace_disputes(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_list_marketplace_disputes(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_message_marketplace_dispute(p_id uuid, p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  d public.marketplace_disputes%ROWTYPE;
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_body, ''))) < 5 OR length(p_body) > 2000 THEN RAISE EXCEPTION 'Write a message of 5 to 2000 characters'; END IF;
  SELECT * INTO d FROM public.marketplace_disputes WHERE id = p_id AND status IN ('awaiting_response', 'under_review');
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found or closed'; END IF;
  INSERT INTO public.marketplace_dispute_messages (dispute_id, author_id, author_role, body) VALUES (p_id, auth.uid(), 'staff', btrim(p_body));
  UPDATE public.marketplace_disputes SET assigned_to = COALESCE(assigned_to, auth.uid()), updated_at = now() WHERE id = p_id;
  PERFORM public._mp_notify(d.opened_by, 'The team replied to your dispute', 'Our team added a message to the dispute.', p_id);
  PERFORM public._mp_notify(d.other_party, 'The team replied to a dispute', 'Our team added a message to a dispute you are part of.', p_id);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_message_marketplace_dispute(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_message_marketplace_dispute(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_decide_marketplace_dispute(p_id uuid, p_outcome text, p_note text, p_amount numeric DEFAULT NULL, p_order uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  d public.marketplace_disputes%ROWTYPE;
  v_text text;
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can decide a dispute' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF p_outcome NOT IN ('favor_opener', 'favor_other', 'split', 'no_fault') THEN RAISE EXCEPTION 'Choose an outcome'; END IF;
  IF length(btrim(coalesce(p_note, ''))) < 20 OR length(p_note) > 2000 THEN RAISE EXCEPTION 'Explain the decision in 20 to 2000 characters. Both sides will read it.'; END IF;
  IF p_amount IS NOT NULL AND (p_amount < 0 OR p_amount > 10000000) THEN RAISE EXCEPTION 'That amount is not valid'; END IF;
  IF p_amount IS NOT NULL AND p_amount > 0 AND p_outcome NOT IN ('favor_opener', 'split') THEN RAISE EXCEPTION 'An amount only goes with a decision for the person who opened it, or a split'; END IF;
  SELECT * INTO d FROM public.marketplace_disputes WHERE id = p_id AND status IN ('awaiting_response', 'under_review') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found or already decided'; END IF;

  UPDATE public.marketplace_disputes
     SET status = 'resolved', outcome = p_outcome, outcome_note = btrim(p_note), resolution_amount = NULLIF(p_amount, 0),
         order_id = p_order, decided_by = auth.uid(), decided_at = now(), updated_at = now(), assigned_to = COALESCE(assigned_to, auth.uid())
   WHERE id = p_id;
  INSERT INTO public.marketplace_dispute_messages (dispute_id, author_id, author_role, body)
  VALUES (p_id, auth.uid(), 'staff', 'Decision: ' || CASE p_outcome WHEN 'favor_opener' THEN 'in favour of the person who opened the dispute' WHEN 'favor_other' THEN 'in favour of the other side'
                                                                   WHEN 'split' THEN 'a shared outcome' ELSE 'no one at fault' END || '. ' || btrim(p_note));

  v_text := CASE p_outcome WHEN 'favor_opener' THEN 'The team decided in favour of the person who opened it.' WHEN 'favor_other' THEN 'The team decided in favour of the other side.'
                           WHEN 'split' THEN 'The team decided on a shared outcome.' ELSE 'The team found no one at fault.' END;
  PERFORM public._mp_notify(d.opened_by, 'Your dispute was decided', v_text || ' Open it to read the explanation.', p_id);
  PERFORM public._mp_notify(d.other_party, 'A dispute was decided', v_text || ' Open it to read the explanation.', p_id);
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'marketplace_dispute_decided', 'marketplace_dispute', p_id::text,
          jsonb_build_object('outcome', p_outcome, 'amount', p_amount, 'order_id', p_order, 'opened_by', d.opened_by, 'other_party', d.other_party));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_decide_marketplace_dispute(uuid, text, text, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_decide_marketplace_dispute(uuid, text, text, numeric, uuid) TO authenticated;

-- a side that has not answered in five days: the dispute moves to review, and the team is told
CREATE OR REPLACE FUNCTION public.marketplace_disputes_due()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n integer := 0;
  r record;
BEGIN
  FOR r IN
    UPDATE public.marketplace_disputes SET status = 'under_review', updated_at = now()
     WHERE status = 'awaiting_response' AND response_due_at < now() RETURNING id, opened_by
  LOOP
    v_n := v_n + 1;
    PERFORM public._mp_notify(r.opened_by, 'Your dispute is with the team', 'The other side did not answer in time, so the team will review it now.', r.id);
  END LOOP;
  IF v_n > 0 THEN
    PERFORM public.notify_staff('Disputes ready for review', v_n || ' marketplace dispute(s) had no answer in 5 days.', '/admin', 2);
  END IF;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_disputes_due() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname = 'marketplace-disputes-due';
      PERFORM cron.schedule('marketplace-disputes-due', '50 * * * *', $cron$SELECT public.marketplace_disputes_due();$cron$);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule marketplace_disputes_due (%). Call it from your own schedule.', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron is not enabled. Call marketplace_disputes_due() hourly from your own schedule.';
  END IF;
END $$;

COMMIT;
