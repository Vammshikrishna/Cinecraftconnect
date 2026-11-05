-- AUDIT STEP 10 PRE-FLIGHT (chat key rotation) - READ-ONLY. Run once, export the result (CSV) and paste it into the chat.
-- It changes nothing. It returns table/constraint/policy/trigger text and row COUNTS only (no keys, no user ids).
SELECT '1_columns' AS section, c.table_name::text AS object,
       string_agg(c.column_name || ':' || c.data_type || ':' || c.is_nullable || ':' || COALESCE(c.column_default, ''), ' | ' ORDER BY c.ordinal_position) AS detail
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name IN ('group_keys', 'project_space_members', 'room_members')
GROUP BY c.table_name
UNION ALL
SELECT '2_constraint', con.conrelid::regclass::text || '.' || con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con WHERE con.conrelid::regclass::text IN ('group_keys', 'project_space_members', 'room_members')
UNION ALL
SELECT '3_index', tablename::text || '.' || indexname::text, indexdef
FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'group_keys'
UNION ALL
SELECT '4_policy', tablename::text || '.' || policyname::text, cmd || ' | roles=' || roles::text || ' | using=' || COALESCE(qual, '') || ' | check=' || COALESCE(with_check, '')
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_keys'
UNION ALL
SELECT '5_grant', grantee::text, string_agg(privilege_type, ',' ORDER BY privilege_type)
FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'group_keys' GROUP BY grantee
UNION ALL
SELECT '6_trigger', tgrelid::regclass::text, tgname::text
FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text IN ('group_keys', 'project_space_members', 'room_members')
UNION ALL
SELECT '7_function', p.oid::regprocedure::text, left(pg_get_functiondef(p.oid), 1500)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND (p.proname LIKE 'cr\_%' OR p.proname IN ('cj_can_manage_space', 'cl_i_manage_space', 'cj_guard_member_removal', 'cj_room_is_public'))
UNION ALL
SELECT '8_counts', t.name, t.n::text
FROM (
  SELECT 'group_keys rows' AS name, count(*) AS n FROM public.group_keys
  UNION ALL SELECT 'group_keys project_space spaces', count(DISTINCT target_id) FROM public.group_keys WHERE target_type = 'project_space'
  UNION ALL SELECT 'group_keys room rooms', count(DISTINCT target_id) FROM public.group_keys WHERE target_type = 'room'
) t
ORDER BY 1, 2;
