-- PART FO (pitch, 1) - the duplicate pitch notification is STILL sent after part FJ (2): a new pitch gives the call owner both
-- "New Pitch Submission" (old function notify_pitch_submission, link /pitches/<id> which does not exist) and "New pitch received" (part AV).
-- Part FJ (2) only dropped a trigger called on_pitch_submission; in the live project the old function is attached under another name too.
-- THE FIX: drop EVERY trigger on pitch_submissions that runs the old function notify_pitch_submission(), whatever it is called. The part AV trigger stays.
-- Safe to run more than once.
--
-- PREFLIGHT (read only): select t.tgname, p.proname from pg_trigger t join pg_proc p on p.oid = t.tgfoid
--   where t.tgrelid = 'public.pitch_submissions'::regclass and not t.tgisinternal;      -- two notify triggers
-- POST-CHECK (read only): the same query lists only the part AV one (notify_pitch_submission_received); submit a pitch: ONE notification.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.pitch_submissions'::regclass
      AND NOT t.tgisinternal
      AND p.proname = 'notify_pitch_submission'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.pitch_submissions', r.tgname);
  END LOOP;
END $$;
