-- VERIFICATION FOR PARTS DI TO DT - READ-ONLY. Run once in the Supabase SQL editor, export the CSV and paste it into the chat.
-- Each row is one thing those parts should have changed. check_result = OK means the live database matches; MISSING means that
-- part was not applied (or was undone). It reads catalog names only and changes nothing.
WITH checks AS (
  SELECT 'DI' AS part, 'profiles.cover_image_url dropped' AS what,
         NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'cover_image_url') AS ok
  UNION ALL SELECT 'DI', 'my_profile_completeness has no cover step',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'my_profile_completeness' AND pronamespace = 'public'::regnamespace AND prosrc NOT LIKE '%cover%')
  UNION ALL SELECT 'DJ', 'report abuse guard trigger',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.content_reports'::regclass AND tgname = 'b_dj_report_abuse_guard' AND NOT tgisinternal)
  UNION ALL SELECT 'DJ', 'staff_escalate_report exists',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'staff_escalate_report' AND pronamespace = 'public'::regnamespace)
  UNION ALL SELECT 'DK', 'verification request type constraint',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verification_requests_request_type_check')
  UNION ALL SELECT 'DK', 'verification insert guard trigger',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'guard_verification_request_insert' AND NOT tgisinternal)
  UNION ALL SELECT 'DK', 'one open verification request per user (index)',
         EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_verification_one_open_request')
  UNION ALL SELECT 'DL', 'default account type trigger on profiles',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'default_profile_account_type' AND NOT tgisinternal)
  UNION ALL SELECT 'DL', 'no profile with an empty account type',
         NOT EXISTS (SELECT 1 FROM public.profiles WHERE account_type IS NULL)
  UNION ALL SELECT 'DM', 'fans cannot insert posts (trigger)',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.posts'::regclass AND tgname = 'refuse_fan_post_insert' AND NOT tgisinternal)
  UNION ALL SELECT 'DN', 'jobs insert policy replaced',
         EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'Users can create jobs' AND cmd = 'INSERT')
  UNION ALL SELECT 'DO', 'pitch submission account guard trigger',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.pitch_submissions'::regclass AND tgname = 'pitch_submission_account_guard' AND NOT tgisinternal)
  UNION ALL SELECT 'DP', 'own-content guard trigger',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.content_reports'::regclass AND tgname = 'b_dp_report_own_content_guard' AND NOT tgisinternal)
  UNION ALL SELECT 'DP', 'report_prepare counts credible reporters',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'report_prepare' AND pronamespace = 'public'::regnamespace AND prosrc LIKE '%dp_credible_reporter_count%')
  UNION ALL SELECT 'DQ', 'blocked-extension rule on upload',
         EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Refuse blocked file types on upload')
  UNION ALL SELECT 'DQ', 'blocked-extension rule on rename',
         EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Refuse blocked file types on rename')
  UNION ALL SELECT 'DQ', 'image-only buckets have a mime list',
         (SELECT count(*) FROM storage.buckets WHERE id IN ('avatars', 'marketplace-images', 'vendor-images') AND allowed_mime_types IS NOT NULL) = 3
  UNION ALL SELECT 'DR', 'revoke_my_session exists',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'revoke_my_session' AND pronamespace = 'public'::regnamespace)
  UNION ALL SELECT 'DR', 'user_sessions.auth_session_id column',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_sessions' AND column_name = 'auth_session_id')
  UNION ALL SELECT 'DS', 'no verification request left with type company',
         NOT EXISTS (SELECT 1 FROM public.verification_requests WHERE lower(btrim(request_type)) = 'company')
  UNION ALL SELECT 'DS', 'verification type constraint fully validated',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verification_requests_request_type_check' AND convalidated)
  UNION ALL SELECT 'DT', 'every bucket has a size limit',
         NOT EXISTS (SELECT 1 FROM storage.buckets WHERE file_size_limit IS NULL)
)
SELECT part, what, CASE WHEN ok THEN 'OK' ELSE 'MISSING' END AS check_result
FROM checks
ORDER BY (CASE WHEN ok THEN 1 ELSE 0 END), part;
