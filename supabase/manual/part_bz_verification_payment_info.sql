-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- part_bz: the verification queue shows what was paid
--
-- A reviewer opening a business verification request sees, on the request itself, whether it was paid for, how much, when, and
-- whether the payment was later refunded or disputed (in which case it should not be approved until that is sorted out).
-- Nobody needs to open the Payments tab. Read only. Run after part_bx.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.staff_verification_payments(p_request_ids uuid[])
RETURNS TABLE (
  request_id uuid, order_id uuid, amount_minor integer, tax_minor integer, currency text,
  paid_at timestamptz, order_status text, refunded_minor bigint, submissions_left integer
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
         COALESCE((SELECT sum(rf.amount_minor) FROM public.refunds rf WHERE rf.order_id = o.id AND rf.status = 'processed'), 0)::bigint,
         (SELECT g.uses_remaining FROM public.product_grants g WHERE g.order_id = o.id)
  FROM public.vendor_verification_requests r
  JOIN public.orders o ON o.id = r.order_id
  WHERE r.id = ANY (p_request_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_verification_payments(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_verification_payments(uuid[]) TO authenticated;
