-- part_ea_mobile_group2_fixes.sql
-- Applied by hand by the owner. Safe to re-run.
--
-- PREFLIGHT (read-only, run first; they change nothing):
--   -- a) the current list of allowed report target types (expect the 12 types up to pitch_submission, no 'project' yet)
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.content_reports'::regclass and conname = 'content_reports_target_type_check';
--   -- b) make sure no existing row would break the new list (expect 0 rows)
--   select distinct target_type from public.content_reports
--    where target_type <> all (array['post','comment','user','job','listing','room','message','announcement','review','cinema','pitch_call','pitch_submission','project']);
--
-- Why: the mobile Projects card menu "Report Space" now stores a real report (it used to show "Reported" and write
-- nothing). Reports use target_type 'project' and target_id = the project id. Until this part is applied the app shows
-- "Report failed" instead of pretending it worked. Moderators can read these reports in the existing report queue;
-- "takedown" is not offered for this type (the project owner or staff handle it through the project itself).

ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_target_type_check
  CHECK (target_type = ANY (ARRAY['post','comment','user','job','listing','room','message','announcement','review','cinema','pitch_call','pitch_submission','project']));
