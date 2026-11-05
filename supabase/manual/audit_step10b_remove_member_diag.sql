-- READ-ONLY. Why can't a member be removed from a project space? Run once, export the CSV, paste it into the chat.
SELECT '1_policy' AS section, policyname::text AS object, cmd || ' | roles=' || roles::text || ' | using=' || COALESCE(qual, '') || ' | check=' || COALESCE(with_check, '') AS detail
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_space_members'
UNION ALL
SELECT '2_grant', grantee::text, string_agg(privilege_type, ',' ORDER BY privilege_type)
FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'project_space_members' GROUP BY grantee
UNION ALL
SELECT '3_trigger', t.tgname::text, left(pg_get_triggerdef(t.oid), 400)
FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid = 'public.project_space_members'::regclass
UNION ALL
SELECT '4_cv_applied', 'objects', (SELECT count(*)::text FROM pg_proc WHERE proname IN ('rotate_group_key', 'cv_on_member_removed'))
UNION ALL
SELECT '5_function', p.oid::regprocedure::text, left(pg_get_functiondef(p.oid), 1200)
FROM pg_proc p WHERE p.proname IN ('refuse_staff_membership')
ORDER BY 1, 2;
