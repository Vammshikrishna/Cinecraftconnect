-- AUDIT STEP 3 PRE-FLIGHT - READ-ONLY. Run once in the Supabase SQL editor, export the result (CSV) and paste it into the chat.
-- It changes nothing and returns only function text, policy text and trigger names (no user data).
-- Columns: section | object | detail

-- 1. Live bodies of the helper functions that take a user id from the caller (information oracles).
SELECT '1_function_definition' AS section, p.oid::regprocedure::text AS object, pg_get_functiondef(p.oid) AS detail
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'announcement_visible','is_page_team','pitch_is_blocked','count_for_limit','has_entitlement','entitlement_limit',
  'resolve_entitlements','has_product_access','get_profile_activity','get_profile_counts','introduction_options',
  'room_member_counts','trending_community_titles','can_view_post','can_view_profile_extras')

UNION ALL
-- 2. Policies that call those helpers (so the change does not break them).
SELECT '2_policy_uses_helper', schemaname || '.' || tablename,
       policyname || ' | ' || cmd || ' | USING=' || coalesce(qual, '-') || ' | CHECK=' || coalesce(with_check, '-')
FROM pg_policies
WHERE qual ILIKE '%announcement_visible%' OR qual ILIKE '%is_page_team%' OR qual ILIKE '%pitch_is_blocked%'
   OR with_check ILIKE '%announcement_visible%' OR with_check ILIKE '%is_page_team%' OR with_check ILIKE '%pitch_is_blocked%'

UNION ALL
-- 3. Other functions that call those helpers.
SELECT '3_function_calls_helper', p.oid::regprocedure::text,
       'definer=' || p.prosecdef || ' calls=' || concat_ws(',',
         CASE WHEN p.prosrc ILIKE '%announcement_visible%' THEN 'announcement_visible' END,
         CASE WHEN p.prosrc ILIKE '%is_page_team%' THEN 'is_page_team' END,
         CASE WHEN p.prosrc ILIKE '%pitch_is_blocked%' THEN 'pitch_is_blocked' END,
         CASE WHEN p.prosrc ILIKE '%has_entitlement%' THEN 'has_entitlement' END,
         CASE WHEN p.prosrc ILIKE '%entitlement_limit%' THEN 'entitlement_limit' END,
         CASE WHEN p.prosrc ILIKE '%count_for_limit%' THEN 'count_for_limit' END,
         CASE WHEN p.prosrc ILIKE '%resolve_entitlements%' THEN 'resolve_entitlements' END,
         CASE WHEN p.prosrc ILIKE '%has_product_access%' THEN 'has_product_access' END)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname NOT IN ('announcement_visible','is_page_team','pitch_is_blocked','count_for_limit','has_entitlement',
                        'entitlement_limit','resolve_entitlements','has_product_access')
  AND (p.prosrc ILIKE '%announcement_visible%' OR p.prosrc ILIKE '%is_page_team%' OR p.prosrc ILIKE '%pitch_is_blocked%'
    OR p.prosrc ILIKE '%has_entitlement%' OR p.prosrc ILIKE '%entitlement_limit%' OR p.prosrc ILIKE '%count_for_limit%'
    OR p.prosrc ILIKE '%resolve_entitlements%' OR p.prosrc ILIKE '%has_product_access%')

UNION ALL
-- 4. E2EE key tables: columns and the key-backup shape (names only).
SELECT '4_columns', c.table_name::text, string_agg(c.column_name || ':' || c.data_type, ', ' ORDER BY c.ordinal_position)
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name IN ('group_keys', 'key_backups')
GROUP BY c.table_name

UNION ALL
-- 5. Triggers on group_keys and key_backups.
SELECT '5_trigger', tgrelid::regclass::text, tgname::text
FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text IN ('group_keys', 'key_backups')

ORDER BY section, object, detail;
