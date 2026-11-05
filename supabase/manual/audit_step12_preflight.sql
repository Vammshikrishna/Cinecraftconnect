-- AUDIT STEP 12 PRE-FLIGHT (staff / moderator direct-edit holes) - READ-ONLY.
-- Run once, export the CSV and paste it into the chat. Returns policy/grant/trigger/function text and COUNTS only (no user data).
SELECT '1_policy' AS section, tablename::text || '.' || policyname::text AS object,
       cmd || ' | roles=' || roles::text || ' | using=' || COALESCE(qual, '') || ' | check=' || COALESCE(with_check, '') AS detail
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('space_access_grants', 'space_access_requests', 'profiles', 'flagged_messages', 'content_reports', 'platform_settings')
UNION ALL
SELECT '2_trigger', tgrelid::regclass::text || '.' || tgname::text, left(pg_get_triggerdef(oid), 300)
FROM pg_trigger
WHERE NOT tgisinternal AND tgrelid::regclass::text IN ('space_access_grants', 'space_access_requests', 'profiles', 'flagged_messages', 'content_reports', 'platform_settings')
UNION ALL
SELECT '3_function', p.oid::regprocedure::text, left(pg_get_functiondef(p.oid), 2500)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('request_space_access', 'staff_set_security_settings', 'protect_profile_privileged_columns', 'staff_mfa_ok',
                    'guard_fast_lane_dismiss', 'guard_fast_lane_message_close', 'gov_can_act_on')
UNION ALL
SELECT '4_grant', table_name::text || '.' || grantee::text, string_agg(privilege_type, ',' ORDER BY privilege_type)
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
  AND table_name IN ('space_access_grants', 'space_access_requests', 'flagged_messages', 'content_reports', 'platform_settings')
GROUP BY table_name, grantee
UNION ALL
SELECT '5_counts', t.name, t.n::text FROM (
  SELECT 'grants without a request or longer than 3h' AS name, count(*) AS n FROM public.space_access_grants g
   WHERE g.expires_at > g.created_at + interval '3 hours'
  UNION ALL SELECT 'require_staff_mfa setting', count(*) FROM public.platform_settings WHERE key = 'require_staff_mfa'
) t
ORDER BY 1, 2;
