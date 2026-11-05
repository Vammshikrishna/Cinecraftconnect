-- AUDIT STEP 1 PRE-FLIGHT - READ-ONLY. Run BEFORE part_cj_close_open_legacy_functions.sql.
-- Export the result (CSV) and paste it into the chat. It changes nothing and returns no user data.
-- Columns: section | object | detail

-- 1. Which database functions call the three functions that part_cj locks away from API clients?
--    (definer=true means the caller runs with owner rights, so locking is safe. definer=false needs a look.)
SELECT '1_callers' AS section,
       p.oid::regprocedure::text AS object,
       'definer=' || p.prosecdef
         || ' calls_governance_notice=' || (p.prosrc ILIKE '%send_governance_notification%')
         || ' calls_create_refund=' || (p.prosrc ILIKE '%_create_refund%')
         || ' calls_remove_staff_memberships=' || (p.prosrc ILIKE '%remove_staff_memberships%') AS detail
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname NOT IN ('send_governance_notification','_create_refund','remove_staff_memberships')
  AND (p.prosrc ILIKE '%send_governance_notification%'
    OR p.prosrc ILIKE '%_create_refund%'
    OR p.prosrc ILIKE '%remove_staff_memberships%')

UNION ALL
-- 2. How many super admins exist? (claim_admin_access is only dangerous while this is 0.)
SELECT '2_super_admin_count', 'user_roles', count(*)::text
FROM public.user_roles WHERE role = 'super_admin'::public.app_role

UNION ALL
-- 3. Live bodies of the guards the audit could not read from source.
SELECT '3_function_definition', p.oid::regprocedure::text, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'protect_profile_privileged_columns','trg_report_prepare','report_prepare','guard_content_report',
  'marketplace_bookings_guard','guard_post','is_current_user_internal','staff_rank','is_staff_user')

ORDER BY section, object;
