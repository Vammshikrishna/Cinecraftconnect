-- AUDIT STEP 1c PRE-FLIGHT - READ-ONLY. Run once in the Supabase SQL editor, export the result (CSV) and paste it into the chat.
-- It changes nothing and returns no user data (only function text, policy text, column names and counts of roles).
-- Columns: section | object | detail

-- 1. Functions that INSERT into notifications but do NOT run with owner rights (definer=false). These would break
--    if notification inserts are restricted to "yourself or attributed to you".
SELECT '1_notification_writers_not_definer' AS section,
       p.oid::regprocedure::text AS object,
       'definer=' || p.prosecdef AS detail
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosrc ~* 'insert\s+into\s+(public\.)?notifications'
  AND NOT p.prosecdef

UNION ALL
-- 2. The call functions: live definitions.
SELECT '2_call_function_definition', p.oid::regprocedure::text, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN
  ('verify_call_room_membership','create_or_start_call','generate_direct_room_id','end_call','leave_call','expire_stale_calls','reconcile_call_state')

UNION ALL
-- 3. Columns of the tables the membership and call rules depend on.
SELECT '3_columns', c.table_name::text, string_agg(c.column_name || ':' || c.data_type, ', ' ORDER BY c.ordinal_position)
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('conversations','project_spaces','project_space_members','project_space_join_requests',
                       'calls','call_participants','room_members','room_join_requests','notifications')
GROUP BY c.table_name

UNION ALL
-- 4. Which roles are in use in project_space_members and room_members (counts only).
SELECT '4_role_counts', 'project_space_members', coalesce(role::text, 'null') || ' = ' || count(*)::text
FROM public.project_space_members GROUP BY role
UNION ALL
SELECT '4_role_counts', 'room_members', coalesce(role::text, 'null') || ' = ' || count(*)::text
FROM public.room_members GROUP BY role

UNION ALL
-- 5. Policies on the tables that decide who may join a project.
SELECT '5_policy', schemaname || '.' || tablename,
       policyname || ' | ' || cmd || ' | ' || permissive || ' | roles=' || roles::text
         || ' | USING=' || coalesce(qual, '-') || ' | CHECK=' || coalesce(with_check, '-')
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('project_spaces','projects','project_space_join_requests','room_join_requests','conversations')

UNION ALL
-- 6. Triggers on the call and membership tables.
SELECT '6_trigger', tgrelid::regclass::text, tgname::text
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgrelid::regclass::text IN ('calls','call_participants','project_space_join_requests','project_spaces','projects','conversations')

UNION ALL
-- 7. Counts only: how many project members got in without being the creator and without an approved join request
--    (these are the rows that would need a one-off review after the membership rule is tightened).
SELECT '7_member_review_counts', 'project_space_members',
       'total=' || count(*)::text
       || ' not_creator_and_no_approved_request=' || count(*) FILTER (
            WHERE NOT EXISTS (SELECT 1 FROM public.project_spaces ps
                              LEFT JOIN public.projects pr ON pr.id = ps.project_id
                              WHERE ps.id = m.project_space_id AND (ps.creator_id = m.user_id OR pr.creator_id = m.user_id))
              AND NOT EXISTS (SELECT 1 FROM public.project_space_join_requests r
                              WHERE r.project_space_id = m.project_space_id AND r.user_id = m.user_id AND r.status::text = 'approved')
          )::text
FROM public.project_space_members m

ORDER BY section, object, detail;
