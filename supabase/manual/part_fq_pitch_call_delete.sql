-- PART FQ (pitch call delete) - a call creator may delete a pitch call that nobody pitched to. A call that received pitches must NEVER be deletable (the writers' pitches
-- would be removed with it). Safe to run more than once. RUN IT AGAIN if you ran the first version of this file.
--
-- WHAT THE TEST FOUND: the live database already had a broader "creators can delete their calls" rule, so a creator could delete a call WITH pitches over the API
-- (the website hides the button, the database did not stop it). This version (1) drops every other DELETE policy on pitch_calls and keeps one narrow rule, and (2) adds a trigger
-- that refuses to delete a call that has pitches for any signed-in person, whatever policies exist. Server code (service role, no signed-in user) is not affected.
--
-- PREFLIGHT (read only): select polname, pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'public.pitch_calls'::regclass and polcmd = 'd';   -- lists the policies that will be replaced
-- POST-CHECK  (read only): same query -> only "Creators delete their empty calls"; select tgname from pg_trigger where tgrelid = 'public.pitch_calls'::regclass and tgname = 'trg_pitch_call_delete_guard';  -- 1 row

SET lock_timeout = '5s';

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname FROM pg_policy WHERE polrelid = 'public.pitch_calls'::regclass AND polcmd = 'd' LOOP
    EXECUTE format('DROP POLICY %I ON public.pitch_calls', r.polname);
  END LOOP;
END $$;

CREATE POLICY "Creators delete their empty calls" ON public.pitch_calls FOR DELETE TO authenticated
  USING (creator_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.pitch_submissions s WHERE s.pitch_call_id = pitch_calls.id));

CREATE OR REPLACE FUNCTION public.pitch_call_delete_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.pitch_submissions s WHERE s.pitch_call_id = OLD.id) THEN
    RAISE EXCEPTION 'A pitch call that has pitches cannot be deleted. Close it instead.' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.pitch_call_delete_guard() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS trg_pitch_call_delete_guard ON public.pitch_calls;
CREATE TRIGGER trg_pitch_call_delete_guard BEFORE DELETE ON public.pitch_calls FOR EACH ROW EXECUTE FUNCTION public.pitch_call_delete_guard();

NOTIFY pgrst, 'reload schema';
