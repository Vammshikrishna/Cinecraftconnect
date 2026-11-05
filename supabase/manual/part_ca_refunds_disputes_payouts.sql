-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- part_ca: refunds, disputes and payouts, with a second approver for the big ones
--
-- The tables and the ledger already exist (part_bv). This adds the actions on them, so admins can run the money side:
--
--   Refunds    an admin requests a refund. Small ones are approved on the spot; from a threshold up a DIFFERENT admin must
--              approve it, and from a higher threshold a super admin. The refund is then sent to the provider (edge function
--              process-refund) and the provider's confirmation completes it in the ledger.
--   Disputes   a buyer or seller can report a problem with a payment; a provider chargeback opens one automatically. The order
--              is marked disputed and its payout is held until an admin releases it or refunds it.
--   Payouts    what sellers are owed. Orders become payable after a holding period with no dispute. An admin prepares a payout,
--              a second admin approves a large one, and it is recorded as paid (manual for now; a provider payout can use the
--              same records later).
--   Verification  a business verification whose payment was refunded or disputed cannot be approved until an admin records why.
--
-- Nothing here runs in beta: no payments exist, so every list is empty. Run after part_bx (and by, bz).
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ── settings (all in minor units: paise or cents) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.billing_setting_int(p_key text, p_default integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT (s.value #>> '{}')::integer FROM public.platform_settings s WHERE s.key = p_key), p_default);
$$;
REVOKE ALL ON FUNCTION public.billing_setting_int(text, integer) FROM PUBLIC;
-- refund_second_approval_minor  (default 500000  = 5,000)   at or above this a different admin must approve
-- refund_super_admin_minor      (default 5000000 = 50,000)  at or above this a super admin must approve
-- payout_hold_days              (default 7)                 days a payment is held before it is payable
-- payout_second_approval_minor   (default 5000000 = 50,000)  a payout at or above this needs a different admin


-- ── disputes and payouts: the tables ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disputes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES public.orders(id),
  opened_by            text NOT NULL CHECK (opened_by IN ('buyer', 'seller', 'provider')),
  opened_by_user       uuid,
  reason               text NOT NULL,
  status               text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'won', 'lost', 'refunded', 'released', 'closed')),
  amount_minor         integer,
  provider             text,
  provider_dispute_id  text,
  evidence_due_at      timestamptz,
  prev_order_status    text,
  resolution           text,
  resolved_by          uuid,
  resolved_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS disputes_provider_ref ON public.disputes (provider, provider_dispute_id) WHERE provider_dispute_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS disputes_one_open_per_order ON public.disputes (order_id) WHERE status IN ('open', 'under_review');
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS disputes_read_own ON public.disputes;
CREATE POLICY disputes_read_own ON public.disputes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = disputes.order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())));

CREATE TABLE IF NOT EXISTS public.payouts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id          uuid NOT NULL REFERENCES public.profiles(id),
  amount_minor       integer NOT NULL CHECK (amount_minor > 0),
  currency           text NOT NULL DEFAULT 'INR',
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'failed', 'cancelled')),
  requested_by       uuid,
  approved_by        uuid,
  provider           text,
  provider_payout_id text,
  note               text,
  failure_reason     text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  paid_at            timestamptz
);
CREATE TABLE IF NOT EXISTS public.payout_items (
  payout_id     uuid NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
  order_id      uuid NOT NULL UNIQUE REFERENCES public.orders(id),   -- an order is paid out once
  amount_minor  integer NOT NULL CHECK (amount_minor > 0),
  PRIMARY KEY (payout_id, order_id)
);
CREATE TABLE IF NOT EXISTS public.payout_holds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid NOT NULL REFERENCES public.profiles(id),
  reason      text NOT NULL,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  released_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS payout_holds_one_active ON public.payout_holds (seller_id) WHERE released_at IS NULL;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_holds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payouts_read_own ON public.payouts;
CREATE POLICY payouts_read_own ON public.payouts FOR SELECT TO authenticated USING (seller_id = auth.uid());
-- payout_items and payout_holds have no policy: staff reach them through the functions below

-- refunds: one more state ("processing" = sent to the provider, waiting for its confirmation) and room for the decision
DO $$
DECLARE
  c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.refunds'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.refunds DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE public.refunds ADD CONSTRAINT refunds_status_check
    CHECK (status IN ('requested', 'approved', 'processing', 'processed', 'rejected', 'failed'));
END $$;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS decision_note text;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS failure_reason text;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS dispute_id uuid REFERENCES public.disputes(id);


-- ── refunds ─────────────────────────────────────────────────────────────────────────────────────
-- what can still be refunded on an order: what was captured, less every refund that is not rejected or failed
CREATE OR REPLACE FUNCTION public.refundable_minor(p_order uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT sum(p.amount_minor) FROM public.payments p WHERE p.order_id = p_order AND p.status = 'captured'), 0)
       - COALESCE((SELECT sum(r.amount_minor) FROM public.refunds r WHERE r.order_id = p_order AND r.status IN ('requested', 'approved', 'processing', 'processed')), 0);
$$;
REVOKE ALL ON FUNCTION public.refundable_minor(uuid) FROM PUBLIC;

-- one place creates a refund, whoever asked (an admin, or a dispute decision)
CREATE OR REPLACE FUNCTION public._create_refund(p_order uuid, p_amount integer, p_reason text, p_requester uuid, p_dispute uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_small integer := public.billing_setting_int('refund_second_approval_minor', 500000);
  v_super integer := public.billing_setting_int('refund_super_admin_minor', 5000000);
  v_payment uuid;
  v_status text;
  v_id uuid;
BEGIN
  IF COALESCE(trim(p_reason), '') = '' OR char_length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Give a reason of at least a few words';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Enter an amount';
  END IF;
  SELECT p.id INTO v_payment FROM public.payments p WHERE p.order_id = p_order AND p.status = 'captured' ORDER BY p.created_at LIMIT 1;
  IF v_payment IS NULL THEN
    RAISE EXCEPTION 'This order has no captured payment to refund';
  END IF;
  IF p_amount > public.refundable_minor(p_order) THEN
    RAISE EXCEPTION 'That is more than can still be refunded on this order';
  END IF;

  v_status := CASE WHEN p_amount < v_small THEN 'approved' ELSE 'requested' END;
  INSERT INTO public.refunds (order_id, payment_id, amount_minor, reason, requested_by, approved_by, status, approved_at, dispute_id)
  VALUES (p_order, v_payment, p_amount, left(trim(p_reason), 500), p_requester,
          CASE WHEN v_status = 'approved' THEN p_requester END, v_status, CASE WHEN v_status = 'approved' THEN now() END, p_dispute)
  RETURNING id INTO v_id;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.refund_requested', p_requester, v_id::text, 'refund', left(trim(p_reason), 300),
          jsonb_build_object('order_id', p_order, 'amount_minor', p_amount, 'status', v_status));

  IF v_status = 'requested' THEN
    PERFORM public.notify_staff('Refund waiting for approval', left(trim(p_reason), 120), '/admin?tab=payments',
                                CASE WHEN p_amount >= v_super THEN 3 ELSE 2 END, p_requester);
  END IF;
  RETURN jsonb_build_object('refund_id', v_id, 'status', v_status);
END;
$$;
REVOKE ALL ON FUNCTION public._create_refund(uuid, integer, text, uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.staff_request_refund(p_order_id uuid, p_amount_minor integer, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Only admins can request refunds';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN public._create_refund(p_order_id, p_amount_minor, p_reason, auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.staff_request_refund(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_request_refund(uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_decide_refund(p_refund_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.refunds%ROWTYPE;
  v_super integer := public.billing_setting_int('refund_super_admin_minor', 5000000);
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Only admins can decide refunds';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  SELECT * INTO r FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF r.status <> 'requested' THEN RAISE EXCEPTION 'This refund has already been decided'; END IF;
  IF r.requested_by = auth.uid() THEN
    RAISE EXCEPTION 'Dual control: you cannot approve a refund you requested. Another admin has to.';
  END IF;
  IF r.amount_minor >= v_super AND public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'A refund this large needs a super admin to approve it';
  END IF;

  UPDATE public.refunds
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         approved_by = auth.uid(), approved_at = now(), decision_note = left(trim(COALESCE(p_note, '')), 500)
   WHERE id = p_refund_id;

  -- a refused refund puts the dispute it came from back under review, so it is not left looking resolved
  IF NOT p_approve AND r.dispute_id IS NOT NULL THEN
    UPDATE public.disputes SET status = 'under_review', resolution = NULL, resolved_by = NULL, resolved_at = NULL WHERE id = r.dispute_id;
  END IF;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES (CASE WHEN p_approve THEN 'billing.refund_approved' ELSE 'billing.refund_rejected' END, auth.uid(), p_refund_id::text, 'refund',
          COALESCE(left(p_note, 300), 'Refund decided'), jsonb_build_object('order_id', r.order_id, 'amount_minor', r.amount_minor));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_decide_refund(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_decide_refund(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_list_refunds(p_status text DEFAULT 'all')
RETURNS TABLE (
  refund_id uuid, order_id uuid, item text, buyer_name text, buyer_username text, amount_minor integer, order_total_minor integer,
  currency text, reason text, status text, requested_by_name text, approved_by_name text, decision_note text, failure_reason text,
  created_at timestamptz, can_decide boolean, needs_super boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_super integer := public.billing_setting_int('refund_super_admin_minor', 5000000);
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Only admins can see refunds';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN QUERY
  SELECT r.id, o.id, COALESCE(pr.name, pl.name, o.kind), COALESCE(bp.full_name, bp.username), bp.username,
         r.amount_minor, o.amount_minor + o.tax_minor, o.currency, r.reason, r.status,
         COALESCE(rq.full_name, rq.username), COALESCE(ap.full_name, ap.username), r.decision_note, r.failure_reason, r.created_at,
         (r.status = 'requested' AND r.requested_by IS DISTINCT FROM auth.uid() AND (r.amount_minor < v_super OR public.staff_rank(auth.uid()) >= 3)),
         r.amount_minor >= v_super
  FROM public.refunds r
  JOIN public.orders o ON o.id = r.order_id
  LEFT JOIN public.products pr ON pr.code = o.product_code
  LEFT JOIN public.plans pl ON pl.code = o.plan_code
  LEFT JOIN public.profiles bp ON bp.id = o.buyer_id
  LEFT JOIN public.profiles rq ON rq.id = r.requested_by
  LEFT JOIN public.profiles ap ON ap.id = r.approved_by
  WHERE p_status = 'all' OR r.status = p_status
  ORDER BY (r.status IN ('requested', 'approved', 'processing')) DESC, r.created_at DESC
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_refunds(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_refunds(text) TO authenticated;

-- server only: take an approved refund to send to the provider, and record what happened
CREATE OR REPLACE FUNCTION public.billing_claim_refund(p_refund_id uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.refunds%ROWTYPE;
  v_pay public.payments%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only'; END IF;
  IF public.staff_rank(p_actor) < 2 THEN RAISE EXCEPTION 'Only admins can send refunds'; END IF;
  SELECT * INTO r FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF r.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved refund can be sent'; END IF;
  SELECT * INTO v_pay FROM public.payments WHERE id = r.payment_id;
  UPDATE public.refunds SET status = 'processing' WHERE id = r.id;
  RETURN jsonb_build_object('refund_id', r.id, 'order_id', r.order_id, 'amount_minor', r.amount_minor,
                            'provider', v_pay.provider, 'provider_payment_id', v_pay.provider_payment_id, 'currency', v_pay.currency, 'reason', r.reason);
END;
$$;
REVOKE ALL ON FUNCTION public.billing_claim_refund(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_claim_refund(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.billing_fail_refund(p_refund_id uuid, p_error text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only'; END IF;
  UPDATE public.refunds SET status = 'failed', failure_reason = left(COALESCE(p_error, 'The provider refused the refund'), 300)
   WHERE id = p_refund_id AND status = 'processing';
END;
$$;
REVOKE ALL ON FUNCTION public.billing_fail_refund(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_fail_refund(uuid, text) TO service_role;

-- a failed refund goes back to "approved" so it can be sent again (the second approval is not asked twice)
CREATE OR REPLACE FUNCTION public.staff_retry_refund(p_refund_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can retry refunds'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  UPDATE public.refunds SET status = 'approved', failure_reason = NULL WHERE id = p_refund_id AND status = 'failed';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a failed refund can be retried'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_retry_refund(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_retry_refund(uuid) TO authenticated;


-- ── disputes ────────────────────────────────────────────────────────────────────────────────────
-- a buyer or seller reports a problem with a payment (within 60 days of it)
CREATE OR REPLACE FUNCTION public.open_order_dispute(p_order_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  v_id uuid;
  v_party text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF COALESCE(char_length(trim(p_reason)), 0) < 10 THEN RAISE EXCEPTION 'Tell us what went wrong, in a sentence or two'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR (o.buyer_id <> auth.uid() AND o.seller_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status NOT IN ('paid', 'fulfilled', 'settled') THEN RAISE EXCEPTION 'Only a paid order can be reported'; END IF;
  IF o.created_at < now() - interval '60 days' THEN RAISE EXCEPTION 'This payment is too old to report. Contact support.'; END IF;
  v_party := CASE WHEN o.buyer_id = auth.uid() THEN 'buyer' ELSE 'seller' END;

  INSERT INTO public.disputes (order_id, opened_by, opened_by_user, reason, amount_minor, prev_order_status)
  VALUES (o.id, v_party, auth.uid(), left(trim(p_reason), 1000), o.amount_minor + o.tax_minor, o.status)
  RETURNING id INTO v_id;
  UPDATE public.orders SET status = 'disputed', updated_at = now() WHERE id = o.id;

  PERFORM public.notify_staff('Payment problem reported', left(trim(p_reason), 120), '/admin?tab=payments', 2, NULL);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.open_order_dispute(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_order_dispute(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_list_disputes(p_status text DEFAULT 'open')
RETURNS TABLE (
  dispute_id uuid, order_id uuid, item text, buyer_name text, seller_name text, opened_by text, reason text, status text,
  amount_minor integer, currency text, provider text, evidence_due_at timestamptz, resolution text, created_at timestamptz, refundable_minor bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can see disputes'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  RETURN QUERY
  SELECT d.id, o.id, COALESCE(pr.name, pl.name, o.kind), COALESCE(bp.full_name, bp.username), COALESCE(sp.full_name, sp.username),
         d.opened_by, d.reason, d.status, d.amount_minor, o.currency, d.provider, d.evidence_due_at, d.resolution, d.created_at,
         public.refundable_minor(o.id)
  FROM public.disputes d
  JOIN public.orders o ON o.id = d.order_id
  LEFT JOIN public.products pr ON pr.code = o.product_code
  LEFT JOIN public.plans pl ON pl.code = o.plan_code
  LEFT JOIN public.profiles bp ON bp.id = o.buyer_id
  LEFT JOIN public.profiles sp ON sp.id = o.seller_id
  WHERE (p_status = 'all' OR (p_status = 'open' AND d.status IN ('open', 'under_review')) OR d.status = p_status)
  ORDER BY (d.status IN ('open', 'under_review')) DESC, d.evidence_due_at NULLS LAST, d.created_at DESC
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_disputes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_disputes(text) TO authenticated;

-- decide a dispute: release the order (the payment stands), or refund all or part of it (which goes through the refund approval)
CREATE OR REPLACE FUNCTION public.staff_resolve_dispute(p_id uuid, p_outcome text, p_amount_minor integer, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.disputes%ROWTYPE;
  v_refund jsonb;
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can decide disputes'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  IF COALESCE(char_length(trim(p_note)), 0) < 5 THEN RAISE EXCEPTION 'Write down why you decided this'; END IF;
  SELECT * INTO d FROM public.disputes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;
  IF d.status NOT IN ('open', 'under_review') THEN RAISE EXCEPTION 'This dispute is already closed'; END IF;
  IF d.opened_by = 'provider' THEN RAISE EXCEPTION 'A chargeback is decided by the provider. Add evidence there; the result arrives by itself.'; END IF;

  IF p_outcome = 'release' THEN
    UPDATE public.orders SET status = COALESCE(d.prev_order_status, 'paid'), updated_at = now() WHERE id = d.order_id AND status = 'disputed';
    UPDATE public.disputes SET status = 'released', resolution = left(trim(p_note), 500), resolved_by = auth.uid(), resolved_at = now() WHERE id = d.id;
  ELSIF p_outcome IN ('refund', 'partial_refund') THEN
    v_refund := public._create_refund(d.order_id,
                  CASE WHEN p_outcome = 'refund' THEN public.refundable_minor(d.order_id)::integer ELSE p_amount_minor END,
                  'Dispute: ' || left(trim(p_note), 400), auth.uid(), d.id);
    UPDATE public.disputes SET status = 'refunded', resolution = left(trim(p_note), 500), resolved_by = auth.uid(), resolved_at = now() WHERE id = d.id;
  ELSE
    RAISE EXCEPTION 'Choose release, refund or partial refund';
  END IF;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.dispute_resolved', auth.uid(), p_id::text, 'dispute', left(trim(p_note), 300), jsonb_build_object('outcome', p_outcome, 'order_id', d.order_id));
  RETURN COALESCE(v_refund, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_resolve_dispute(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_resolve_dispute(uuid, text, integer, text) TO authenticated;


-- ── billing_apply_event: refunds that we started, and chargebacks ───────────────────────────────
-- (replaces part_bv's version: the refund branch now completes OUR refund instead of adding a second one, and two new
--  event types, dispute.opened and dispute.closed, handle provider chargebacks)
CREATE OR REPLACE FUNCTION public.billing_apply_event(p_event jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := p_event ->> 'type';
  v_order public.orders%ROWTYPE;
  v_group uuid := gen_random_uuid();
  v_amount integer;
  v_fee integer;
  v_status text;
  v_refund_id uuid;
  v_refund_status text;
  v_dispute public.disputes%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only the server may apply billing events';
  END IF;

  IF v_type = 'payment.captured' THEN
    SELECT * INTO v_order FROM public.orders WHERE id = (p_event ->> 'order_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RETURN 'order_not_found'; END IF;
    IF v_order.status IN ('paid', 'fulfilled', 'settled', 'refunded', 'partially_refunded', 'disputed') THEN RETURN 'already_applied'; END IF;
    v_amount := (p_event ->> 'amount_minor')::integer;
    IF v_amount <> v_order.amount_minor + v_order.tax_minor THEN
      RETURN 'amount_mismatch';                                   -- never trust a payment that does not match the order
    END IF;

    INSERT INTO public.payments (order_id, provider, provider_payment_id, amount_minor, currency, status, method)
    VALUES (v_order.id, p_event ->> 'provider', p_event ->> 'provider_payment_id', v_amount, v_order.currency, 'captured', p_event ->> 'method')
    ON CONFLICT (provider, provider_payment_id) DO NOTHING;

    UPDATE public.orders SET status = 'paid', updated_at = now() WHERE id = v_order.id;

    v_fee := v_order.fee_minor;
    INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, order_id, kind)
    VALUES (v_group, 'provider_clearing', 'debit', v_amount, v_order.currency, v_order.id, 'payment');
    IF v_order.seller_id IS NULL THEN
      INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, order_id, kind)
      VALUES (v_group, 'platform_revenue', 'credit', v_order.amount_minor, v_order.currency, v_order.id, 'payment');
    ELSE
      INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, order_id, kind)
      VALUES (v_group, 'seller_payable:' || v_order.seller_id::text, 'credit', v_order.amount_minor - v_fee, v_order.currency, v_order.id, 'payment');
      IF v_fee > 0 THEN
        INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, order_id, kind)
        VALUES (v_group, 'platform_fee', 'credit', v_fee, v_order.currency, v_order.id, 'payment');
      END IF;
    END IF;
    IF v_order.tax_minor > 0 THEN
      INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, order_id, kind)
      VALUES (v_group, 'tax_payable', 'credit', v_order.tax_minor, v_order.currency, v_order.id, 'payment');
    END IF;
    RETURN 'applied';

  ELSIF v_type = 'payment.failed' THEN
    SELECT * INTO v_order FROM public.orders WHERE id = (p_event ->> 'order_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RETURN 'order_not_found'; END IF;
    INSERT INTO public.payments (order_id, provider, provider_payment_id, amount_minor, currency, status, failure_reason)
    VALUES (v_order.id, p_event ->> 'provider', p_event ->> 'provider_payment_id', v_order.amount_minor + v_order.tax_minor, v_order.currency, 'failed', left(p_event ->> 'reason', 300))
    ON CONFLICT (provider, provider_payment_id) DO NOTHING;
    RETURN 'applied';

  ELSIF v_type = 'refund.processed' THEN
    SELECT * INTO v_order FROM public.orders WHERE id = (p_event ->> 'order_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RETURN 'order_not_found'; END IF;
    v_amount := (p_event ->> 'amount_minor')::integer;

    -- our own refund (by its id or by the provider's reference), or one the provider started
    SELECT r.id, r.status INTO v_refund_id, v_refund_status FROM public.refunds r
     WHERE (p_event ? 'refund_request_id' AND r.id = (p_event ->> 'refund_request_id')::uuid)
        OR (p_event ->> 'provider_refund_id' IS NOT NULL AND r.provider_refund_id = p_event ->> 'provider_refund_id')
     LIMIT 1;
    IF v_refund_id IS NOT NULL AND v_refund_status = 'processed' THEN RETURN 'already_applied'; END IF;

    IF v_refund_id IS NULL THEN
      INSERT INTO public.refunds (order_id, amount_minor, reason, status, provider_refund_id)
      VALUES (v_order.id, v_amount, COALESCE(p_event ->> 'reason', 'Refund'), 'processed', p_event ->> 'provider_refund_id')
      RETURNING id INTO v_refund_id;
    ELSE
      UPDATE public.refunds SET status = 'processed', provider_refund_id = COALESCE(p_event ->> 'provider_refund_id', provider_refund_id) WHERE id = v_refund_id;
    END IF;

    INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, order_id, kind)
    VALUES (v_group, 'refunds', 'debit', v_amount, v_order.currency, v_order.id, 'refund'),
           (v_group, 'provider_clearing', 'credit', v_amount, v_order.currency, v_order.id, 'refund');
    v_status := CASE WHEN COALESCE((SELECT sum(r.amount_minor) FROM public.refunds r WHERE r.order_id = v_order.id AND r.status = 'processed'), 0) >= v_order.amount_minor + v_order.tax_minor
                     THEN 'refunded' ELSE 'partially_refunded' END;
    UPDATE public.orders SET status = v_status, updated_at = now() WHERE id = v_order.id;

    INSERT INTO public.notifications (user_id, title, message, type, priority, action_url)
    VALUES (v_order.buyer_id, 'Your refund has been sent', 'We have sent your refund. It can take a few days to reach your account.', 'payment_refunded', 'medium', '/payments');
    RETURN 'applied';

  ELSIF v_type = 'dispute.opened' THEN
    SELECT o.* INTO v_order FROM public.orders o
     WHERE o.id = NULLIF(p_event ->> 'order_id', '')::uuid
        OR o.id = (SELECT p.order_id FROM public.payments p WHERE p.provider = p_event ->> 'provider' AND p.provider_payment_id = p_event ->> 'provider_payment_id' LIMIT 1)
     LIMIT 1;
    IF NOT FOUND THEN RETURN 'order_not_found'; END IF;
    INSERT INTO public.disputes (order_id, opened_by, reason, amount_minor, provider, provider_dispute_id, evidence_due_at, prev_order_status)
    VALUES (v_order.id, 'provider', COALESCE(left(p_event ->> 'reason', 500), 'Chargeback'), (p_event ->> 'amount_minor')::integer,
            p_event ->> 'provider', p_event ->> 'provider_dispute_id', (p_event ->> 'evidence_due_at')::timestamptz, v_order.status)
    ON CONFLICT (provider, provider_dispute_id) WHERE provider_dispute_id IS NOT NULL DO NOTHING;
    UPDATE public.orders SET status = 'disputed', updated_at = now() WHERE id = v_order.id AND status <> 'disputed';
    PERFORM public.notify_staff('Chargeback opened', COALESCE(left(p_event ->> 'reason', 120), 'A payment was disputed with the bank'), '/admin?tab=payments', 2, NULL);
    RETURN 'applied';

  ELSIF v_type = 'dispute.closed' THEN
    SELECT * INTO v_dispute FROM public.disputes WHERE provider = p_event ->> 'provider' AND provider_dispute_id = p_event ->> 'provider_dispute_id' FOR UPDATE;
    IF NOT FOUND THEN RETURN 'dispute_not_found'; END IF;
    IF v_dispute.status IN ('won', 'lost', 'closed') THEN RETURN 'already_applied'; END IF;
    SELECT * INTO v_order FROM public.orders WHERE id = v_dispute.order_id FOR UPDATE;
    IF p_event ->> 'outcome' = 'won' THEN
      UPDATE public.disputes SET status = 'won', resolved_at = now(), resolution = 'Won with the provider' WHERE id = v_dispute.id;
      UPDATE public.orders SET status = COALESCE(v_dispute.prev_order_status, 'paid'), updated_at = now() WHERE id = v_order.id AND status = 'disputed';
    ELSE
      -- lost: the bank took the money back
      UPDATE public.disputes SET status = 'lost', resolved_at = now(), resolution = 'Lost with the provider' WHERE id = v_dispute.id;
      v_amount := COALESCE(v_dispute.amount_minor, v_order.amount_minor + v_order.tax_minor);
      INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, order_id, kind)
      VALUES (v_group, 'chargebacks', 'debit', v_amount, v_order.currency, v_order.id, 'chargeback'),
             (v_group, 'provider_clearing', 'credit', v_amount, v_order.currency, v_order.id, 'chargeback');
      UPDATE public.orders SET status = 'refunded', updated_at = now() WHERE id = v_order.id;
    END IF;
    RETURN 'applied';

  ELSIF v_type IN ('subscription.activated', 'subscription.renewed') THEN
    INSERT INTO public.subscriptions (owner_type, owner_id, plan_code, status, billing_interval, current_period_start, current_period_end,
                                      provider, provider_customer_id, provider_subscription_id)
    VALUES (p_event ->> 'owner_type', (p_event ->> 'owner_id')::uuid, p_event ->> 'plan_code', 'active', p_event ->> 'interval',
            (p_event ->> 'period_start')::timestamptz, (p_event ->> 'period_end')::timestamptz,
            p_event ->> 'provider', p_event ->> 'provider_customer_id', p_event ->> 'provider_subscription_id')
    ON CONFLICT (owner_type, owner_id) WHERE status IN ('beta', 'trialing', 'active', 'past_due')
    DO UPDATE SET plan_code = EXCLUDED.plan_code, status = 'active', billing_interval = EXCLUDED.billing_interval,
                  current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end,
                  provider = EXCLUDED.provider, provider_customer_id = EXCLUDED.provider_customer_id,
                  provider_subscription_id = EXCLUDED.provider_subscription_id, cancel_at_period_end = false, updated_at = now();
    RETURN 'applied';

  ELSIF v_type = 'subscription.past_due' THEN
    UPDATE public.subscriptions SET status = 'past_due', updated_at = now()
     WHERE provider = p_event ->> 'provider' AND provider_subscription_id = p_event ->> 'provider_subscription_id';
    RETURN 'applied';

  ELSIF v_type IN ('subscription.cancelled', 'subscription.expired') THEN
    UPDATE public.subscriptions
       SET status = CASE WHEN v_type = 'subscription.expired' THEN 'expired' ELSE 'cancelled' END, updated_at = now()
     WHERE provider = p_event ->> 'provider' AND provider_subscription_id = p_event ->> 'provider_subscription_id';
    RETURN 'applied';
  END IF;

  RETURN 'ignored';
END;
$$;
REVOKE ALL ON FUNCTION public.billing_apply_event(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_apply_event(jsonb) TO service_role;


-- ── payouts ─────────────────────────────────────────────────────────────────────────────────────
-- orders a seller can be paid for now: paid, past the holding period, not disputed or refunded, not paid out already
CREATE OR REPLACE VIEW public.v_releasable_orders AS
SELECT o.id AS order_id, o.seller_id, o.currency, (o.amount_minor - o.fee_minor) AS payable_minor,
       (SELECT min(p.created_at) FROM public.payments p WHERE p.order_id = o.id AND p.status = 'captured') AS paid_at
FROM public.orders o
WHERE o.seller_id IS NOT NULL
  AND o.status IN ('paid', 'fulfilled', 'settled')
  AND NOT EXISTS (SELECT 1 FROM public.payout_items pi WHERE pi.order_id = o.id)
  AND NOT EXISTS (SELECT 1 FROM public.disputes d WHERE d.order_id = o.id AND d.status IN ('open', 'under_review'))
  AND (SELECT min(p.created_at) FROM public.payments p WHERE p.order_id = o.id AND p.status = 'captured')
        <= now() - make_interval(days => public.billing_setting_int('payout_hold_days', 7));
REVOKE ALL ON public.v_releasable_orders FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_list_payables()
RETURNS TABLE (
  seller_id uuid, seller_name text, seller_username text, currency text, payable_minor bigint, orders integer, oldest_paid_at timestamptz,
  waiting_minor bigint, on_hold boolean, hold_reason text, is_banned boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can see payouts'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  RETURN QUERY
  SELECT s.seller_id, COALESCE(p.full_name, p.username), p.username, s.currency,
         COALESCE(rel.payable, 0)::bigint, COALESCE(rel.n, 0)::int, rel.oldest,
         COALESCE(wait.payable, 0)::bigint,
         EXISTS (SELECT 1 FROM public.payout_holds h WHERE h.seller_id = s.seller_id AND h.released_at IS NULL),
         (SELECT h.reason FROM public.payout_holds h WHERE h.seller_id = s.seller_id AND h.released_at IS NULL LIMIT 1),
         COALESCE(p.is_banned, false)
  FROM (SELECT DISTINCT o.seller_id, o.currency FROM public.orders o
         WHERE o.seller_id IS NOT NULL AND o.status IN ('paid', 'fulfilled', 'settled', 'disputed')) s
  LEFT JOIN public.profiles p ON p.id = s.seller_id
  LEFT JOIN LATERAL (SELECT sum(v.payable_minor) AS payable, count(*) AS n, min(v.paid_at) AS oldest FROM public.v_releasable_orders v
                      WHERE v.seller_id = s.seller_id AND v.currency = s.currency) rel ON true
  LEFT JOIN LATERAL (SELECT sum(o.amount_minor - o.fee_minor) AS payable FROM public.orders o
                      WHERE o.seller_id = s.seller_id AND o.currency = s.currency AND o.status IN ('paid', 'fulfilled', 'settled', 'disputed')
                        AND NOT EXISTS (SELECT 1 FROM public.payout_items pi WHERE pi.order_id = o.id)
                        AND o.id NOT IN (SELECT v2.order_id FROM public.v_releasable_orders v2)) wait ON true
  WHERE COALESCE(rel.payable, 0) > 0 OR COALESCE(wait.payable, 0) > 0
  ORDER BY COALESCE(rel.payable, 0) DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_payables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_payables() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_create_payout(p_seller uuid, p_currency text DEFAULT 'INR', p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_id uuid;
  v_status text;
  v_big integer := public.billing_setting_int('payout_second_approval_minor', 5000000);
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can prepare payouts'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  IF public.is_staff_user(p_seller) THEN RAISE EXCEPTION 'Staff accounts are not paid out'; END IF;
  IF EXISTS (SELECT 1 FROM public.payout_holds h WHERE h.seller_id = p_seller AND h.released_at IS NULL) THEN
    RAISE EXCEPTION 'This seller is on hold. Release the hold first.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_seller AND COALESCE(pr.is_banned, false)) THEN
    RAISE EXCEPTION 'This account is banned, so it cannot be paid out';
  END IF;

  SELECT COALESCE(sum(v.payable_minor), 0) INTO v_total FROM public.v_releasable_orders v WHERE v.seller_id = p_seller AND v.currency = p_currency;
  IF v_total <= 0 THEN RAISE EXCEPTION 'Nothing is payable yet'; END IF;

  v_status := CASE WHEN v_total < v_big THEN 'approved' ELSE 'pending' END;
  INSERT INTO public.payouts (seller_id, amount_minor, currency, status, requested_by, approved_by, note)
  VALUES (p_seller, v_total, p_currency, v_status, auth.uid(), CASE WHEN v_status = 'approved' THEN auth.uid() END, left(trim(COALESCE(p_note, '')), 300))
  RETURNING id INTO v_id;

  INSERT INTO public.payout_items (payout_id, order_id, amount_minor)
  SELECT v_id, v.order_id, v.payable_minor FROM public.v_releasable_orders v WHERE v.seller_id = p_seller AND v.currency = p_currency
  ON CONFLICT (order_id) DO NOTHING;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.payout_prepared', auth.uid(), v_id::text, 'payout', COALESCE(left(p_note, 200), 'Payout prepared'),
          jsonb_build_object('seller', p_seller, 'amount_minor', v_total, 'status', v_status));
  IF v_status = 'pending' THEN
    PERFORM public.notify_staff('Payout waiting for approval', 'A large payout needs a second admin', '/admin?tab=payments', 2, auth.uid());
  END IF;
  RETURN jsonb_build_object('payout_id', v_id, 'status', v_status, 'amount_minor', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_create_payout(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_create_payout(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_decide_payout(p_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  po public.payouts%ROWTYPE;
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can decide payouts'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  SELECT * INTO po FROM public.payouts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout not found'; END IF;
  IF po.status <> 'pending' THEN RAISE EXCEPTION 'This payout has already been decided'; END IF;
  IF po.requested_by = auth.uid() THEN RAISE EXCEPTION 'Dual control: another admin has to approve the payout you prepared.'; END IF;

  IF p_approve THEN
    UPDATE public.payouts SET status = 'approved', approved_by = auth.uid() WHERE id = p_id;
  ELSE
    UPDATE public.payouts SET status = 'cancelled', approved_by = auth.uid(), failure_reason = left(trim(COALESCE(p_note, 'Rejected')), 300) WHERE id = p_id;
    DELETE FROM public.payout_items WHERE payout_id = p_id;          -- the orders become payable again
  END IF;
  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES (CASE WHEN p_approve THEN 'billing.payout_approved' ELSE 'billing.payout_rejected' END, auth.uid(), p_id::text, 'payout',
          COALESCE(left(p_note, 300), 'Payout decided'), jsonb_build_object('amount_minor', po.amount_minor));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_decide_payout(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_decide_payout(uuid, boolean, text) TO authenticated;

-- the money has been sent (by bank transfer or the provider): record it, and the ledger shows the seller is no longer owed it
CREATE OR REPLACE FUNCTION public.staff_mark_payout_paid(p_id uuid, p_reference text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  po public.payouts%ROWTYPE;
  v_group uuid := gen_random_uuid();
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can record payouts'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  IF COALESCE(char_length(trim(p_reference)), 0) < 3 THEN RAISE EXCEPTION 'Enter the bank or provider reference of the transfer'; END IF;
  SELECT * INTO po FROM public.payouts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout not found'; END IF;
  IF po.status NOT IN ('approved', 'processing') THEN RAISE EXCEPTION 'Only an approved payout can be marked as paid'; END IF;

  UPDATE public.payouts SET status = 'paid', paid_at = now(), provider_payout_id = left(trim(p_reference), 120) WHERE id = p_id;
  INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, kind)
  VALUES (v_group, 'seller_payable:' || po.seller_id::text, 'debit', po.amount_minor, po.currency, 'payout'),
         (v_group, 'payouts_sent', 'credit', po.amount_minor, po.currency, 'payout');
  INSERT INTO public.notifications (user_id, title, message, type, priority, action_url)
  VALUES (po.seller_id, 'Your payout is on its way', 'We have sent your payout. It can take a few days to reach your bank.', 'payout_paid', 'medium', '/payments');
  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.payout_paid', auth.uid(), p_id::text, 'payout', left(trim(p_reference), 200), jsonb_build_object('amount_minor', po.amount_minor));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_mark_payout_paid(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_mark_payout_paid(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_set_payout_hold(p_seller uuid, p_on boolean, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can hold payouts'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  IF COALESCE(char_length(trim(p_reason)), 0) < 5 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF p_on THEN
    INSERT INTO public.payout_holds (seller_id, reason, created_by) VALUES (p_seller, left(trim(p_reason), 300), auth.uid()) ON CONFLICT DO NOTHING;
  ELSE
    UPDATE public.payout_holds SET released_at = now(), released_by = auth.uid() WHERE seller_id = p_seller AND released_at IS NULL;
  END IF;
  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES (CASE WHEN p_on THEN 'billing.payout_hold' ELSE 'billing.payout_release' END, auth.uid(), p_seller::text, 'user', left(trim(p_reason), 300), '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_set_payout_hold(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_set_payout_hold(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_list_payouts(p_status text DEFAULT 'all')
RETURNS TABLE (
  payout_id uuid, seller_name text, seller_username text, amount_minor integer, currency text, status text, orders integer,
  requested_by_name text, approved_by_name text, reference text, note text, failure_reason text, created_at timestamptz, paid_at timestamptz,
  can_decide boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can see payouts'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  RETURN QUERY
  SELECT po.id, COALESCE(sp.full_name, sp.username), sp.username, po.amount_minor, po.currency, po.status,
         (SELECT count(*)::int FROM public.payout_items pi WHERE pi.payout_id = po.id),
         COALESCE(rq.full_name, rq.username), COALESCE(ap.full_name, ap.username), po.provider_payout_id, po.note, po.failure_reason,
         po.created_at, po.paid_at,
         (po.status = 'pending' AND po.requested_by IS DISTINCT FROM auth.uid())
  FROM public.payouts po
  LEFT JOIN public.profiles sp ON sp.id = po.seller_id
  LEFT JOIN public.profiles rq ON rq.id = po.requested_by
  LEFT JOIN public.profiles ap ON ap.id = po.approved_by
  WHERE p_status = 'all' OR po.status = p_status
  ORDER BY (po.status IN ('pending', 'approved')) DESC, po.created_at DESC
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_payouts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_payouts(text) TO authenticated;


-- ── a refunded or disputed verification cannot be approved until an admin says why ──────────────
ALTER TABLE public.vendor_verification_requests ADD COLUMN IF NOT EXISTS payment_override_by uuid;
ALTER TABLE public.vendor_verification_requests ADD COLUMN IF NOT EXISTS payment_override_reason text;

CREATE OR REPLACE FUNCTION public.verification_payment_problem(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT o.status IN ('refunded', 'partially_refunded', 'disputed')
        OR EXISTS (SELECT 1 FROM public.refunds rf WHERE rf.order_id = o.id AND rf.status IN ('processing', 'processed'))
    FROM public.vendor_verification_requests r JOIN public.orders o ON o.id = r.order_id
    WHERE r.id = p_request_id
  ), false);
$$;
REVOKE ALL ON FUNCTION public.verification_payment_problem(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.staff_override_verification_payment(p_request_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can override this'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  IF COALESCE(char_length(trim(p_reason)), 0) < 10 THEN RAISE EXCEPTION 'Explain why this review should go ahead despite the payment problem'; END IF;
  UPDATE public.vendor_verification_requests
     SET payment_override_by = auth.uid(), payment_override_reason = left(trim(p_reason), 500)
   WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'That request is not waiting for review'; END IF;
  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('verification.payment_override', auth.uid(), p_request_id::text, 'vendor_verification_request', left(trim(p_reason), 300), '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_override_verification_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_override_verification_payment(uuid, text) TO authenticated;

-- the existing review function (part_r), unchanged except for the new refusal below
CREATE OR REPLACE FUNCTION public.review_vendor_verification(p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req vendor_verification_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.is_market_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not allowed');
  END IF;
  SELECT * INTO v_req FROM vendor_verification_requests WHERE id = p_request_id;
  IF v_req.id IS NULL OR v_req.status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'message', 'Request not found or already reviewed'); END IF;

  -- NEW: a payment that was refunded or disputed blocks an approval until an admin records an override (rejecting is always allowed)
  IF p_approve AND public.billing_mode() = 'live' AND public.verification_payment_problem(p_request_id) AND v_req.payment_override_by IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'The payment for this review was refunded or disputed. Record an override reason before approving.');
  END IF;

  UPDATE vendor_verification_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, reviewed_by = v_uid, reviewed_at = now(), review_note = NULLIF(trim(COALESCE(p_note, '')), '')
  WHERE id = p_request_id;

  IF p_approve THEN
    PERFORM set_config('app.market_system', '1', true);
    UPDATE vendors SET is_verified = true, verification_date = now() WHERE id = v_req.vendor_id;
    PERFORM set_config('app.market_system', '', true);
  END IF;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (v_req.owner_id, v_uid, 'vendor_verification',
          CASE WHEN p_approve THEN 'Your business is verified' ELSE 'Verification not approved' END,
          CASE WHEN p_approve THEN 'Your vendor profile now shows the verified badge.'
               ELSE 'We could not verify your business.' || CASE WHEN p_note IS NOT NULL AND length(trim(p_note)) > 0 THEN ' Note: ' || p_note ELSE '' END END,
          '/vendors/' || v_req.vendor_id::text, v_req.vendor_id, false);
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_vendor_verification(uuid, boolean, text) TO authenticated;

-- the payment note on each request now also says whether an override is needed (the columns changed, so the old version goes)
DROP FUNCTION IF EXISTS public.staff_verification_payments(uuid[]);
CREATE OR REPLACE FUNCTION public.staff_verification_payments(p_request_ids uuid[])
RETURNS TABLE (
  request_id uuid, order_id uuid, amount_minor integer, tax_minor integer, currency text,
  paid_at timestamptz, order_status text, refunded_minor bigint, submissions_left integer,
  payment_problem boolean, override_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT (public.is_market_admin() OR public.staff_rank(auth.uid()) >= 2) THEN
    RAISE EXCEPTION 'Only reviewers can see this';
  END IF;
  RETURN QUERY
  SELECT r.id, o.id, o.amount_minor, o.tax_minor, o.currency,
         (SELECT min(p.created_at) FROM public.payments p WHERE p.order_id = o.id AND p.status = 'captured'),
         o.status,
         COALESCE((SELECT sum(rf.amount_minor) FROM public.refunds rf WHERE rf.order_id = o.id AND rf.status IN ('processing', 'processed')), 0)::bigint,
         (SELECT g.uses_remaining FROM public.product_grants g WHERE g.order_id = o.id),
         public.verification_payment_problem(r.id),
         r.payment_override_reason
  FROM public.vendor_verification_requests r
  JOIN public.orders o ON o.id = r.order_id
  WHERE r.id = ANY (p_request_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_verification_payments(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_verification_payments(uuid[]) TO authenticated;


-- ── check ───────────────────────────────────────────────────────────────────────────────────────
-- Everything is empty in beta. With test payments: request a refund above the second-approval threshold as one admin;
-- it appears as "waiting" and the SAME admin cannot approve it; another admin can. A refunded verification cannot be approved
-- until staff_override_verification_payment records a reason.
