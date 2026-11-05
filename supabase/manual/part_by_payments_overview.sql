-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- part_by: who has paid, and for what (admin and super admin)
--
-- Read-only views for the Payments tab of the admin console. Admins and super admins can see how much was paid, by how many
-- accounts, for which plan or product, what each account holds right now, and how many people have access WITHOUT paying
-- (beta, founding members, gifts), so the two are never confused. Nothing here changes any data.
--
--   staff_payments_summary(days)  totals, a breakdown by what was bought, what is held now, and a daily series
--   staff_list_orders(...)        every order with its buyer, item, amount and status; filter and search
--   staff_list_payers(...)        every account that has paid, with what they paid and what they hold now
--
-- Staff rank 2 (admin) or 3 (super admin), and two-step sign-in when it is required. Run after part_bx.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.staff_payments_summary(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := CASE WHEN p_days IS NULL OR p_days <= 0 THEN '-infinity'::timestamptz ELSE now() - make_interval(days => p_days) END;
  v_totals jsonb;
  v_by_item jsonb;
  v_held jsonb;
  v_free jsonb;
  v_daily jsonb;
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Only admins can see payments';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;

  -- money in, money back, by currency
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_totals FROM (
    SELECT g.currency,
           g.gross_minor,
           COALESCE(r.refunded_minor, 0) AS refunded_minor,
           g.gross_minor - COALESCE(r.refunded_minor, 0) AS net_minor,
           g.payments,
           g.paying_accounts
    FROM (
      SELECT p.currency, sum(p.amount_minor)::bigint AS gross_minor, count(*)::int AS payments, count(DISTINCT o.buyer_id)::int AS paying_accounts
      FROM public.payments p JOIN public.orders o ON o.id = p.order_id
      WHERE p.status = 'captured' AND p.created_at >= v_since
      GROUP BY p.currency
    ) g
    LEFT JOIN (
      SELECT o.currency, sum(rf.amount_minor)::bigint AS refunded_minor
      FROM public.refunds rf JOIN public.orders o ON o.id = rf.order_id
      WHERE rf.status = 'processed' AND rf.created_at >= v_since
      GROUP BY o.currency
    ) r ON r.currency = g.currency
  ) t;

  -- what they paid for
  SELECT COALESCE(jsonb_agg(t ORDER BY t.amount_minor DESC), '[]'::jsonb) INTO v_by_item FROM (
    SELECT o.kind,
           COALESCE(pr.name, pl.name, o.kind) AS item,
           o.currency,
           count(*)::int AS payments,
           count(DISTINCT o.buyer_id)::int AS accounts,
           sum(p.amount_minor)::bigint AS amount_minor
    FROM public.payments p
    JOIN public.orders o ON o.id = p.order_id
    LEFT JOIN public.products pr ON pr.code = o.product_code
    LEFT JOIN public.plans pl ON pl.code = o.plan_code
    WHERE p.status = 'captured' AND p.created_at >= v_since
    GROUP BY o.kind, COALESCE(pr.name, pl.name, o.kind), o.currency
  ) t;

  -- what is held right now, split into paid and not paid
  SELECT jsonb_build_object(
    'subscriptions_paid', COALESCE((SELECT jsonb_agg(jsonb_build_object('plan', COALESCE(pl.name, s.plan_code), 'status', s.status, 'accounts', s.n))
                                      FROM (SELECT plan_code, status, count(*)::int AS n FROM public.subscriptions
                                             WHERE status IN ('active', 'past_due') AND provider IS NOT NULL GROUP BY plan_code, status) s
                                      LEFT JOIN public.plans pl ON pl.code = s.plan_code), '[]'::jsonb),
    'products_paid', COALESCE((SELECT jsonb_agg(jsonb_build_object('product', COALESCE(pr.name, g.product_code), 'accounts', g.n))
                                 FROM (SELECT product_code, count(DISTINCT owner_id)::int AS n FROM public.product_grants
                                        WHERE status = 'active' AND valid_until > now() AND order_id IS NOT NULL GROUP BY product_code) g
                                 LEFT JOIN public.products pr ON pr.code = g.product_code), '[]'::jsonb)
  ) INTO v_held;

  -- access without paying: kept apart on purpose
  SELECT jsonb_build_object(
    'beta_or_trial_subscriptions', (SELECT count(*)::int FROM public.subscriptions WHERE status IN ('beta', 'trialing')),
    'accounts_with_gift_access', (SELECT count(DISTINCT owner_id)::int FROM public.entitlement_overrides WHERE owner_type = 'user' AND (expires_at IS NULL OR expires_at > now())),
    'gifts_waiting', (SELECT count(*)::int FROM public.gifts WHERE status IN ('sent', 'opened') AND expires_at > now()),
    'gifts_accepted', (SELECT count(*)::int FROM public.gifts WHERE status = 'accepted')
  ) INTO v_free;

  -- a daily series of money in, for the chart
  SELECT COALESCE(jsonb_agg(d ORDER BY d.day), '[]'::jsonb) INTO v_daily FROM (
    SELECT date_trunc('day', p.created_at)::date AS day, sum(p.amount_minor)::bigint AS amount_minor, count(*)::int AS payments
    FROM public.payments p
    WHERE p.status = 'captured' AND p.created_at >= GREATEST(v_since, now() - interval '120 days')
    GROUP BY 1
  ) d;

  RETURN jsonb_build_object(
    'mode', public.billing_mode(),
    'payments_enabled', COALESCE((SELECT s.value = 'true'::jsonb FROM public.platform_settings s WHERE s.key = 'payments_enabled'), false),
    'days', p_days,
    'totals', v_totals,
    'by_item', v_by_item,
    'held', v_held,
    'free_access', v_free,
    'daily', v_daily,
    'orders', jsonb_build_object(
      'awaiting_payment', (SELECT count(*)::int FROM public.orders WHERE status = 'awaiting_payment' AND (expires_at IS NULL OR expires_at > now())),
      'disputed', (SELECT count(*)::int FROM public.orders WHERE status = 'disputed'),
      'failed_payments', (SELECT count(*)::int FROM public.payments WHERE status = 'failed' AND created_at >= v_since)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.staff_payments_summary(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_payments_summary(integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.staff_list_orders(
  p_status text DEFAULT 'all', p_kind text DEFAULT 'all', p_search text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
)
RETURNS TABLE (
  order_id uuid, kind text, item text, buyer_id uuid, buyer_name text, buyer_username text, seller_name text,
  amount_minor integer, fee_minor integer, tax_minor integer, currency text, status text, provider text,
  created_at timestamptz, paid_at timestamptz, refunded_minor bigint, total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Only admins can see payments';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN QUERY
  SELECT o.id, o.kind, COALESCE(pr.name, pl.name, o.kind),
         o.buyer_id, COALESCE(bp.full_name, bp.username), bp.username, COALESCE(sp.full_name, sp.username),
         o.amount_minor, o.fee_minor, o.tax_minor, o.currency, o.status, o.provider,
         o.created_at,
         (SELECT min(p.created_at) FROM public.payments p WHERE p.order_id = o.id AND p.status = 'captured'),
         COALESCE((SELECT sum(r.amount_minor) FROM public.refunds r WHERE r.order_id = o.id AND r.status = 'processed'), 0)::bigint,
         count(*) OVER ()
  FROM public.orders o
  LEFT JOIN public.products pr ON pr.code = o.product_code
  LEFT JOIN public.plans pl ON pl.code = o.plan_code
  LEFT JOIN public.profiles bp ON bp.id = o.buyer_id
  LEFT JOIN public.profiles sp ON sp.id = o.seller_id
  WHERE (p_status = 'all' OR o.status = p_status)
    AND (p_kind = 'all' OR o.kind = p_kind)
    AND (p_search IS NULL OR trim(p_search) = ''
         OR bp.username ILIKE '%' || trim(p_search) || '%'
         OR bp.full_name ILIKE '%' || trim(p_search) || '%'
         OR o.id::text ILIKE trim(p_search) || '%')
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200)) OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_orders(text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_orders(text, text, text, integer, integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.staff_list_payers(p_search text DEFAULT NULL, p_limit integer DEFAULT 100)
RETURNS TABLE (
  user_id uuid, full_name text, username text, orders_paid integer, total_paid_minor bigint, refunded_minor bigint,
  currency text, last_paid_at timestamptz, holds jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Only admins can see payments';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN QUERY
  SELECT b.buyer_id, pr.full_name, pr.username, b.orders_paid, b.total_paid_minor, COALESCE(rf.refunded_minor, 0)::bigint,
         b.currency, b.last_paid_at,
         (
           SELECT COALESCE(jsonb_agg(h), '[]'::jsonb) FROM (
             SELECT COALESCE(pl.name, s.plan_code) AS name, 'plan'::text AS type, s.status, s.current_period_end AS until
               FROM public.subscriptions s LEFT JOIN public.plans pl ON pl.code = s.plan_code
              WHERE s.owner_type = 'user' AND s.owner_id = b.buyer_id AND s.status IN ('active', 'past_due', 'trialing', 'beta')
             UNION ALL
             SELECT COALESCE(pd.name, g.product_code), 'product', g.status, g.valid_until
               FROM public.product_grants g LEFT JOIN public.products pd ON pd.code = g.product_code
              WHERE g.owner_id = b.buyer_id AND g.status = 'active' AND g.valid_until > now()
           ) h
         )
  FROM (
    SELECT o.buyer_id, o.currency, count(DISTINCT o.id)::int AS orders_paid, sum(p.amount_minor)::bigint AS total_paid_minor, max(p.created_at) AS last_paid_at
    FROM public.payments p JOIN public.orders o ON o.id = p.order_id
    WHERE p.status = 'captured'
    GROUP BY o.buyer_id, o.currency
  ) b
  LEFT JOIN public.profiles pr ON pr.id = b.buyer_id
  LEFT JOIN LATERAL (
    SELECT sum(r.amount_minor) AS refunded_minor FROM public.refunds r JOIN public.orders o2 ON o2.id = r.order_id
     WHERE o2.buyer_id = b.buyer_id AND r.status = 'processed'
  ) rf ON true
  WHERE p_search IS NULL OR trim(p_search) = '' OR pr.username ILIKE '%' || trim(p_search) || '%' OR pr.full_name ILIKE '%' || trim(p_search) || '%'
  ORDER BY b.last_paid_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 300));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_payers(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_payers(text, integer) TO authenticated;


-- ── check ───────────────────────────────────────────────────────────────────────────────────────
-- In beta everything is zero and "access without paying" shows the beta, founding and gift counts:
--   SELECT public.staff_payments_summary(30);
