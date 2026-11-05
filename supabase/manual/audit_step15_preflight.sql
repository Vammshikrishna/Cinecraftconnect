-- AUDIT STEP 15 PRE-FLIGHT (plan limits, content throttle, announcements, pitch NDA, connection requests) - READ-ONLY.
-- Run once, export the CSV and paste it into the chat. Returns policy / trigger / function / constraint text only (no user data).
SELECT '1_function' AS section, p.oid::regprocedure::text AS object, left(pg_get_functiondef(p.oid), 2200) AS detail
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('enforce_plan_limit', 'throttle_new_content', 'announcements_guard', 'suggest_people')
UNION ALL
SELECT '2_policy', tablename::text || '.' || policyname::text,
       cmd || ' | roles=' || roles::text || ' | using=' || COALESCE(qual, '') || ' | check=' || COALESCE(with_check, '')
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('announcements', 'pitch_submissions', 'pitch_calls', 'pitch_nda_signatures', 'user_connections')
UNION ALL
SELECT '3_trigger', tgrelid::regclass::text || '.' || tgname::text, left(pg_get_triggerdef(oid), 240)
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgrelid::regclass::text IN ('announcements', 'pitch_submissions', 'posts', 'user_connections', 'projects', 'project_spaces', 'discussion_rooms', 'jobs', 'listings')
UNION ALL
SELECT '4_tables_like_nda', c.relname::text, 'columns: ' || (SELECT string_agg(a.attname, ', ' ORDER BY a.attnum)
                                                             FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND (c.relname ILIKE '%nda%' OR c.relname ILIKE 'pitch%')
UNION ALL
SELECT '5_fk_to_pitch_submissions', con.conrelid::regclass::text || '.' || con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con WHERE con.contype = 'f' AND con.confrelid = 'public.pitch_submissions'::regclass
UNION ALL
SELECT '6_plan_limit_triggers', tgrelid::regclass::text || '.' || tgname::text, left(pg_get_triggerdef(oid), 240)
FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'enforce_plan_limit%'
ORDER BY 1, 2;
