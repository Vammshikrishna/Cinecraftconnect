-- AUDIT STEP 4 PRE-FLIGHT (billing) - READ-ONLY. Run once in the Supabase SQL editor, export the result (CSV) and paste it into the chat.
-- It changes nothing. It returns function/view text, constraint text, column names and row COUNTS only (no payment data).
-- Columns: section | object | detail

-- 1. Live bodies of the billing functions and view that the audit flagged.
SELECT '1_function_definition' AS section, p.oid::regprocedure::text AS object, pg_get_functiondef(p.oid) AS detail
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('billing_apply_event','staff_create_payout','staff_decide_refund','staff_request_refund','refundable_minor','billing_claim_refund')

UNION ALL
SELECT '2_view_definition', c.relname::text, pg_get_viewdef(c.oid)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'v_releasable_orders'

UNION ALL
-- 3. Allowed status values and other CHECK constraints on the billing tables.
SELECT '3_check_constraint', con.conrelid::regclass::text || '.' || con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
WHERE con.contype = 'c' AND con.conrelid::regclass::text IN ('orders','refunds','product_grants','subscriptions','payouts','payout_items','disputes','order_disputes','provider_events','payments')

UNION ALL
-- 4. Columns of the billing tables.
SELECT '4_columns', c.table_name::text, string_agg(c.column_name || ':' || c.data_type, ', ' ORDER BY c.ordinal_position)
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('orders','refunds','product_grants','subscriptions','payouts','payout_items','provider_events','payments','order_disputes')
GROUP BY c.table_name

UNION ALL
-- 5. Triggers on the billing tables.
SELECT '5_trigger', tgrelid::regclass::text, tgname::text
FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text IN ('orders','refunds','product_grants','subscriptions','payouts','payout_items')

UNION ALL
-- 6. Is billing in use? (counts only)
SELECT '6_row_counts', t.name, t.n::text
FROM (
  SELECT 'orders' AS name, count(*) AS n FROM public.orders
  UNION ALL SELECT 'refunds', count(*) FROM public.refunds
  UNION ALL SELECT 'payouts', count(*) FROM public.payouts
  UNION ALL SELECT 'subscriptions', count(*) FROM public.subscriptions
  UNION ALL SELECT 'product_grants', count(*) FROM public.product_grants
) t

ORDER BY section, object, detail;
