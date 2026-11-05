-- AUDIT STEP 6 PRE-FLIGHT (user_roles visibility) - READ-ONLY. Run once, export the result (CSV) and paste it into the chat.
-- Returns policy text, grants, and counts of roles only (no user ids).
SELECT '1_policy' AS section, policyname::text AS object, cmd || ' | roles=' || roles::text || ' | using=' || COALESCE(qual, '') || ' | check=' || COALESCE(with_check, '') AS detail
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles'
UNION ALL
SELECT '2_grant', grantee::text, string_agg(privilege_type, ',' ORDER BY privilege_type)
FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'user_roles' GROUP BY grantee
UNION ALL
SELECT '3_role_counts', role::text, count(*)::text FROM public.user_roles GROUP BY role
UNION ALL
SELECT '4_columns', 'user_roles', string_agg(column_name || ':' || data_type, ', ' ORDER BY ordinal_position)
FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_roles'
UNION ALL
SELECT '5_function', p.oid::regprocedure::text, left(pg_get_functiondef(p.oid), 600)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('has_role', 'is_staff', 'get_user_role', 'is_admin', 'get_public_roles')
ORDER BY 1, 2;
