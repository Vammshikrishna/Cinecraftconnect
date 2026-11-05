-- AUDIT STEP 0 - READ-ONLY DIAGNOSTICS
-- Run this whole file once in the Supabase SQL editor (production project).
-- It only reads catalog metadata (policies, grants, triggers, buckets). It changes nothing and returns
-- no user data. The result is ONE table with the columns: section | object | detail.
--
-- How to send me the result: in the SQL editor, use "Export > CSV" (or copy the grid) and paste it into the chat.
-- If the editor says a table or function "does not exist", tell me which one; that is also a useful answer.

WITH
-- 1. Row-level-security policies on the tables the audit flagged, plus every storage.objects policy.
pol AS (
  SELECT '1_policy' AS section,
         schemaname || '.' || tablename AS object,
         policyname || ' | ' || cmd || ' | ' || permissive || ' | roles=' || roles::text
           || ' | USING=' || coalesce(qual, '-') || ' | CHECK=' || coalesce(with_check, '-') AS detail
  FROM pg_policies
  WHERE (schemaname = 'public' AND tablename IN (
          'project_space_members','project_space_messages','discussion_rooms','room_members','room_messages',
          'calls','call_participants','notifications','space_access_grants','group_keys',
          'verification_requests','legal_docs','job_applications','jobs','pitch_submissions','user_roles',
          'company_page_members','company_page_admins','notification_logs','user_analytics','categories',
          'key_backups','post_comments','post_likes','user_settings'))
     OR (schemaname = 'storage' AND tablename = 'objects')
),
-- 2. Who may run the risky functions (anon / signed-in), and whether they run with owner rights (definer).
fn AS (
  SELECT '2_function_access' AS section,
         p.oid::regprocedure::text AS object,
         'anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
           || ' authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
           || ' definer=' || p.prosecdef AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN (
    'claim_admin_access','send_governance_notification','approve_join_request','reject_join_request',
    'clear_project_space_messages','get_messages_for_channel_paginated','create_discussion_room_with_creator',
    'mark_message_as_seen','remove_staff_memberships','_create_refund','pitch_is_blocked',
    'has_entitlement','entitlement_limit','count_for_limit','resolve_entitlements','has_product_access',
    'announcement_visible','is_page_team','answer_call','decline_call','cancel_call',
    'verify_call_room_membership','approve_space_access','get_profile_activity','get_profile_counts',
    'introduction_options','suggest_people','is_staff_user','room_member_counts','notify_due_announcements',
    'close_expired_pitch_calls','expire_stale_calls','trending_community_titles')
),
-- 3. Which version of verify_call_room_membership is live (the two weak patterns the audit found).
vfn AS (
  SELECT '3_function_body' AS section,
         p.oid::regprocedure::text AS object,
         'mentions_profiles_table=' || (pg_get_functiondef(p.oid) ILIKE '%from profiles%' OR pg_get_functiondef(p.oid) ILIKE '%from public.profiles%')
           || ' uses_like_fallback=' || (pg_get_functiondef(p.oid) ILIKE '%like%') AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'verify_call_room_membership'
),
-- 4. Public tables where row-level security is OFF (anon/authenticated can read/write them freely).
rls AS (
  SELECT '4_rls_disabled_public_table' AS section,
         c.relname::text AS object,
         'anon_select=' || has_table_privilege('anon', c.oid, 'SELECT')
           || ' anon_insert=' || has_table_privilege('anon', c.oid, 'INSERT')
           || ' authenticated_write=' || has_table_privilege('authenticated', c.oid, 'INSERT') AS detail
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
),
-- 5. Storage buckets: public or private, size and type limits.
bkt AS (
  SELECT '5_bucket' AS section,
         id::text AS object,
         'public=' || public || ' size_limit=' || coalesce(file_size_limit::text, '-')
           || ' mime=' || coalesce(allowed_mime_types::text, '-') AS detail
  FROM storage.buckets
),
-- 6. Triggers on the audited tables (shows whether the hand-applied guard triggers exist).
trg AS (
  SELECT '6_trigger' AS section,
         tgrelid::regclass::text AS object,
         tgname::text AS detail
  FROM pg_trigger
  WHERE NOT tgisinternal AND tgrelid::regclass::text IN (
    'project_space_members','room_members','calls','call_participants','notifications','space_access_grants',
    'group_keys','pitch_submissions','posts','post_comments','content_reports','job_applications','jobs',
    'company_page_members','profiles','user_roles','direct_messages','audit_logs')
),
-- 7. Do the hand-applied helper objects from supabase/manual exist? (name only)
mp AS (
  SELECT '7_manual_part_marker' AS section,
         p.proname::text AS object,
         'exists' AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN (
    'pitch_submission_update_guard','guard_post_extras','has_active_staff_grant','staff_mfa_ok',
    'hook_password_verification_attempt','refuse_staff_membership','gov_can_act_on','can_view_post',
    'can_view_profile_extras','is_page_manager','safe_external_url','clean_public_url')
),
-- 8. Table-level grants for anon on the most sensitive tables.
grants AS (
  SELECT '8_anon_table_privileges' AS section,
         c.relname::text AS object,
         'select=' || has_table_privilege('anon', c.oid, 'SELECT')
           || ' insert=' || has_table_privilege('anon', c.oid, 'INSERT')
           || ' update=' || has_table_privilege('anon', c.oid, 'UPDATE')
           || ' delete=' || has_table_privilege('anon', c.oid, 'DELETE') AS detail
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN (
    'project_space_members','project_space_messages','discussion_rooms','room_members','calls','call_participants',
    'notifications','space_access_grants','group_keys','user_settings','user_roles','profiles')
)
SELECT section, object, detail FROM pol
UNION ALL SELECT section, object, detail FROM fn
UNION ALL SELECT section, object, detail FROM vfn
UNION ALL SELECT section, object, detail FROM rls
UNION ALL SELECT section, object, detail FROM bkt
UNION ALL SELECT section, object, detail FROM trg
UNION ALL SELECT section, object, detail FROM mp
UNION ALL SELECT section, object, detail FROM grants
ORDER BY section, object, detail;
