-- FINAL VERIFICATION - READ-ONLY. Run once in the Supabase SQL editor, export the CSV and paste it into the chat.
-- Each row is one thing the audit fixes should have changed. check_result = OK means the live database matches the fix;
-- MISSING means that part was not applied (or was undone). It reads policy / function / privilege names only.
WITH checks AS (
  SELECT 'CJ' AS part, 'cj_can_manage_space exists' AS what,
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cj_can_manage_space') AS ok
  UNION ALL SELECT 'CK', 'old open policy "Allow all" on project_space_messages gone',
         NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_space_messages' AND qual = 'true')
  UNION ALL SELECT 'CL', 'anyone-can-add-themselves policy on project_space_members gone',
         NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_space_members' AND policyname = 'Users can insert themselves into project members')
  UNION ALL SELECT 'CL', 'owners-add / approved-requesters policy present',
         EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_space_members' AND policyname = 'Owners add members; approved requesters join')
  UNION ALL SELECT 'CL', 'calls: old "Allow authenticated users to select calls" gone',
         NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calls' AND policyname = 'Allow authenticated users to select calls')
  UNION ALL SELECT 'CM', 'push webhook secret configured (20+ characters)',
         EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'push_webhook_secret' AND length(value::text) >= 20)
  UNION ALL SELECT 'CN', 'list_user_storage_objects exists', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'list_user_storage_objects')
  UNION ALL SELECT 'CP', '"Admins can update any profile" gone',
         NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admins can update any profile')
  UNION ALL SELECT 'CQ', 'cq_clean_rating_meta trigger present',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgname LIKE '%cq_clean_rating_meta%' AND NOT tgisinternal)
  UNION ALL SELECT 'CR', 'group_keys: no policy lets someone update another person''s row',
         NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'group_keys' AND cmd = 'UPDATE' AND with_check IS NULL AND qual NOT LIKE '%auth.uid()%')
  UNION ALL SELECT 'CS', 'key_vault table exists', EXISTS (SELECT 1 FROM pg_class WHERE relname = 'key_vault')
  UNION ALL SELECT 'CT', 'subscriptions.last_event_at column exists',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'last_event_at')
  UNION ALL SELECT 'CU', 'user_roles no longer readable by everyone',
         NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Anyone can view internal roles')
  UNION ALL SELECT 'CV', 'rotate_group_key + removal trigger present',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rotate_group_key') AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cv_member_removed' AND NOT tgisinternal)
  UNION ALL SELECT 'CW', 'members can be removed (delete policy present)',
         EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_space_members' AND cmd = 'DELETE')
  UNION ALL SELECT 'CX', 'group_key_status exists', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'group_key_status')
  UNION ALL SELECT 'CY', 'call-sheets / legal-docs buckets closed',
         NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname IN ('Auth view call-sheets', 'Auth view legal-docs'))
  UNION ALL SELECT 'CZ', 'moderators cannot UPDATE content_reports directly',
         NOT has_table_privilege('authenticated', 'public.content_reports', 'UPDATE')
  UNION ALL SELECT 'CZ', '"Admins can manage all profiles" gone',
         NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admins can manage all profiles')
  UNION ALL SELECT 'CZ', 'platform_settings not writable by signed-in clients',
         NOT has_table_privilege('authenticated', 'public.platform_settings', 'UPDATE')
  UNION ALL SELECT 'DA', 'sign-in hook takes a per-account lock',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'hook_password_verification_attempt' AND prosrc LIKE '%pg_advisory_xact_lock%')
  UNION ALL SELECT 'DB', 'blocked users cannot follow (trigger present)',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'a_db_refuse_blocked_follow' AND NOT tgisinternal)
  UNION ALL SELECT 'DC', 'throttle prepares created_at (trigger on posts)',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'a_db_prepare_throttled_insert' AND NOT tgisinternal)
  UNION ALL SELECT 'DC', 'page posts guarded against removed managers',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'a_db_guard_page_post_update' AND NOT tgisinternal)
  UNION ALL SELECT 'DD', 'one live pitch per writer index present',
         EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'pitch_submissions_one_live_per_writer')
  UNION ALL SELECT 'DE/DG', 'network_overview reads the ignored flag from the private table',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'network_overview' AND prosrc LIKE '%connection_ignores%')
  UNION ALL SELECT 'DF', 'listing delete guard present',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'a_df_guard_listing_delete' AND NOT tgisinternal)
  UNION ALL SELECT 'DF', 'staff grant end flags key rotation',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'df_grant_end_rotation' AND NOT tgisinternal)
  UNION ALL SELECT 'DG', 'ignored requests kept in a private table',
         EXISTS (SELECT 1 FROM pg_class WHERE relname = 'connection_ignores')
  UNION ALL SELECT 'DH', 'sign-in hook warns the owner and spares staff from a 5-guess lock',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'hook_password_verification_attempt' AND prosrc LIKE '%Possible password guessing%')
)
SELECT part, what, CASE WHEN ok THEN 'OK' ELSE 'MISSING' END AS check_result
FROM checks
ORDER BY (CASE WHEN ok THEN 1 ELSE 0 END), part;
