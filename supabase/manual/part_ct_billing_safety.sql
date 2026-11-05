-- PART CT - billing safety fixes (audit step 5). Billing has never been used (0 orders / refunds / payouts), so this is safe to run now.
-- Run in the Supabase SQL editor AFTER part_cs. Based on the LIVE function and view bodies read in audit_step4_preflight.sql.
--
-- Fixes:
--   1. Refund splitting: the "small refunds approve themselves" rule now looks at what has already been refunded on the
--      order (and what this admin approved for themselves in the last 24 hours), not just the single request.
--   2. Payouts: an order with a refund that is requested, approved or being sent is no longer payable to the seller.
--   3. Refunded purchases: when an order becomes refunded (or lost to a chargeback) its product grants are cancelled.
--   4. Late events: an older subscription event can no longer overwrite newer subscription state.
-- (The webhook retry fix is in the billing-webhook Edge Function; deploy it too.)

-- ---------------------------------------------------------------------------
-- 1. _create_refund: judge the small-refund rule on the order's total, and on the requester's recent self-approvals.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._create_refund(p_order uuid, p_amount integer, p_reason text, p_requester uuid, p_dispute uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_small integer := public.billing_setting_int('refund_second_approval_minor', 500000);
  v_super integer := public.billing_setting_int('refund_super_admin_minor', 5000000);
  v_payment uuid;
  v_status text;
  v_id uuid;
  v_on_order bigint;
  v_self_recent bigint;
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

  -- Everything already refunded or on its way on this order, and what this person already approved for themselves in the
  -- last 24 hours. A refund only approves itself if BOTH totals, with this refund added, stay under the limit.
  SELECT COALESCE(sum(r.amount_minor), 0) INTO v_on_order
    FROM public.refunds r WHERE r.order_id = p_order AND r.status IN ('requested', 'approved', 'processing', 'processed');
  SELECT COALESCE(sum(r.amount_minor), 0) INTO v_self_recent
    FROM public.refunds r
   WHERE p_requester IS NOT NULL AND r.requested_by = p_requester AND r.approved_by = p_requester
     AND r.status IN ('approved', 'processing', 'processed') AND r.created_at > now() - interval '24 hours';

  v_status := CASE WHEN p_amount + v_on_order < v_small AND p_amount + v_self_recent < v_small THEN 'approved' ELSE 'requested' END;
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
$function$;

-- ---------------------------------------------------------------------------
-- 2. Payouts: skip orders that have a refund in progress.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_releasable_orders AS
 SELECT o.id AS order_id,
    o.seller_id,
    o.currency,
    (o.amount_minor - o.fee_minor) AS payable_minor,
    ( SELECT min(p.created_at) AS min
           FROM public.payments p
          WHERE ((p.order_id = o.id) AND (p.status = 'captured'::text))) AS paid_at
   FROM public.orders o
  WHERE ((o.seller_id IS NOT NULL) AND (o.status = ANY (ARRAY['paid'::text, 'fulfilled'::text, 'settled'::text])) AND (NOT (EXISTS ( SELECT 1
           FROM public.payout_items pi
          WHERE (pi.order_id = o.id)))) AND (NOT (EXISTS ( SELECT 1
           FROM public.disputes d
          WHERE ((d.order_id = o.id) AND (d.status = ANY (ARRAY['open'::text, 'under_review'::text])))))) AND (NOT (EXISTS ( SELECT 1
           FROM public.refunds rf
          WHERE ((rf.order_id = o.id) AND (rf.status = ANY (ARRAY['requested'::text, 'approved'::text, 'processing'::text])))))) AND (( SELECT min(p.created_at) AS min
           FROM public.payments p
          WHERE ((p.order_id = o.id) AND (p.status = 'captured'::text))) <= (now() - make_interval(days => public.billing_setting_int('payout_hold_days'::text, 7)))));

-- ---------------------------------------------------------------------------
-- 3. A refunded (or charged-back) order cancels the product access it paid for.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ct_revoke_grants_on_refund()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded' THEN
    UPDATE public.product_grants SET status = 'refunded' WHERE order_id = NEW.id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ct_revoke_grants_on_refund ON public.orders;
CREATE TRIGGER trg_ct_revoke_grants_on_refund
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.ct_revoke_grants_on_refund();

-- ---------------------------------------------------------------------------
-- 4. Subscription events: remember when the provider says the last event happened, and never let an older one win.
--    The webhook adapter should send "occurred_at" (the provider's own event time) on subscription events; without it
--    the period-end check still stops a stale renewal from moving a subscription backwards.
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS last_event_at timestamptz;

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
  v_rows integer;
  v_occurred timestamptz := NULLIF(p_event ->> 'occurred_at', '')::timestamptz;
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
                                      provider, provider_customer_id, provider_subscription_id, last_event_at)
    VALUES (p_event ->> 'owner_type', (p_event ->> 'owner_id')::uuid, p_event ->> 'plan_code', 'active', p_event ->> 'interval',
            (p_event ->> 'period_start')::timestamptz, (p_event ->> 'period_end')::timestamptz,
            p_event ->> 'provider', p_event ->> 'provider_customer_id', p_event ->> 'provider_subscription_id', v_occurred)
    ON CONFLICT (owner_type, owner_id) WHERE status IN ('beta', 'trialing', 'active', 'past_due')
    DO UPDATE SET plan_code = EXCLUDED.plan_code, status = 'active', billing_interval = EXCLUDED.billing_interval,
                  current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end,
                  provider = EXCLUDED.provider, provider_customer_id = EXCLUDED.provider_customer_id,
                  provider_subscription_id = EXCLUDED.provider_subscription_id, cancel_at_period_end = false,
                  last_event_at = GREATEST(public.subscriptions.last_event_at, EXCLUDED.last_event_at), updated_at = now()
     -- an older event delivered late must not overwrite newer state: the period must not go backwards, and when the
     -- provider sent the time of the event, it must not be older than the last one applied
     WHERE (public.subscriptions.current_period_end IS NULL OR EXCLUDED.current_period_end >= public.subscriptions.current_period_end)
       AND (v_occurred IS NULL OR public.subscriptions.last_event_at IS NULL OR v_occurred >= public.subscriptions.last_event_at);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN RETURN 'stale_ignored'; END IF;
    RETURN 'applied';

  ELSIF v_type = 'subscription.past_due' THEN
    UPDATE public.subscriptions SET status = 'past_due', last_event_at = GREATEST(last_event_at, v_occurred), updated_at = now()
     WHERE provider = p_event ->> 'provider' AND provider_subscription_id = p_event ->> 'provider_subscription_id'
       AND (v_occurred IS NULL OR last_event_at IS NULL OR v_occurred >= last_event_at);
    RETURN 'applied';

  ELSIF v_type IN ('subscription.cancelled', 'subscription.expired') THEN
    UPDATE public.subscriptions
       SET status = CASE WHEN v_type = 'subscription.expired' THEN 'expired' ELSE 'cancelled' END,
           last_event_at = GREATEST(last_event_at, v_occurred), updated_at = now()
     WHERE provider = p_event ->> 'provider' AND provider_subscription_id = p_event ->> 'provider_subscription_id'
       AND (v_occurred IS NULL OR last_event_at IS NULL OR v_occurred >= last_event_at);
    RETURN 'applied';
  END IF;

  RETURN 'ignored';
END;
$$;
REVOKE ALL ON FUNCTION public.billing_apply_event(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_apply_event(jsonb) TO service_role;
