-- AUDIT STEP 14 PRE-FLIGHT (tables without row security, page team, jobs, follows, blocks) - READ-ONLY.
-- Run once, export the CSV and paste it into the chat. Returns policy / trigger / function text and COUNTS only.
SELECT '1_rls_flag' AS section, c.relname::text AS object, 'row_security=' || c.relrowsecurity::text AS detail
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('notification_logs', 'user_analytics', 'project_space_categories', 'room_categories')
UNION ALL
SELECT '1b_tables_without_rls', c.relname::text, 'row_security=false'
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
UNION ALL
SELECT '2_policy', tablename::text || '.' || policyname::text,
       cmd || ' | roles=' || roles::text || ' | using=' || COALESCE(qual, '') || ' | check=' || COALESCE(with_check, '')
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('notification_logs', 'user_analytics', 'project_space_categories', 'room_categories',
                    'company_page_members', 'company_page_admins', 'jobs', 'user_follows')
UNION ALL
SELECT '3_trigger', tgrelid::regclass::text || '.' || tgname::text, left(pg_get_triggerdef(oid), 260)
FROM pg_trigger
WHERE NOT tgisinternal AND tgrelid::regclass::text IN ('company_page_members', 'company_page_admins', 'jobs', 'user_follows', 'blocked_users')
UNION ALL
SELECT '4_function', p.oid::regprocedure::text, left(pg_get_functiondef(p.oid), 1800)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('drop_admin_on_member_removal', 'handle_new_follower_notification', 'remove_connection_on_block',
                    'is_page_manager', 'respond_project_invite')
UNION ALL
SELECT '5_grant', table_name::text || '.' || grantee::text, string_agg(privilege_type, ',' ORDER BY privilege_type)
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
  AND table_name IN ('notification_logs', 'user_analytics', 'project_space_categories', 'room_categories')
GROUP BY table_name, grantee
ORDER BY 1, 2;
