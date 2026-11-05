-- PART GC - FINANCE staff role and two-person approval for refunds. Safe to run more than once.
--
-- WHY: money decisions need their own role (finance) and no refund may be approved by the person who asked for it.
--
-- WHAT IT ADDS
--   * role "finance": reads and decides refunds only. It has NO moderation, admin or user-management power (staff_rank() is untouched,
--     so a finance account counts as rank 0 everywhere else). A finance account must not hold any other staff role (one role per person).
--   * is_finance(user)
--   * finance_request_role(user, grant, reason): a super admin asks to give or take away the role; a DIFFERENT super admin approves it in the
--     normal approval queue (same queue as every other role change, written to the audit ledger).
--   * refund approvals, enforced by the database whoever or whatever touches the refund:
--       - the person who asked for a refund can never approve it (and a refund never approves itself any more, however small)
--       - up to the limit (refund_single_approver_limit_minor, default 500000 = 5,000.00): ONE other approver
--       - above the limit: TWO different approvers (both different from the requester)
--       - at or above refund_super_admin_minor (default 5,000,000): at least one of the approvers must be a super admin (as before)
--       - anyone allowed to decide may refuse; one refusal closes the refund
--       - every request, vote, approval and refusal is written to gov_audit_ledger
--     Approvers can be admins, super admins or finance. Sending an approved refund to the provider is unchanged (the process-refund edge
--     function; it only accepts a refund that is already "approved", and the database now only lets a refund become approved with enough approvers).
--       Refunds that were already approved before this part ran keep working (they have no approvals_required value, so they are not re-judged).
--   * finance_refund_settings(), finance_set_refund_limit(minor, reason) (super admin, audited)
--   * staff_refund_queue(status): the list the Refunds screen now uses (adds "1 of 2 approvals" and whether you can still vote)
--   Replaces: _create_refund (never auto-approves), staff_request_refund (finance may ask too), staff_decide_refund (votes).
--
-- RUN AFTER part_ca, part_ct and part_gd (part_gd is only needed for the two-step flag; this file works without it).
-- If the SQL editor says the new enum value "finance" cannot be used in the same batch, run only the first statement (ALTER TYPE) on its own, then the rest.
-- PREFLIGHT (read only): select enum_range(null::public.app_role);        -- no finance before
--                        select count(*) from public.refunds where status = 'requested';   -- open refunds are judged with the new rule from now on
-- POST-CHECK  (read only): select public.finance_refund_settings();       -- as an admin/super admin in the app

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';

SET lock_timeout = '5s';

-- ── 1. who is finance ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_finance(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role::text = 'finance');
$$;
REVOKE ALL ON FUNCTION public.is_finance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_finance(uuid) TO authenticated;

-- may this person see and decide refunds? (admins, super admins, finance)
CREATE OR REPLACE FUNCTION public._can_decide_refunds(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user IS NOT NULL AND (public.staff_rank(p_user) >= 2 OR public.is_finance(p_user));
$$;
REVOKE ALL ON FUNCTION public._can_decide_refunds(uuid) FROM PUBLIC, anon, authenticated;

-- ── 2. giving and taking away the role (two super admins) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finance_request_role(p_user uuid, p_grant boolean, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action text := CASE WHEN p_grant THEN 'finance.grant' ELSE 'finance.revoke' END;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can ask for this' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Please give a reason of at least 5 characters';
  END IF;
  IF p_user IS NULL OR p_user = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;
  IF p_grant THEN
    IF public.is_finance(p_user) THEN RAISE EXCEPTION 'That person is already finance'; END IF;
    IF public.staff_rank(p_user) > 0 THEN RAISE EXCEPTION 'A finance account cannot also be a moderator, admin or super admin. Use a separate account.'; END IF;
  ELSIF NOT public.is_finance(p_user) THEN
    RAISE EXCEPTION 'That person is not finance';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gov_approval_queue WHERE status = 'pending' AND action = v_action AND target_id = p_user::text) THEN
    RAISE EXCEPTION 'This is already waiting for a second super admin';
  END IF;

  INSERT INTO public.gov_approval_queue (maker_id, action, target_id, target_type, reason, payload, status)
  VALUES (auth.uid(), v_action, p_user::text, 'user', left(btrim(p_reason), 500), '{}'::jsonb, 'pending');
  RETURN jsonb_build_object('success', true, 'queued', true);
END;
$$;
REVOKE ALL ON FUNCTION public.finance_request_role(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_request_role(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_queue_execute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target uuid;
BEGIN
  IF NEW.action NOT IN ('finance.grant', 'finance.revoke') OR OLD.status IS DISTINCT FROM 'pending' OR NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NULL;
  END IF;
  IF NEW.checker_id IS NULL OR public.staff_rank(NEW.checker_id) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can approve a role change';
  END IF;
  IF NEW.checker_id IS NOT DISTINCT FROM NEW.maker_id THEN
    RAISE EXCEPTION 'A different super admin has to approve this';
  END IF;
  v_target := NEW.target_id::uuid;
  IF v_target IN (NEW.maker_id, NEW.checker_id) THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;

  PERFORM set_config('app.market_system', '1', true);
  IF NEW.action = 'finance.grant' THEN
    IF public.staff_rank(v_target) > 0 THEN RAISE EXCEPTION 'That person already holds another staff role'; END IF;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_target, 'finance'::public.app_role)
      ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = v_target AND role::text = 'finance';
  END IF;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES (NEW.action, NEW.checker_id, NEW.target_id, 'user', COALESCE(left(NEW.reason, 300), 'Finance role changed'),
          jsonb_build_object('maker_id', NEW.maker_id, 'checker_id', NEW.checker_id, 'queue_id', NEW.id));
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.finance_queue_execute() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS finance_queue_execute ON public.gov_approval_queue;
CREATE TRIGGER finance_queue_execute
  AFTER UPDATE ON public.gov_approval_queue
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.action IN ('finance.grant', 'finance.revoke'))
  EXECUTE FUNCTION public.finance_queue_execute();

-- ── 3. refund approvals ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refund_approvals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id   uuid NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL,
  decision    text NOT NULL CHECK (decision IN ('approve', 'reject')),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (refund_id, approver_id)
);
ALTER TABLE public.refund_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.refund_approvals FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS refund_approvals_refund_idx ON public.refund_approvals (refund_id);

ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS approvals_required smallint;

-- 1 approver up to the limit, 2 above it
CREATE OR REPLACE FUNCTION public.refund_approvals_needed(p_amount integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_amount <= public.billing_setting_int('refund_single_approver_limit_minor', 500000) THEN 1 ELSE 2 END;
$$;
REVOKE ALL ON FUNCTION public.refund_approvals_needed(integer) FROM PUBLIC, anon, authenticated;

-- The gate. Whatever code touches the table, a refund only becomes approved (or goes to the provider) with enough different approvers.
CREATE OR REPLACE FUNCTION public.refunds_gate_approvals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_have integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.approvals_required := public.refund_approvals_needed(NEW.amount_minor);
    IF NEW.status = 'approved' THEN
      NEW.status := 'requested';
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- the number needed is fixed when the refund is made and cannot be lowered later
  NEW.approvals_required := OLD.approvals_required;
  IF NEW.approvals_required IS NOT NULL
     AND ((OLD.status = 'requested' AND NEW.status = 'approved') OR (NEW.status = 'processing' AND OLD.status IS DISTINCT FROM 'processing')) THEN
    SELECT count(DISTINCT a.approver_id) INTO v_have
      FROM public.refund_approvals a
     WHERE a.refund_id = NEW.id AND a.decision = 'approve' AND a.approver_id IS DISTINCT FROM NEW.requested_by;
    IF v_have < NEW.approvals_required THEN
      RAISE EXCEPTION 'This refund needs % different approver(s) and has %', NEW.approvals_required, v_have USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.refunds_gate_approvals() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS refunds_gate_approvals ON public.refunds;
CREATE TRIGGER refunds_gate_approvals
  BEFORE INSERT OR UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.refunds_gate_approvals();

-- a refund request never approves itself
CREATE OR REPLACE FUNCTION public._create_refund(p_order uuid, p_amount integer, p_reason text, p_requester uuid, p_dispute uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_super integer := public.billing_setting_int('refund_super_admin_minor', 5000000);
  v_payment uuid;
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

  INSERT INTO public.refunds (order_id, payment_id, amount_minor, reason, requested_by, status, dispute_id)
  VALUES (p_order, v_payment, p_amount, left(trim(p_reason), 500), p_requester, 'requested', p_dispute)
  RETURNING id INTO v_id;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.refund_requested', p_requester, v_id::text, 'refund', left(trim(p_reason), 300),
          jsonb_build_object('order_id', p_order, 'amount_minor', p_amount, 'status', 'requested',
                             'approvals_required', public.refund_approvals_needed(p_amount)));

  PERFORM public.notify_staff('Refund waiting for approval', left(trim(p_reason), 120), '/admin?tab=payments',
                              CASE WHEN p_amount >= v_super THEN 3 ELSE 2 END, p_requester);
  RETURN jsonb_build_object('refund_id', v_id, 'status', 'requested', 'approvals_required', public.refund_approvals_needed(p_amount));
END;
$function$;
REVOKE ALL ON FUNCTION public._create_refund(uuid, integer, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._create_refund(uuid, integer, text, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.staff_request_refund(p_order_id uuid, p_amount_minor integer, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._can_decide_refunds(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and finance can request refunds';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN public._create_refund(p_order_id, p_amount_minor, p_reason, auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.staff_request_refund(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_request_refund(uuid, integer, text) TO authenticated;

-- one vote. Approving counts toward the number needed; refusing closes the refund.
CREATE OR REPLACE FUNCTION public.staff_decide_refund(p_refund_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.refunds%ROWTYPE;
  v_super integer := public.billing_setting_int('refund_super_admin_minor', 5000000);
  v_need integer;
  v_have integer;
  v_has_super boolean;
  v_note text := left(trim(COALESCE(p_note, '')), 500);
BEGIN
  IF NOT public._can_decide_refunds(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and finance can decide refunds';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  SELECT * INTO r FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF r.status <> 'requested' THEN RAISE EXCEPTION 'This refund has already been decided'; END IF;
  IF r.requested_by = auth.uid() THEN
    RAISE EXCEPTION 'Dual control: you cannot decide a refund you requested. Someone else has to.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.refund_approvals a WHERE a.refund_id = p_refund_id AND a.approver_id = auth.uid()) THEN
    RAISE EXCEPTION 'You have already given your decision on this refund. A different person has to give the next one.';
  END IF;
  v_need := COALESCE(r.approvals_required, 1);

  INSERT INTO public.refund_approvals (refund_id, approver_id, decision, note)
  VALUES (p_refund_id, auth.uid(), CASE WHEN p_approve THEN 'approve' ELSE 'reject' END, NULLIF(v_note, ''));

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.refund_vote', auth.uid(), p_refund_id::text, 'refund', COALESCE(NULLIF(left(v_note, 300), ''), 'Refund vote'),
          jsonb_build_object('order_id', r.order_id, 'amount_minor', r.amount_minor, 'decision', CASE WHEN p_approve THEN 'approve' ELSE 'reject' END,
                             'approvals_required', v_need));

  IF NOT p_approve THEN
    UPDATE public.refunds SET status = 'rejected', approved_by = auth.uid(), approved_at = now(), decision_note = v_note WHERE id = p_refund_id;
    -- a refused refund puts the dispute it came from back under review, so it is not left looking resolved
    IF r.dispute_id IS NOT NULL THEN
      UPDATE public.disputes SET status = 'under_review', resolution = NULL, resolved_by = NULL, resolved_at = NULL WHERE id = r.dispute_id;
    END IF;
    INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
    VALUES ('billing.refund_rejected', auth.uid(), p_refund_id::text, 'refund', COALESCE(NULLIF(left(v_note, 300), ''), 'Refund refused'),
            jsonb_build_object('order_id', r.order_id, 'amount_minor', r.amount_minor));
    RETURN;
  END IF;

  SELECT count(DISTINCT a.approver_id), bool_or(public.staff_rank(a.approver_id) >= 3) INTO v_have, v_has_super
    FROM public.refund_approvals a
   WHERE a.refund_id = p_refund_id AND a.decision = 'approve' AND a.approver_id IS DISTINCT FROM r.requested_by;

  IF v_have < v_need THEN
    RETURN;   -- recorded; still waiting for the next, different approver
  END IF;
  IF r.amount_minor >= v_super AND NOT COALESCE(v_has_super, false) THEN
    RAISE EXCEPTION 'A refund this large needs a super admin among the approvers';
  END IF;

  UPDATE public.refunds SET status = 'approved', approved_by = auth.uid(), approved_at = now(), decision_note = v_note WHERE id = p_refund_id;
  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.refund_approved', auth.uid(), p_refund_id::text, 'refund', COALESCE(NULLIF(left(v_note, 300), ''), 'Refund approved'),
          jsonb_build_object('order_id', r.order_id, 'amount_minor', r.amount_minor, 'approvals', v_have));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_decide_refund(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_decide_refund(uuid, boolean, text) TO authenticated;

-- ── 4. the list the Refunds screen uses ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_refund_queue(p_status text DEFAULT 'all')
RETURNS TABLE (
  refund_id uuid, order_id uuid, item text, buyer_name text, buyer_username text, amount_minor integer, order_total_minor integer,
  currency text, reason text, status text, requested_by_name text, approved_by_name text, decision_note text, failure_reason text,
  created_at timestamptz, can_decide boolean, needs_super boolean,
  approvals_required integer, approvals_have integer, i_voted boolean, approver_names text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_super integer := public.billing_setting_int('refund_super_admin_minor', 5000000);
  v_rank integer := public.staff_rank(auth.uid());
BEGIN
  IF NOT public._can_decide_refunds(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and finance can see refunds';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN QUERY
  SELECT r.id, o.id, COALESCE(pr.name, pl.name, o.kind), COALESCE(bp.full_name, bp.username), bp.username,
         r.amount_minor, o.amount_minor + o.tax_minor, o.currency, r.reason, r.status,
         COALESCE(rq.full_name, rq.username), COALESCE(ap.full_name, ap.username), r.decision_note, r.failure_reason, r.created_at,
         (r.status = 'requested'
            AND r.requested_by IS DISTINCT FROM auth.uid()
            AND NOT EXISTS (SELECT 1 FROM public.refund_approvals a WHERE a.refund_id = r.id AND a.approver_id = auth.uid())
            AND (r.amount_minor < v_super OR v_rank >= 3
                 OR (SELECT count(DISTINCT a.approver_id) FROM public.refund_approvals a WHERE a.refund_id = r.id AND a.decision = 'approve') + 1 < COALESCE(r.approvals_required, 1))),
         r.amount_minor >= v_super,
         COALESCE(r.approvals_required, 1)::integer,
         (SELECT count(DISTINCT a.approver_id) FROM public.refund_approvals a WHERE a.refund_id = r.id AND a.decision = 'approve')::integer,
         EXISTS (SELECT 1 FROM public.refund_approvals a WHERE a.refund_id = r.id AND a.approver_id = auth.uid()),
         (SELECT string_agg(COALESCE(pp.full_name, pp.username, 'Unknown'), ', ' ORDER BY a.created_at)
            FROM public.refund_approvals a LEFT JOIN public.profiles pp ON pp.id = a.approver_id
           WHERE a.refund_id = r.id AND a.decision = 'approve')
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
REVOKE ALL ON FUNCTION public.staff_refund_queue(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_refund_queue(text) TO authenticated;

-- ── 5. the limit ────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finance_refund_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public._can_decide_refunds(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and finance can see this' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'single_approver_limit_minor', public.billing_setting_int('refund_single_approver_limit_minor', 500000),
    'super_admin_minor', public.billing_setting_int('refund_super_admin_minor', 5000000));
END;
$$;
REVOKE ALL ON FUNCTION public.finance_refund_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_refund_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_set_refund_limit(p_minor integer, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before integer := public.billing_setting_int('refund_single_approver_limit_minor', 500000);
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can change this' USING ERRCODE = '42501';
  END IF;
  IF p_minor IS NULL OR p_minor < 0 OR p_minor > 100000000 THEN
    RAISE EXCEPTION 'Enter an amount from 0 to 100,000,000 (in the smallest currency unit)';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Please give a reason of at least 5 characters';
  END IF;
  INSERT INTO public.platform_settings (key, value) VALUES ('refund_single_approver_limit_minor', to_jsonb(p_minor))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.refund_limit_changed', auth.uid(), 'refund_single_approver_limit_minor', 'setting', left(btrim(p_reason), 300),
          jsonb_build_object('before', v_before, 'after', p_minor));
END;
$$;
REVOKE ALL ON FUNCTION public.finance_set_refund_limit(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_set_refund_limit(integer, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
