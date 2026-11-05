-- VERIFICATION FOR PARTS DV, DZ, EA, EC, EE - READ-ONLY. Run once in the Supabase SQL editor, export the CSV and paste it into the chat.
-- check_result = OK means the live database matches the part; MISSING means that part was not applied (or was undone).
-- It reads catalog names only and changes nothing.
WITH checks AS (
  SELECT 'DV' AS part, 'gov_approval_queue.decision_reason column' AS what,
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gov_approval_queue' AND column_name = 'decision_reason') AS ok
  UNION ALL SELECT 'DV', 'gov_reject_action exists',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gov_reject_action' AND pronamespace = 'public'::regnamespace)
  UNION ALL SELECT 'DV', 'staff_create_vip_invite exists',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'staff_create_vip_invite' AND pronamespace = 'public'::regnamespace)
  UNION ALL SELECT 'DZ', 'blocked_user_ids_both_ways exists',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'blocked_user_ids_both_ways' AND pronamespace = 'public'::regnamespace)
  UNION ALL SELECT 'EA', 'report target types include project',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_reports_target_type_check' AND pg_get_constraintdef(oid) LIKE '%project%')
  UNION ALL SELECT 'EC', 'user_room_prefs table',
         EXISTS (SELECT 1 FROM pg_class WHERE relname = 'user_room_prefs' AND relnamespace = 'public'::regnamespace)
  UNION ALL SELECT 'EC', 'user_room_prefs has row level security on',
         COALESCE((SELECT relrowsecurity FROM pg_class WHERE relname = 'user_room_prefs' AND relnamespace = 'public'::regnamespace), false)
  UNION ALL SELECT 'EC', 'user_room_prefs readable only through own-row policies (no anon access)',
         NOT has_table_privilege('anon', 'public.user_room_prefs', 'SELECT')
  UNION ALL SELECT 'EE', 'member role update policy',
         EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_space_members' AND policyname = 'Owners change member roles' AND cmd = 'UPDATE')
  UNION ALL SELECT 'EE', 'member update guard trigger',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.project_space_members'::regclass AND tgname = 'ee_guard_space_member_update' AND NOT tgisinternal)
)
SELECT part, what, CASE WHEN ok THEN 'OK' ELSE 'MISSING' END AS check_result
FROM checks
ORDER BY (CASE WHEN ok THEN 1 ELSE 0 END), part;
